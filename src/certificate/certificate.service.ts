import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { DatabaseService } from '../database/database.service';
import { PdfService } from './pdf.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { getTemplatePath } from './template.helper';

import * as fs from 'fs/promises';

@Injectable()
export class CertificateService {
  private readonly logger = new Logger(
    CertificateService.name,
  );

  constructor(
    private db: DatabaseService,
    private pdfService: PdfService,
    private cloudinaryService: CloudinaryService,
  ) {}

  async generateCertificates(
    driveId: number,
  ) {
    const drive =
      await this.db.drive.findUnique({
        where: {
          id: driveId,
        },
      });

    if (!drive) {
      throw new NotFoundException(
        'Drive not found',
      );
    }

    const participants =
      await this.db.participation.findMany({
        where: {
          driveId,
          status: 'Approved',
        },
        include: {
          user: true,
          drive: {
            include: {
              driveLocation: true,
            },
          },
        },
      });

    let created = 0;
    let skipped = 0;
    let failed = 0;

    for (const participant of participants) {
      try {
        const exists =
          await this.db.certificate.findFirst({
            where: {
              userId: participant.userId,
              driveId,
            },
          });

        if (exists) {
          skipped++;
          continue;
        }

        const pdfPath =
          await this.pdfService.generateCertificate(
            participant.user.name,
            participant.drive.title ?? 'Drive',
            participant.drive.date,
            participant.drive.driveLocation
              ?.location ??
              'Location Not Specified',
            getTemplatePath(
              participant.drive.title ?? '',
            ),
          );

        const upload =
          await this.cloudinaryService.uploadFile(
            pdfPath,
          );

        await this.db.certificate.create({
          data: {
            userId: participant.userId,
            driveId,
            fileUrl: upload.secure_url,
          },
        });

        await fs.unlink(pdfPath);

        created++;
      } catch (error) {
        failed++;

        this.logger.error(
          `Certificate generation failed for user ${participant.userId}`,
          error,
        );
      }
    }

    if (created > 0) {
      await this.db.drive.update({
        where: {
          id: driveId,
        },
        data: {
          certificateIssued: true,
        },
      });
    }

    return {
      message:
        'Certificates generated successfully',
      created,
      skipped,
      failed,
    };
  }

  async getMyCertificates(
    userId: number,
  ) {
    return this.db.certificate.findMany({
      where: {
        userId,
      },
      include: {
        drive: true,
      },
      orderBy: {
        issuedAt: 'desc',
      },
    });
  }
}