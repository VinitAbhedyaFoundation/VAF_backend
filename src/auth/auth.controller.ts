
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
  Res,
  Req,
} from '@nestjs/common';

import {
    ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { AuthGuard } from '@nestjs/passport';
import { Role } from '@prisma/client';
import type { Request, Response } from 'express';
import { createHash } from 'node:crypto';

import { AuthService } from './auth.service';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { LoginAdminDto } from './dto/login-admin.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateUserDto } from './dto/update-user.dto';

import { UserId } from '../common/decorator/user-id.decorator';
import { Roles } from '../common/decorator/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CsrfService } from './csrf/csrf.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly csrfService: CsrfService,
  ) {}

  private getCookieOptions() {
    const isProduction = process.env.NODE_ENV === 'production';

    return {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' as const : 'lax' as const,
      path: '/',
    };
  }

  private getSessionBinding(accessToken?: string): string {
    if (!accessToken) {
      return 'pre-auth';
    }

    return createHash('sha256')
      .update(accessToken)
      .digest('hex');
  }

  private setAuthCookie(response: Response, token: string) {
    response.cookie(
      'access_token',
      token,
      this.getCookieOptions(),
    );
  }

  private setCsrfCookie(response: Response, token: string) {
    response.cookie(
      'csrf_token',
      token,
      this.getCookieOptions(),
    );
  }

  @Post('register')
  @ApiOperation({
    summary: 'Register a new user',
    description: 'Register a new user account.',
  })
  async create(
    @Body() createUserDto: CreateUserDto,
  ) {
    return this.authService.createUser(createUserDto);
  }

  @Get('csrf')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get CSRF token',
    description: 'Generate a CSRF token and set its cookie.',
  })
  getCsrfToken(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const accessToken = request.cookies?.access_token;
    const sessionBinding = this.getSessionBinding(accessToken);

    const csrfToken = this.csrfService.generateToken(sessionBinding);

    this.setCsrfCookie(response, csrfToken);

    response.setHeader('Cache-Control', 'no-store');

    return { csrfToken };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'User login',
    description:
      'Authenticate user and set HttpOnly authentication and CSRF cookies.',
  })
  async loginUser(
    @Body() loginUserDto: LoginUserDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.loginUser(loginUserDto);

    this.setAuthCookie(response, result.token);

    const csrfToken = this.csrfService.generateToken(
      this.getSessionBinding(result.token),
    );

    this.setCsrfCookie(response, csrfToken);

    const { token, ...safeResponse } = result;

    return {
      ...safeResponse,
      csrfToken,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'User logout',
    description: 'Clear authentication and CSRF cookies.',
  })
  logout(
    @Res({ passthrough: true }) response: Response,
  ) {
    response.clearCookie(
      'access_token',
      this.getCookieOptions(),
    );

    response.clearCookie(
      'csrf_token',
      this.getCookieOptions(),
    );

    return {
      message: 'Logged out successfully',
    };
  }

  @ApiCookieAuth('access-token')
  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  @ApiOperation({
    summary: 'Current user',
    description: 'Returns the authenticated user.',
  })
  async getMe(
    @UserId() userId: number,
  ) {
    return this.authService.getMe(userId);
  }

  @ApiCookieAuth('access-token')
  @UseGuards(AuthGuard('jwt'))
  @Patch('update-user')
  @ApiOperation({
    summary: 'Update own profile',
    description: 'Update authenticated user profile.',
  })
  async update(
    @Body() updateAuthData: UpdateUserDto,
    @UserId() userId: number,
  ) {
    return this.authService.update(updateAuthData, userId);
  }

  @ApiCookieAuth('access-token')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.Admin)
  @Patch('update-user/:id')
  @ApiOperation({
    summary: 'Admin update user',
    description: 'Update any user by ID.',
  })
  async updateById(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateAuthData: UpdateUserDto,
  ) {
    return this.authService.adminUpdateUser(updateAuthData, id);
  }

  @Post('adminlogin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Admin login',
    description:
      'Authenticate admin and set HttpOnly authentication and CSRF cookies.',
  })
  async loginAdmin(
    @Body() loginAdminDto: LoginAdminDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.loginAdmin(loginAdminDto);

    this.setAuthCookie(response, result.token);

    const csrfToken = this.csrfService.generateToken(
      this.getSessionBinding(result.token),
    );

    this.setCsrfCookie(response, csrfToken);

    const { token, ...safeResponse } = result;

    return {
      ...safeResponse,
      csrfToken,
    };
  }

  @ApiCookieAuth('access-token')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.SuperAdmin)
  @Post('adminregister')
  @ApiOperation({
    summary: 'Register admin',
    description: 'Create a new admin account.',
  })
  async registerAdmin(
    @Body() createAdminDto: CreateAdminDto,
  ) {
    return this.authService.createAdmin(createAdminDto);
  }

  @ApiCookieAuth('access-token')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.Admin)
  @Get('users')
  @ApiOperation({
    summary: 'Get all users',
    description: 'Returns all registered users.',
  })
  async getAllUsers() {
    return this.authService.getAllUsers();
  }
}
