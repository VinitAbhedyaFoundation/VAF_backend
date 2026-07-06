import {
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { v2 as cloudinary } from 'cloudinary';

import { CloudinaryService } from './cloudinary.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth-guard';

@ApiTags('Cloudinary')
@ApiBearerAuth()
@Controller('cloudinary')
@UseGuards(JwtAuthGuard)
export class CloudinaryController {
  constructor(
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @Get('ping')
  @ApiOperation({
    summary: 'Check Cloudinary connection',
  })
  async ping() {
    return cloudinary.api.ping();
  }

  @Post('test')
  @ApiOperation({
    summary: 'Upload test PDF',
  })
  async testUpload() {
    return this.cloudinaryService.uploadFile(
      './test.pdf',
    );
  }
}