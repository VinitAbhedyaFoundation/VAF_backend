import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@prisma/client';

import { AuthService } from './auth.service';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { LoginAdminDto } from './dto/login-admin.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateUserDto } from './dto/update-user.dto';

import { UserId } from '../common/decorator/user-id.decorator';
import { Roles } from '../common/decorator/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
  ) {}

  @Post('register')
  @ApiOperation({
    summary: 'Register a new user',
    description:
      'Register a new user account.',
  })
  async create(
    @Body() createUserDto: CreateUserDto,
  ) {
    return this.authService.createUser(
      createUserDto,
    );
  }

  @Post('login')
  @ApiOperation({
    summary: 'User login',
    description:
      'Authenticate user and return JWT.',
  })
  async loginUser(
    @Body() loginUserDto: LoginUserDto,
  ) {
    return this.authService.loginUser(
      loginUserDto,
    );
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  @ApiOperation({
    summary: 'Current user',
    description:
      'Returns the authenticated user.',
  })
  async getMe(
    @UserId() userId: number,
  ) {
    return this.authService.getMe(userId);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Patch('update-user')
  @ApiOperation({
    summary: 'Update own profile',
    description:
      'Update authenticated user profile.',
  })
  async update(
    @Body() updateAuthData: UpdateUserDto,
    @UserId() userId: number,
  ) {
    return this.authService.update(
      updateAuthData,
      userId,
    );
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.Admin)
  @Patch('update-user/:id')
  @ApiOperation({
    summary: 'Admin update user',
    description:
      'Update any user by ID.',
  })
  async updateById(
    @Param('id', ParseIntPipe)
    id: number,
    @Body() updateAuthData: UpdateUserDto,
  ) {
    return this.authService.update(
      updateAuthData,
      id,
    );
  }

  @Post('adminlogin')
  @ApiOperation({
    summary: 'Admin login',
    description:
      'Authenticate admin and return JWT.',
  })
  async loginAdmin(
    @Body() loginAdminDto: LoginAdminDto,
  ) {
    return this.authService.loginAdmin(
      loginAdminDto,
    );
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.SuperAdmin)
  @Post('adminregister')
  @ApiOperation({
    summary: 'Register admin',
    description:
      'Create a new admin account.',
  })
  async registerAdmin(
    @Body() createAdminDto: CreateAdminDto,
  ) {
    return this.authService.createAdmin(
      createAdminDto,
    );
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.Admin)
  @Get('users')
  @ApiOperation({
    summary: 'Get all users',
    description:
      'Returns all registered users.',
  })
  async getAllUsers() {
    return this.authService.getAllUsers();
  }
}