
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

const MAX_TEMPLATE_SIZE = 5 * 1024 * 1024;

const ALLOWED_TEMPLATE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
];

@ApiTags('Certificate')
@ApiBearerAuth()
@Controller('certificate')
@UseGuards(JwtAuthGuard)
export class CertificateController {
  constructor(
    private readonly certificateService: CertificateService,
  ) { }

  private assertAdmin(user: any): void {
    if (!['Admin', 'SuperAdmin'].includes(user?.role)) {
      throw new ForbiddenException(
        'Only admins can perform this action',
      );
    }
  }

  @Post('generate/:driveId')
  @ApiOperation({
    summary: 'Generate certificates for a completed drive',
    description:
      'Generates certificates for eligible, approved participants of a completed drive. Admin and SuperAdmin access only.',
  })
  generateCertificates(
    @Param('driveId', ParseIntPipe) driveId: number,
    @Req() req: any,
  ) {
    this.assertAdmin(req.user);

    return this.certificateService.generateCertificates(driveId);
  }

  @Get('my-certificates')
  @ApiOperation({
    summary: 'Get logged-in user certificates',
    description:
      'Returns all certificates belonging to the authenticated user.',
  })
  getMyCertificates(@Req() req: any) {
    const userId = req.user?.sub;

    if (!userId) {
      throw new ForbiddenException(
        'Authenticated user ID is unavailable',
      );
    }

    return this.certificateService.getMyCertificates(userId);
  }

  @Post('templates')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: MAX_TEMPLATE_SIZE,
      },
    }),
  )
  @ApiOperation({
    summary: 'Upload certificate template',
    description:
      'Admin and SuperAdmin only. Accepts PNG or JPEG images up to 5 MB.',
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
    this.assertAdmin(req.user);

    if (!file) {
      throw new BadRequestException(
        'Certificate template file is required',
      );
    }

    if (!ALLOWED_TEMPLATE_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        'Only PNG and JPG/JPEG certificate templates are supported',
      );
    }

    const isPng =
      file.buffer.length >= 8 &&
      file.buffer.subarray(0, 8).equals(
        Buffer.from([
          0x89, 0x50, 0x4e, 0x47,
          0x0d, 0x0a, 0x1a, 0x0a,
        ]),
      );

    const isJpeg =
      file.buffer.length >= 3 &&
      file.buffer[0] === 0xff &&
      file.buffer[1] === 0xd8 &&
      file.buffer[2] === 0xff;

    const signatureMatchesMimeType =
      (file.mimetype === 'image/png' && isPng) ||
      (['image/jpeg', 'image/jpg'].includes(file.mimetype) &&
        isJpeg);

    if (!signatureMatchesMimeType) {
      throw new BadRequestException(
        'The uploaded file content does not match a supported image type',
      );
    }

    return this.certificateService.uploadTemplate(
      file,
      req.body?.name,
    );
  }

  @Get('templates')
  @ApiOperation({
    summary: 'Get certificate templates',
  })
  async getTemplates(@Req() req: any) {
    this.assertAdmin(req.user);

    return this.certificateService.getTemplates();
  }

  @Delete('templates/:id')
  @ApiOperation({
    summary: 'Delete certificate template',
  })
  async deleteTemplate(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
  ) {
    this.assertAdmin(req.user);

    return this.certificateService.deleteTemplate(id);
  }
}