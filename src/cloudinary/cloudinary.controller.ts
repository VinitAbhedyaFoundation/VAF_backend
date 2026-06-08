import { Controller, Get, Post } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryService } from './cloudinary.service';

@Controller('cloudinary')
export class CloudinaryController {
  constructor(
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @Get('ping')
  async ping() {
    return cloudinary.api.ping();
  }

  @Post('test')
  async testUpload() {
    return this.cloudinaryService.uploadFile(
      './test.pdf',
    );
  }
}