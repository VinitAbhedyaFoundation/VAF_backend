import {
  BadRequestException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { FileInterceptor } from '@nestjs/platform-express';

import { CertificateService } from './certificate.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth-guard';

@ApiTags('Certificate')
@ApiBearerAuth()
@Controller('certificate')
@UseGuards(JwtAuthGuard)
export class CertificateController {
  constructor(
    private readonly certificateService: CertificateService,
  ) {}

  @Post('generate/:driveId')
  @ApiOperation({
    summary: 'Generate certificates for a drive',
    description:
      'Generates certificates for all approved participants of the specified drive.',
  })
  generateCertificates(
    @Param('driveId', ParseIntPipe)
    driveId: number,
  ) {
    return this.certificateService.generateCertificates(
      driveId,
    );
  }

  @Get('my-certificates')
  @ApiOperation({
    summary: 'Get logged-in user certificates',
    description:
      'Returns all certificates of the authenticated user.',
  })
  getMyCertificates(
    @Req() req: any,
  ) {
    return this.certificateService.getMyCertificates(
      req.user.id,
    );
  }

  @Post('templates')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Upload certificate template',
  })
  async uploadTemplate(
    @UploadedFile()
file: {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
},
    @Req() req: any,
  ) {
    if (
      !['Admin', 'SuperAdmin'].includes(
        req.user.role,
      )
    ) {
      throw new ForbiddenException(
        'Only admins can upload certificate templates',
      );
    }

    if (!file) {
      throw new BadRequestException(
        'Certificate template file is required',
      );
    }

    const allowedTypes = [
      'image/png',
      'image/jpeg',
      'image/jpg',
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Only PNG and JPG/JPEG certificate templates are supported',
      );
    }

    return this.certificateService.uploadTemplate(
      file,
      req.body.name,
    );
  }

  @Get('templates')
  @ApiOperation({
    summary: 'Get certificate templates',
  })
  async getTemplates(@Req() req: any) {
    if (
      !['Admin', 'SuperAdmin'].includes(
        req.user.role,
      )
    ) {
      throw new ForbiddenException(
        'Only admins can view certificate templates',
      );
    }

    return this.certificateService.getTemplates();
  }

  @Delete('templates/:id')
  @ApiOperation({
    summary: 'Delete certificate template',
  })
  async deleteTemplate(
    @Param('id', ParseIntPipe)
    id: number,
    @Req() req: any,
  ) {
    if (
      !['Admin', 'SuperAdmin'].includes(
        req.user.role,
      )
    ) {
      throw new ForbiddenException(
        'Only admins can delete certificate templates',
      );
    }

    return this.certificateService.deleteTemplate(
      id,
    );
  }
}