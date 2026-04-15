import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { LoginUserDto } from './dto/login-user-dto';
import * as bcrypt from 'bcrypt';
import { DatabaseService } from 'src/database/database.service';
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
    private jwtService: JwtService
  ) {}

  async createUser(createUserData: CreateUserDto) {
    const { email, password, ...rest } = createUserData;

    try {
      const existingUser = await this.databaseService.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        throw new ConflictException('User already exists');
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const userId = await this.createUserId(createUserData.gender);

      await this.databaseService.user.create({
        data: {
          email,
          password: hashedPassword,
          ...rest,
          ploggerId: userId,
        },
      });

      return { message: 'User Created Successfully', userId };

    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('User already exists');
      }
      throw new InternalServerErrorException();
    }
  }

  // 🔐 FIXED: no user enumeration
  async loginUser(loginUserData: LoginUserDto) {
    const { userId, password } = loginUserData;

    try {
      let user;

      if (userId.includes('@')) {
        user = await this.databaseService.user.findUnique({
          where: { email: userId }
        });
      } else {
        user = await this.databaseService.user.findUnique({
          where: { ploggerId: userId }
        });
      }

      if (!user) {
        throw new UnauthorizedException('Invalid credentials');
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid credentials');
      }

      const token = await this.generateUserToken({
        email: user.email,
        id: user.id
      });

      return { message: 'Login Successful', token };

    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new InternalServerErrorException();
    }
  }

  // 🔐 FIXED: authorization check
  async update(updateAuthData: UpdateUserDto, id: number, currentUser: any) {
    try {
      if (currentUser.id !== id && currentUser.role !== 'Admin') {
        throw new ForbiddenException('Not allowed');
      }

      if (updateAuthData.password) {
        updateAuthData.password = await bcrypt.hash(updateAuthData.password, 10);
      }

      const user = await this.databaseService.user.update({
        where: { id },
        data: updateAuthData,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
        }
      });

      return { message: 'User Updated Successfully', user };

    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('User not found');
      }
      throw new InternalServerErrorException();
    }
  }

  async loginAdmin(loginAdminData: LoginAdminDto) {
    const { email, password } = loginAdminData;

    try {
      const admin = await this.databaseService.user.findFirst({
        where: {
          email,
          role: { in: ['Admin', 'SuperAdmin'] }
        }
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
        role: admin.role
      });

      return { message: 'Login Successful', token };

    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new InternalServerErrorException();
    }
  }

  // 🔐 FIXED: restrict admin creation
  async createAdmin(createAdminData: CreateAdminDto, currentUser: any) {
    if (currentUser.role !== 'SuperAdmin') {
      throw new ForbiddenException('Only SuperAdmin can create Admin');
    }

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
          role: 'Admin',
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

    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Email already exists');
      }
      throw new InternalServerErrorException();
    }
  }

  // 🔐 FIXED: no password leak
  async getAllUsers() {
    try {
      const users = await this.databaseService.user.findMany({
        orderBy: { id: 'asc' },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        }
      });

      if (!users.length) {
        throw new NotFoundException('No Users Found');
      }

      return { message: 'Users Found', users };

    } catch (error) {
      if (error instanceof NotFoundException) throw error;
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
    const genderCode = gender === "Male" ? 1 : gender === "Female" ? 2 : 3;
    const autoGeneratedId = newId.toString().padStart(5, '0');

    return `${year}${genderCode}${autoGeneratedId}`;
  }

  async generateUserToken(payload: { email: string; id: number }) {
    return this.jwtService.signAsync(
      { email: payload.email, sub: payload.id },
      {
        secret: this.configService.get('USER_JWT_SECRET'),
        expiresIn: '2h',
      }
    );
  }

  async generateAdminToken(payload: { email: string; id: number; role: Role }) {
    return this.jwtService.signAsync(
      { email: payload.email, sub: payload.id, role: payload.role },
      {
        secret: this.configService.get('ADMIN_JWT_SECRET'),
        expiresIn: '6h',
      }
    );
  }
}