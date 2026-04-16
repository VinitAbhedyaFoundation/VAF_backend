import { Controller, Post, Body, Patch, Param, UseGuards, Get } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { LoginAdminDto } from './dto/login-admin.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { AuthGuard } from '@nestjs/passport';
import { UserId } from '../common/decorator/user-id.decorator';
import { UpdateUserDto } from './dto/update-user.dto';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // auth/register
  @Post('register')
  @ApiOperation({
    description: 'Register a new user',
    summary: 'Input - all details of user and output - User Id',
  })
  async create(@Body() createUserDto: CreateUserDto) {
    return this.authService.createUser(createUserDto);
  }

  // auth/login
  @Post('login')
  @ApiOperation({
    description: 'Login API of user',
    summary: 'Input - PloggerId, Output - jwtToken',
  })
  async loginUser(@Body() loginUserDto: LoginUserDto) {
    return this.authService.loginUser(loginUserDto);
  }

  // auth/update-user
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt-user'))
  @Patch('update-user')
  @ApiOperation({
    description: 'Update API for USER',
    summary: 'Input - details to update, Output - Updated User Details',
  })
  async update(@Body() updateAuthData: UpdateUserDto, @UserId() userId: number) {
    return this.authService.update(updateAuthData, userId);
  }

  // auth/update-user/:id
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt-admin'))
  @Patch('update-user/:id')
  @ApiOperation({
    description: 'Update API of USER by Id (for admin)',
    summary: 'Input - details + Id + admin token, Output - Updated User Details',
  })
  async updateById(@Param('id') id: string, @Body() updateAuthData: UpdateUserDto) {
    return this.authService.update(updateAuthData, +id);
  }

  // auth/adminlogin
  @Post('adminlogin')
  @ApiOperation({
    description: 'Admin Login',
    summary: 'Output - jwtToken',
  })
  async loginAdmin(@Body() loginAdminDto: LoginAdminDto) {
    return this.authService.loginAdmin(loginAdminDto);
  }

  // auth/adminregister
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt-superadmin'))
  @Post('adminregister')
  @ApiOperation({
    description: 'Register a new admin',
    summary: 'Input - admin details + SuperAdmin token, Output - Admin Id',
  })
  async registerAdmin(@Body() createAdminDto: CreateAdminDto) {
    return this.authService.createAdmin(createAdminDto);
  }

  // auth/users
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt-admin'))
  @Get('users')
  @ApiOperation({
    description: 'Get all users',
    summary: 'Input - admin token, Output - All Users',
  })
  async getAllUsers() {
    return this.authService.getAllUsers();
  }
}