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
  private readonly logger = new Logger(CertificateService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly pdfService: PdfService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async generateCertificates(driveId: number) {
    const drive = await this.db.drive.findUnique({
      where: { id: driveId },
    });

    if (!drive) {
      throw new NotFoundException('Drive not found');
    }

    const participants = await this.db.participation.findMany({
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
      let pdfPath: string | null = null;

      try {
        const existingCertificate =
          await this.db.certificate.findFirst({
            where: {
              userId: participant.userId,
              driveId,
            },
          });

        if (existingCertificate) {
          skipped++;
          continue;
        }

        this.logger.log(
          `Generating certificate for ${participant.user.name}`,
        );

        pdfPath = await this.pdfService.generateCertificate(
          participant.user.name,
          participant.drive.title ?? 'Drive',
          participant.drive.date,
          participant.drive.driveLocation?.location ??
            'Location Not Specified',
          getTemplatePath(
            participant.drive.title ?? 'Drive',
          ),
        );

        const upload =
          await this.cloudinaryService.uploadFile(pdfPath);

        if (!upload?.public_id) {
          throw new Error(
            'Cloudinary upload failed.',
          );
        }

        const downloadUrl =
          `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}` +
          `/image/upload/fl_attachment/v${upload.version}/${upload.public_id}.${upload.format}`;

        await this.db.certificate.create({
          data: {
            userId: participant.userId,
            driveId,
            fileUrl: downloadUrl,
          },
        });

        created++;

        this.logger.log(
          `Certificate generated successfully for ${participant.user.name}`,
        );
      } catch (error) {
        failed++;

        this.logger.error(
          `Failed to generate certificate for User ID: ${participant.userId}`,
          error instanceof Error
            ? error.stack
            : String(error),
        );

        continue;
      } finally {
        if (pdfPath) {
          try {
            await fs.unlink(pdfPath);
          } catch {
            this.logger.warn(
              `Unable to delete temporary PDF: ${pdfPath}`,
            );
          }
        }
      }
    }

    if (created > 0) {
      await this.db.drive.update({
        where: { id: driveId },
        data: {
          certificateIssued: true,
        },
      });
    }

    this.logger.log(
      `Certificate generation completed. Created: ${created}, Skipped: ${skipped}, Failed: ${failed}`,
    );

    return {
      message: 'Certificates generated successfully',
      created,
      skipped,
      failed,
    };
  }

  async getMyCertificates(userId: number) {
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