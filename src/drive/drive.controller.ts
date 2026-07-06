import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';

import { JwtAuthGuard } from '../auth/guards/jwt-auth-guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

import { DriveService } from './drive.service';
import { CreateDriveDto } from './dto/create-drive.dto';
import { CreateDriveLocationDto } from './dto/drive-location.dto';
import { UpdateDriveDto } from './dto/update-drive.dto';

@ApiTags('Drive')
@Controller('drive')
export class DriveController {
  constructor(
    private readonly driveService: DriveService,
  ) {}

  // ================= ADMIN ROUTES =================

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin, Role.SuperAdmin)
  @Post('newdrive')
  @ApiOperation({
    summary: 'Create a new drive',
    description: 'Admin only',
  })
  async createDrive(
    @Body() createDriveDto: CreateDriveDto,
  ) {
    return this.driveService.createDrive(
      createDriveDto,
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin, Role.SuperAdmin)
  @Post('newlocation')
  @ApiOperation({
    summary: 'Create a new drive location',
    description: 'Admin only',
  })
  async createDriveLocation(
    @Body() dto: CreateDriveLocationDto,
  ) {
    return this.driveService.createDriveLocation(
      dto,
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin, Role.SuperAdmin)
  @Patch(':id')
  @ApiOperation({
    summary: 'Update drive',
    description: 'Admin only',
  })
  async update(
    @Param('id', ParseIntPipe)
    id: number,
    @Body() dto: UpdateDriveDto,
  ) {
    return this.driveService.update(
      id,
      dto,
    );
  }

  // ================= PUBLIC ROUTES =================

  @Get('alldrives')
  @ApiOperation({
    summary: 'Get all drives',
    description: 'Returns paginated drives',
  })
  async getAllDrives(
    @Query('page') page = '1',
    @Query('limit') limit = '10',
  ) {
    return this.driveService.findAllDrives(
      Number(page),
      Number(limit),
    );
  }

  @Get('alllocations')
  @ApiOperation({
    summary: 'Get all locations',
    description: 'Returns paginated locations',
  })
  async getAllLocations(
    @Query('page') page = '1',
    @Query('limit') limit = '10',
  ) {
    return this.driveService.findAllLocations(
      Number(page),
      Number(limit),
    );
  }

  @Get('upcoming')
  @ApiOperation({
    summary: 'Get upcoming drives',
  })
  async getUpcomingDrives() {
    return this.driveService.getUpcomingDrives();
  }

  @Get('date/:date')
  @ApiOperation({
    summary: 'Get drives by date',
  })
  async findByDate(
    @Param('date') date: string,
  ) {
    return this.driveService.findByDate(
      date,
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get drive by ID',
  })
  async findOne(
    @Param('id', ParseIntPipe)
    id: number,
  ) {
    return this.driveService.findOne(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin, Role.SuperAdmin)
  @Patch(':id/complete')
  @ApiOperation({
    summary: 'Mark drive as completed',
    description: 'Admin only',
  })
  completeDrive(
    @Param('id', ParseIntPipe)
    id: number,
  ) {
    return this.driveService.completeDrive(id);
  }
}