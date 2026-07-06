import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

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
}