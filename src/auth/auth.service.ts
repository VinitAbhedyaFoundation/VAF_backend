import {
  ConflictException,
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
import { Gender, Prisma, Role } from '@prisma/client';
import { LoginAdminDto } from './dto/login-admin.dto';
import { JwtService } from '@nestjs/jwt';
import { CreateAdminDto } from './dto/create-admin.dto';

@Injectable()
export class AuthService {
  constructor(
    private databaseService: DatabaseService,
    private configService: ConfigService,
    private jwtService: JwtService,
  ) { }

  // 🔥 CREATE USER
  async createUser(createUserData: CreateUserDto) {
    const { email, password, gender, birthDate, ...rest } = createUserData;

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

      const hashedPassword = await bcrypt.hash(password, 10);
      const userId = await this.createUserId(gender);

      // ✅ Build data object explicitly (NO spread tricks)
      const data: Prisma.UserCreateInput = {
        email,
        password: hashedPassword,
        gender,
        ...rest,
        role: Role.User,
        ploggerId: userId,
        birthDate: new Date(birthDate), // ✅ ALWAYS defined
      };

      const user = await this.databaseService.user.create({ data });

      return { message: 'User Created Successfully', userId, user };

    } catch (error: unknown) {
      console.error('CREATE USER ERROR:', error);

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('User already exists');
      }

      if (error instanceof Error) {
        throw new InternalServerErrorException(error.message);
      }

      throw new InternalServerErrorException('Something went wrong');
    }
  }

  // 🔥 LOGIN USER
  async loginUser(loginUserData: LoginUserDto) {
    const { email, password } = loginUserData;

    try {
      console.log("🔵 LOGIN ATTEMPT:", email);

      const user = await this.databaseService.user.findUnique({
        where: { email },
      });

      console.log("🟡 USER FOUND:", user);

      if (!user) {
        console.log("❌ USER NOT FOUND");
        throw new UnauthorizedException('User does not exist');
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);

      console.log("🟢 PASSWORD MATCH:", isPasswordValid);

      if (!isPasswordValid) {
        console.log("❌ WRONG PASSWORD");
        throw new UnauthorizedException('Wrong password');
      }

      console.log("✅ LOGIN SUCCESS");

      const token = await this.generateUserToken({
        email: user.email,
        id: user.id,
      });

      return {
        message: 'Login Successful',
        token,
        role: user.role,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
      };

    } catch (error: unknown) {
      console.error('LOGIN ERROR:', error);

      if (error instanceof UnauthorizedException) throw error;

      if (error instanceof Error) {
        throw new InternalServerErrorException(error.message);
      }

      throw new InternalServerErrorException();
    }
  }

  // 🔥 UPDATE USER
  async update(updateAuthData: UpdateUserDto, id: number) {
    try {
      if (updateAuthData.password) {
        updateAuthData.password = await bcrypt.hash(
          updateAuthData.password,
          10,
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
      console.error('UPDATE ERROR:', error);

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('User not found');
      }

      if (error instanceof Error) {
        throw new InternalServerErrorException(error.message);
      }

      throw new InternalServerErrorException();
    }
  }

  // 🔥 ADMIN LOGIN
  async loginAdmin(loginAdminData: LoginAdminDto) {
    const { email, password } = loginAdminData;

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
      console.error('ADMIN LOGIN ERROR:', error);

      if (error instanceof UnauthorizedException) throw error;

      if (error instanceof Error) {
        throw new InternalServerErrorException(error.message);
      }

      throw new InternalServerErrorException();
    }
  }

  // 🔥 CREATE ADMIN
  async createAdmin(createAdminData: CreateAdminDto) {
    const { email, password, name } = createAdminData;

    try {
      const existingAdmin = await this.databaseService.user.findUnique({
        where: { email },
      });

      if (existingAdmin) {
        throw new ConflictException('Admin already exists');
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      await this.databaseService.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          role: Role.Admin,
          phone: '0000000000',
          parentNumber: '0000000000',
          bloodGroup: 'O_POSITIVE',
          birthDate: new Date(),
          gender: 'Male',
          occupation: 'WorkingProfessional',
          highestQualification: 'N/A',
          address: 'N/A',
          ploggerId: `ADMIN_${Date.now()}`,
        },
      });

      return { message: 'Admin Created Successfully' };

    } catch (error: unknown) {
      console.error('CREATE ADMIN ERROR:', error);

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email already exists');
      }

      if (error instanceof Error) {
        throw new InternalServerErrorException(error.message);
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
      console.error('GET USERS ERROR:', error);

      if (error instanceof NotFoundException) throw error;

      if (error instanceof Error) {
        throw new InternalServerErrorException(error.message);
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

  async generateUserToken(payload: { email: string; id: number }) {
    return this.jwtService.signAsync(
      { email: payload.email, sub: payload.id },
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
      console.error('GET ME ERROR:', error);

      if (error instanceof NotFoundException) throw error;

      if (error instanceof Error) {
        throw new InternalServerErrorException(error.message);
      }

      throw new InternalServerErrorException();
    }
  }
}