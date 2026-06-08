import {
  Controller,
  Get,
  Post,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';

import { CertificateService } from './certificate.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth-guard';

@Controller('certificate')
export class CertificateController {
  constructor(
    private readonly certificateService: CertificateService,
  ) { }

  @UseGuards(JwtAuthGuard)
  @Post('generate/:driveId')
  generateCertificates(
    @Param('driveId') driveId: string,
  ) {
    return this.certificateService.generateCertificates(
      Number(driveId),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('my-certificates')
  getMyCertificates(
    @Req() req: any,
  ) {
    return this.certificateService.getMyCertificates(
      req.user.id,
    );
  }
}