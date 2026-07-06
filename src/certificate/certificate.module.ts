import { Module } from '@nestjs/common';

import { CertificateController } from './certificate.controller';
import { CertificateService } from './certificate.service';
import { PdfService } from './pdf.service';

import { DatabaseModule } from '../database/database.module';
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
  exports: [
    CertificateService,
  ],
})
export class CertificateModule {}