// (with a note to revisit createUserId() later if needed) 
// for polishing this file

import {
  ConflictException,
  Logger,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import * as bcrypt from 'bcrypt';
import { DatabaseService } from '../database/database.service';
import { ConfigService } from '@nestjs/config';
import { Gender, Prisma, Role, UserStatus } from '@prisma/client';
import { LoginAdminDto } from './dto/login-admin.dto';
import { JwtService } from '@nestjs/jwt';
import { CreateAdminDto } from './dto/create-admin.dto';

const DUMMY_HASH =
  '$2b$12$C6UzMDM.H6dfI/f/IKcEeO3kR4hV9jWQ6QcgO5Kb/6VQwWi4KFOGa';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private databaseService: DatabaseService,
    private configService: ConfigService,
    private jwtService: JwtService,
  ) { }

  // 🔥 CREATE USER
  async createUser(createUserData: CreateUserDto) {
    const {
      email: rawEmail,
      password,
      gender,
      birthDate,
      name,
      phone,
      address,
    } = createUserData;

    const email = rawEmail.toLowerCase().trim();


    try {
      if (!gender) {
        throw new InternalServerErrorException('Gender is required');
      }

      const existingUser = await this.databaseService.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        throw new ConflictException('User already exists');
      }

      const hashedPassword = await bcrypt.hash(password, 12);
      const userId = await this.createUserId(gender);

      // ✅ Build data object explicitly (NO spread tricks)
      const parsedBirthDate =
        birthDate
          ? new Date(birthDate)
          : undefined;

      const data: Prisma.UserCreateInput = {
        name,
        email,
        phone,
        address,
        password: hashedPassword,
        gender,
        role: Role.User,
        ploggerId: userId,
        birthDate: parsedBirthDate,
        status: UserStatus.Pending,
      };

      const user = await this.databaseService.user.create({
        data,
        select: {
          id: true,
          name: true,
          email: true,
          ploggerId: true,
        },
      });

      return { message: 'User Created Successfully', userId, user };

    } catch (error: unknown) {
      this.logger.error(
        error instanceof Error
          ? error.stack
          : String(error),
      );

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('User already exists');
      }

      throw new InternalServerErrorException('Something went wrong');
    }
  }


  // 🔥 LOGIN USER
  async loginUser(loginUserData: LoginUserDto) {
    const email = loginUserData.email
      .toLowerCase()
      .trim();

    const { password } = loginUserData;

    try {
      // console.log("🟡 USER Login:", user);
      const user = await this.databaseService.user.findUnique({
        where: { email },
      });

      // console.log("🟡 USER FOUND:", user);

      if (!user) {
        // console.log("❌ USER NOT FOUND");
        throw new UnauthorizedException(
          'Invalid credentials',
        );
      }

      if (user.status === UserStatus.Pending) {
        throw new UnauthorizedException(
          'Account not approved yet',
        );
      }

      if (user.status === UserStatus.Suspended) {
        throw new UnauthorizedException(
          'Account suspended',
        );
      }

      const isPasswordValid = await bcrypt.compare(
  password,
  user?.password ?? DUMMY_HASH,
);

      // console.log("🟢 PASSWORD MATCH:", isPasswordValid);

      if (!isPasswordValid) {
        // console.log("❌ WRONG PASSWORD");
        throw new UnauthorizedException('Invalid credentials');
      }

      // // console.log("✅ LOGIN SUCCESS");

      const token = await this.generateUserToken({
        email: user?.email,
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
      this.logger.error(
        error instanceof Error
          ? error.stack
          : String(error),
      );

      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Login failed',
      );
    }
  }

  // 🔥 UPDATE USER
  async update(updateAuthData: UpdateUserDto, id: number) {
    try {
      if (updateAuthData.password) {
        updateAuthData.password = await bcrypt.hash(
          updateAuthData.password,
          12,
        );
      }

      const user = await this.databaseService.user.update({
        where: { id },
        data: updateAuthData,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
        },
      });

      return { message: 'User Updated Successfully', user };

    } catch (error: unknown) {

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('User not found');
      }

      if (error instanceof Error) {

        throw new InternalServerErrorException(
          'Operation failed',
        );
      }

      throw new InternalServerErrorException();
    }
  }

  // 🔥 ADMIN LOGIN
  async loginAdmin(loginAdminData: LoginAdminDto) {
    const email = loginAdminData.email
  .toLowerCase()
  .trim();

const { password } = loginAdminData;

    try {
      const admin = await this.databaseService.user.findFirst({
        where: {
          email,
          role: { in: [Role.Admin, Role.SuperAdmin] },
        },
      });

      if (!admin) {
        throw new UnauthorizedException('Invalid credentials');
      }

      if (admin.status === UserStatus.Suspended) {
        throw new UnauthorizedException('Admin account suspended');
      }

      const isPasswordValid = await bcrypt.compare(password, admin.password);

      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid credentials');
      }

      const token = await this.generateAdminToken({
        email: admin.email,
        id: admin.id,
        role: admin.role,
      });

      return { message: 'Login Successful', token };

    } catch (error: unknown) {
      this.logger.error(
        error instanceof Error
          ? error.stack
          : String(error),
      );

      if (error instanceof UnauthorizedException) throw error;

      if (error instanceof Error) {
        this.logger.error(
          error instanceof Error
            ? error.stack
            : String(error),
        );

        throw new InternalServerErrorException(
          'Operation failed',
        );
      }

      throw new InternalServerErrorException();
    }
  }


  // 🔥 CREATE ADMIN
  async createAdmin(createAdminData: CreateAdminDto) {

    const email = createAdminData.email
  .toLowerCase()
  .trim();

const { password, name } = createAdminData;

    try {

      const existingAdmin =
        await this.databaseService.user.findUnique({
          where: { email },
        });

      if (existingAdmin) {
        throw new ConflictException(
          'Admin already exists',
        );
      }

      const hashedPassword =
        await bcrypt.hash(password, 12);

      await this.databaseService.user.create({
        data: {
          name,
          email,
          password: hashedPassword,

          role: Role.Admin,
          status: UserStatus.Approved,

          ploggerId: `ADMIN_${Date.now()}`,
        },
      });

      return {
        message:
          'Admin Created Successfully',
      };

    } catch (error: unknown) {

      this.logger.error(
        error instanceof Error
          ? error.stack
          : String(error),
      );

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Email already exists',
        );
      }

      if (error instanceof Error) {
        throw new InternalServerErrorException(
          'Operation failed',
        );
      }

      throw new InternalServerErrorException();
    }
  }

  // 🔥 GET USERS
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

      if (!users.length) {
        throw new NotFoundException('No Users Found');
      }

      return { message: 'Users Found', users };

    } catch (error: unknown) {
      this.logger.error(
        error instanceof Error
          ? error.stack
          : String(error),
      );

      if (error instanceof NotFoundException) throw error;

      if (error instanceof Error) {
        this.logger.error(
          error instanceof Error
            ? error.stack
            : String(error),
        );

        throw new InternalServerErrorException(
          'Operation failed',
        );
      }

      throw new InternalServerErrorException();
    }
  }

  async createUserId(gender: Gender): Promise<string> {
    const lastUser = await this.databaseService.user.findFirst({
      select: { id: true },
      orderBy: { id: 'desc' },
    });

    const lastId = lastUser ? lastUser.id : 0;
    const newId = lastId + 1;

    const year = new Date().getFullYear().toString().slice(-2);
    const genderCode = gender === 'Male' ? 1 : gender === 'Female' ? 2 : 3;
    const autoGeneratedId = newId.toString().padStart(5, '0');

    return `${year}${genderCode}${autoGeneratedId}`;
  }

  async generateUserToken(payload: {
    email: string;
    id: number;
    role: Role;
  }) {
    return this.jwtService.signAsync(
      { email: payload.email, sub: payload.id, role: payload.role },
      {
        secret: this.configService.get<string>('JWT_SECRET_KEY'),
        expiresIn: '2h',
      },
    );
  }
  async generateAdminToken(payload: {
    email: string;
    id: number;
    role: Role;
  }) {
    return this.jwtService.signAsync(
      { email: payload.email, sub: payload.id, role: payload.role },
      {
        secret: this.configService.get<string>('JWT_SECRET_KEY'),
        expiresIn: '6h',
      },
    );
  }

  // ✅ ADD ONLY THIS BELOW (INSIDE CLASS)
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
      this.logger.error(
        error instanceof Error
          ? error.stack
          : String(error),
      );

      if (error instanceof NotFoundException) throw error;

      if (error instanceof Error) {
        this.logger.error(
          error instanceof Error
            ? error.stack
            : String(error),
        );

        throw new InternalServerErrorException(
          'Operation failed',
        );
      }

      throw new InternalServerErrorException();
    }
  }
}