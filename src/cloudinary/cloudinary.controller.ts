
import {
  Controller,
  Get,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

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
    try {
      return await this.cloudinaryService.ping();
    } catch {
      throw new ServiceUnavailableException(
        'Cloudinary is currently unavailable',
      );
    }
  }
}
