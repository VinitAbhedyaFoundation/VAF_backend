
import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  BloodGroup,
  Gender,
  Occupation,
  Prisma,
  Role,
  UserStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';

import { DatabaseService } from '../database/database.service';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { LoginAdminDto } from './dto/login-admin.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const BCRYPT_ROUNDS = 12;
const USER_TOKEN_EXPIRY = '2h';
const ADMIN_TOKEN_EXPIRY = '6h';

// A valid bcrypt hash used to reduce timing differences for unknown emails.
const DUMMY_HASH =
  '$2b$12$C6UzMDM.H6dfI/f/IKcEeO3kR4hV9jWQ6QcgO5Kb/6VQwWi4KFOGa';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) { }

  private getJwtSecret(): string {
    const secret = this.configService.get<string>('JWT_SECRET_KEY');

    if (!secret || secret.trim().length < 32) {
      this.logger.error(
        'JWT_SECRET_KEY is missing or too short.',
      );
      throw new InternalServerErrorException(
        'Authentication configuration error',
      );
    }

    return secret;
  }

  private logUnexpectedError(
    operation: string,
    error: unknown,
  ): void {
    const message =
      error instanceof Error ? error.stack ?? error.message : String(error);

    this.logger.error(`${operation}: ${message}`);
  }

  private getUserPloggerId(id: number, gender: Gender): string {
    const year = new Date().getFullYear().toString().slice(-2);

    const genderCode =
      gender === Gender.Male
        ? 1
        : gender === Gender.Female
          ? 2
          : 3;

    return `${year}${genderCode}${id.toString().padStart(5, '0')}`;
  }

  // REGISTER USER
  async createUser(createUserData: CreateUserDto) {
    const email = createUserData.email.toLowerCase().trim();

    try {
      const existingUser = await this.databaseService.user.findUnique({
        where: { email },
        select: { id: true },
      });

      if (existingUser) {
        throw new ConflictException('User already exists');
      }

      const hashedPassword = await bcrypt.hash(
        createUserData.password,
        BCRYPT_ROUNDS,
      );

      const user = await this.databaseService.$transaction(async (tx) => {
        /*
         * The temporary unique value lets the database allocate the primary
         * key first. The final ploggerId is then derived from that primary key,
         * avoiding the previous "read max ID, then increment" race condition.
         */
        const createdUser = await tx.user.create({
          data: {
            name: createUserData.name.trim(),
            email,
            password: hashedPassword,
            phone: createUserData.phone,
            bloodGroup: createUserData.bloodGroup,
            birthDate: new Date(createUserData.birthDate),
            gender: createUserData.gender,
            highestQualification: createUserData.highestQualification.trim(),
            occupation: createUserData.occupation,
            address: createUserData.address.trim(),
            parentNumber: createUserData.parentNumber,
            city: createUserData.city?.trim(),
            state: createUserData.state?.trim(),
            collegeOrCompany: createUserData.collegeOrCompany?.trim(),
            role: Role.User,
            status: UserStatus.Pending,
            ploggerId: `PENDING_${randomUUID()}`,
          },
          select: {
            id: true,
            name: true,
            email: true,
            gender: true,
          },
        });

        if (!createdUser.gender) {
          throw new BadRequestException('Gender is required to generate a Plogger ID');
        }

        const ploggerId = this.getUserPloggerId(
          createdUser.id,
          createdUser.gender,
        );

        const updatedUser = await tx.user.update({
          where: { id: createdUser.id },
          data: { ploggerId },
          select: {
            id: true,
            name: true,
            email: true,
            ploggerId: true,
          },
        });

        return updatedUser;
      });

      return {
        message: 'User Created Successfully',
        userId: user.ploggerId,
        user,
      };
    } catch (error: unknown) {
      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException
      ) {
        throw error;
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'An account with the supplied unique information already exists',
        );
      }

      this.logUnexpectedError('User registration failed', error);
      throw new InternalServerErrorException(
        'Unable to create account',
      );
    }
  }

  // USER LOGIN
  async loginUser(loginUserData: LoginUserDto) {
    const email = loginUserData.email.toLowerCase().trim();

    try {
      const user = await this.databaseService.user.findUnique({
        where: { email },
      });

      const passwordMatches = await bcrypt.compare(
        loginUserData.password,
        user?.password ?? DUMMY_HASH,
      );

      // Use the same response for an unknown email and an incorrect password.
      if (!user || !passwordMatches) {
        throw new UnauthorizedException('Invalid credentials');
      }

      if (user.status !== UserStatus.Approved) {
        throw new UnauthorizedException(
          'Your account is not available for login',
        );
      }

      const token = await this.generateUserToken({
        email: user.email,
        id: user.id,
        role: user.role,
      });

      return {
        message: 'Login Successful',
        token,
        role: user.role,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
        },
      };
    } catch (error: unknown) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      this.logUnexpectedError('User login failed', error);
      throw new InternalServerErrorException('Login failed');
    }
  }

  // UPDATE USER PROFILE
  async update(updateAuthData: UpdateUserDto, id: number) {
    try {
      if (!Number.isSafeInteger(id) || id <= 0) {
        throw new BadRequestException('Invalid user ID');
      }

      /*
       * Password, email, gender, role, status, ploggerId and other identity
       * fields are deliberately excluded from this general-purpose update.
       * Password changes require a separate verified flow.
       */

      const data: Prisma.UserUpdateInput = {};

      if (updateAuthData.name !== undefined) {
        data.name = updateAuthData.name.trim();
      }

      if (updateAuthData.phone !== undefined) {
        data.phone = updateAuthData.phone;
      }

      if (updateAuthData.bloodGroup !== undefined) {
        data.bloodGroup = updateAuthData.bloodGroup as BloodGroup;
      }

      if (updateAuthData.birthDate !== undefined) {
        const birthDate = new Date(updateAuthData.birthDate);

        if (Number.isNaN(birthDate.getTime())) {
          throw new BadRequestException('Invalid birth date');
        }

        data.birthDate = birthDate;
      }

      if (updateAuthData.highestQualification !== undefined) {
        data.highestQualification =
          updateAuthData.highestQualification.trim();
      }

      if (updateAuthData.occupation !== undefined) {
        data.occupation = updateAuthData.occupation as Occupation;
      }

      if (updateAuthData.address !== undefined) {
        data.address = updateAuthData.address.trim();
      }

      if (updateAuthData.parentNumber !== undefined) {
        data.parentNumber = updateAuthData.parentNumber;
      }

      if (updateAuthData.city !== undefined) {
        data.city = updateAuthData.city?.trim() || null;
      }

      if (updateAuthData.state !== undefined) {
        data.state = updateAuthData.state?.trim() || null;
      }

      if (updateAuthData.collegeOrCompany !== undefined) {
        data.collegeOrCompany =
          updateAuthData.collegeOrCompany?.trim() || null;
      }

      if (Object.keys(data).length === 0) {
        throw new BadRequestException(
          'No supported profile fields were supplied',
        );
      }

      const user = await this.databaseService.user.update({
        where: { id },
        data,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          status: true,
          ploggerId: true,
        },
      });

      return {
        message: 'User Updated Successfully',
        user,
      };
    } catch (error: unknown) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('User not found');
      }

      this.logUnexpectedError('User profile update failed', error);
      throw new InternalServerErrorException(
        'Unable to update user',
      );
    }
  }

  // ADMIN LOGIN
  async loginAdmin(loginAdminData: LoginAdminDto) {
    const email = loginAdminData.email.toLowerCase().trim();

    try {
      const admin = await this.databaseService.user.findFirst({
        where: {
          email,
          role: { in: [Role.Admin, Role.SuperAdmin] },
        },
      });

      const passwordMatches = await bcrypt.compare(
        loginAdminData.password,
        admin?.password ?? DUMMY_HASH,
      );

      if (!admin || !passwordMatches) {
        throw new UnauthorizedException('Invalid credentials');
      }

      if (admin.status !== UserStatus.Approved) {
        throw new UnauthorizedException(
          'Admin account is not available for login',
        );
      }

      const token = await this.generateAdminToken({
        email: admin.email,
        id: admin.id,
        role: admin.role,
      });

      return {
        message: 'Login Successful',
        token,
      };
    } catch (error: unknown) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      this.logUnexpectedError('Admin login failed', error);
      throw new InternalServerErrorException('Login failed');
    }
  }

  // CREATE ADMIN — controller must restrict this to SuperAdmin
  async createAdmin(createAdminData: CreateAdminDto) {
    const email = createAdminData.email.toLowerCase().trim();

    try {
      const existingUser = await this.databaseService.user.findUnique({
        where: { email },
        select: { id: true },
      });

      if (existingUser) {
        throw new ConflictException('An account with this email already exists');
      }

      const hashedPassword = await bcrypt.hash(
        createAdminData.password,
        BCRYPT_ROUNDS,
      );

      await this.databaseService.user.create({
        data: {
          name: createAdminData.name.trim(),
          email,
          password: hashedPassword,
          city: createAdminData.city,
          gender: createAdminData.gender,
          role: Role.Admin,
          status: UserStatus.Approved,
          ploggerId: `ADMIN_${randomUUID()}`,
        },
        select: { id: true },
      });

      return { message: 'Admin Created Successfully' };
    } catch (error: unknown) {
      if (error instanceof ConflictException) {
        throw error;
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'An account with the supplied unique information already exists',
        );
      }

      this.logUnexpectedError('Admin creation failed', error);
      throw new InternalServerErrorException(
        'Unable to create admin account',
      );
    }
  }

  // GET USERS
  async getAllUsers() {
    try {
      const users = await this.databaseService.user.findMany({
        orderBy: { id: 'asc' },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      });

      return {
        message: 'Users Found',
        users,
      };
    } catch (error: unknown) {
      this.logUnexpectedError('Fetching users failed', error);
      throw new InternalServerErrorException(
        'Unable to retrieve users',
      );
    }
  }

  // Retained for compatibility with any existing service callers.
  // Registration itself now generates IDs inside a transaction.
  async createUserId(gender: Gender): Promise<string> {
    const lastUser = await this.databaseService.user.findFirst({
      select: { id: true },
      orderBy: { id: 'desc' },
    });

    return this.getUserPloggerId(
      (lastUser?.id ?? 0) + 1,
      gender,
    );
  }

  async generateUserToken(payload: {
    email: string;
    id: number;
    role: Role;
  }) {
    return this.jwtService.signAsync(
      {
        email: payload.email,
        sub: payload.id,
        role: payload.role,
      },
      {
        secret: this.getJwtSecret(),
        expiresIn: USER_TOKEN_EXPIRY,
      },
    );
  }

  async generateAdminToken(payload: {
    email: string;
    id: number;
    role: Role;
  }) {
    return this.jwtService.signAsync(
      {
        email: payload.email,
        sub: payload.id,
        role: payload.role,
      },
      {
        secret: this.getJwtSecret(),
        expiresIn: ADMIN_TOKEN_EXPIRY,
      },
    );
  }

  // GET CURRENT USER
  async getMe(userId: number) {
    try {
      const user = await this.databaseService.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          status: true,
          drivesCount: true,
          address: true,
          createdAt: true,
        },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      return user;
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logUnexpectedError('Fetching current user failed', error);
      throw new InternalServerErrorException(
        'Unable to retrieve user',
      );
    }
  }

  async adminUpdateUser(
    updateAuthData: UpdateUserDto,
    targetUserId: number,
  ) {
    const target = await this.databaseService.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, role: true },
    });

    if (!target) {
      throw new NotFoundException('User not found');
    }

    if (target.role === Role.SuperAdmin) {
      throw new UnauthorizedException(
        'Admins cannot modify SuperAdmin accounts',
      );
    }

    return this.update(updateAuthData, targetUserId);
  }
}
