import { Controller, Get, Post, Body, Patch, Param } from '@nestjs/common';
import { DriveService } from './drive.service';
import { CreateDriveDto } from './dto/create-drive.dto';
import { CreateDriveLocationDto } from './dto/drive-location.dto';
import { UpdateDriveDto } from './dto/update-drive.dto';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Drive')
@Controller('drive')
export class DriveController {
  constructor(private readonly driveService: DriveService) {}

  // ================= ADMIN ROUTES =================

  @ApiBearerAuth()
  @Post('newdrive')
  @ApiOperation({
    description: 'Create a new drive',
    summary: 'Input - all details of drive + admin Token , output - Drive details',
  })
  async createDrive(@Body() createDriveDto: CreateDriveDto) {
    return this.driveService.createDrive(createDriveDto);
  }

  @ApiBearerAuth()
  @Post('newlocation')
  @ApiOperation({
    description: 'Create a new Location',
    summary: 'Input - location + admin Token , output - Location Id',
  })
  async createDriveLocation(@Body() createDriveLocationData: CreateDriveLocationDto) {
    return this.driveService.createDriveLocation(createDriveLocationData);
  }

  @ApiBearerAuth()
  @Get('alllocations')
  @ApiOperation({
    description: 'Get all Locations',
    summary: 'Input - admin Token , output - All Locations',
  })
  async getAllLocations() {
    return this.driveService.findAllLocations();
  }

  @ApiBearerAuth()
  @Get('alldrives')
  @ApiOperation({
    description: 'Get all Drives',
    summary: 'Input - admin Token , output - All Drives with location details',
  })
  async getAllDrives() {
    return this.driveService.findAllDrives();
  }

  // ================= PUBLIC ROUTES =================

  // ✅ IMPORTANT: Keep STATIC routes BEFORE dynamic (:id)

  @Get('upcoming')
  @ApiOperation({
    description: 'Get upcoming drives for users',
    summary: 'Public API - returns all future drives with location',
  })
  async getUpcomingDrives() {
    return this.driveService.getUpcomingDrives();
  }

  @Get('date/:date')
  @ApiOperation({
    description: 'Get Drive by Date',
    summary: 'Input - Date as param , output - Drive details',
  })
  async findByDate(@Param('date') date: string) {
    return this.driveService.findByDate(date);
  }

  // ================= DYNAMIC ROUTES (LAST) =================

  @ApiBearerAuth()
  @Get(':id')
  @ApiOperation({
    description: 'Get Drive by Id',
    summary: 'Input - Drive Id as param , output - Drive details',
  })
  async findOne(@Param('id') id: string) {
    return this.driveService.findOne(Number(id));
  }

  @ApiBearerAuth()
  @Patch(':id')
  @ApiOperation({
    description: 'Update Drive by Id',
    summary: 'Input - Drive Id + data , output - Updated Drive',
  })
  async update(@Param('id') id: string, @Body() updateDriveData: UpdateDriveDto) {
    return this.driveService.update(Number(id), updateDriveData);
  }
}