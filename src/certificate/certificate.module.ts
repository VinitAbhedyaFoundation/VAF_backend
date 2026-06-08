import { Module } from '@nestjs/common';

import { CertificateController } from './certificate.controller';
import { CertificateService } from './certificate.service';

import { DatabaseModule } from '../database/database.module';
import { PdfService } from './pdf.service';

import { CloudinaryModule } from '../cloudinary/cloudinary.module';

@Module({
  imports: [
    DatabaseModule,
    CloudinaryModule,
  ],
  controllers: [
    CertificateController,
  ],
  providers: [
    CertificateService,
    PdfService,
  ],
})
export class CertificateModule {}