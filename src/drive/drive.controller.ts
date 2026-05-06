import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { DriveService } from './drive.service';
import { CreateDriveDto } from './dto/create-drive.dto';
import { CreateDriveLocationDto } from './dto/drive-location.dto';
import { UpdateDriveDto } from './dto/update-drive.dto';

import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

// ✅ NEW AUTH SYSTEM
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth-guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';

@ApiTags('Drive')
@Controller('drive')
export class DriveController {
  constructor(private readonly driveService: DriveService) {}

  // 🔐 ================= ADMIN ROUTES =================

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin', 'SuperAdmin')
  @Post('newdrive')
  @ApiOperation({
    description: 'Create a new drive',
    summary: 'Admin only',
  })
  createDrive(@Body() createDriveDto: CreateDriveDto) {
    return this.driveService.createDrive(createDriveDto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin', 'SuperAdmin')
  @Post('newlocation')
  @ApiOperation({
    description: 'Create a new location',
    summary: 'Admin only',
  })
  createDriveLocation(@Body() dto: CreateDriveLocationDto) {
    return this.driveService.createDriveLocation(dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Admin', 'SuperAdmin')
  @Patch(':id')
  @ApiOperation({
    description: 'Update drive',
    summary: 'Admin only',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDriveDto,
  ) {
    return this.driveService.update(id, dto);
  }

  // 👥 ================= PUBLIC / USER ROUTES =================

  @Get('alldrives')
  @ApiOperation({
    description: 'Get all drives (paginated)',
  })
  getAllDrives(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    return this.driveService.findAllDrives(+page, +limit);
  }

  @Get('alllocations')
  @ApiOperation({
    description: 'Get all locations',
  })
  getAllLocations(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    return this.driveService.findAllLocations(+page, +limit);
  }

  // ⚠️ IMPORTANT: SPECIFIC ROUTES FIRST
  @Get('date/:date')
  @ApiOperation({
    description: 'Get drives by date',
  })
  findByDate(@Param('date') date: string) {
    return this.driveService.findByDate(date);
  }

  @Get(':id')
  @ApiOperation({
    description: 'Get drive by ID',
  })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.driveService.findOne(id);
  }
}