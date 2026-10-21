import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';

import { Prisma } from '@prisma/client';
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
  ) { }

  async generateCertificates(driveId: number) {
    const drive = await this.db.drive.findUnique({
      where: { id: driveId },
      include: { driveLocation: true },
    });

    if (!drive) {
      throw new NotFoundException('Drive not found');
    }

    if (!drive.completed) {
      throw new BadRequestException(
        'Certificates can only be generated for completed drives',
      );
    }

    const participants = await this.db.participation.findMany({
      where: {
        driveId,
        status: 'Approved',
      },
      include: {
        user: true,
      },
    });

    let created = 0;
    let skipped = 0;
    let failed = 0;

    for (const participant of participants) {
      let pdfPath: string | null = null;
      let uploadedPublicId: string | null = null;

      try {
        const existing = await this.db.certificate.findUnique({
          where: {
            userId_driveId: {
              userId: participant.userId,
              driveId,
            },
          },
        });

        if (existing) {
          skipped++;
          continue;
        }

        pdfPath = await this.pdfService.generateCertificate(
          participant.user.name,
          drive.title ?? 'Drive',
          drive.date,
          drive.driveLocation.location,
          getTemplatePath(drive.title ?? 'Drive'),
        );

        const upload = await this.cloudinaryService.uploadFile(pdfPath);

        uploadedPublicId = upload?.public_id ?? null;

        if (!upload?.public_id || !upload?.secure_url) {
          throw new Error(
            'Cloudinary upload did not return a valid file URL',
          );
        }

        const downloadUrl = upload.secure_url;

        await this.db.certificate.create({
          data: {
            userId: participant.userId,
            driveId,
            fileUrl: downloadUrl,
          },
        });

        uploadedPublicId = null;
        created++;

        this.logger.log(
          `Certificate generated for user ${participant.userId}, drive ${driveId}`,
        );

      } catch (error) {
        const isDuplicate =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002';

        // Clean up any uploaded file if the database insert failed.
        if (uploadedPublicId) {
          try {
            await this.cloudinaryService.deleteCertificate(
              uploadedPublicId,
            );
          } catch (cleanupError) {
            this.logger.error(
              `Could not clean up uploaded certificate ${uploadedPublicId}`,
              cleanupError instanceof Error
                ? cleanupError.stack
                : String(cleanupError),
            );
          }
        }

        if (isDuplicate) {
          skipped++;
          continue;
        }

        failed++;

        this.logger.error(
          `Certificate generation failed for user ${participant.userId}, drive ${driveId}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
      finally {
        if (pdfPath) {
          try {
            await fs.unlink(pdfPath);
          } catch (error) {
            this.logger.warn(
              `Unable to remove temporary PDF ${pdfPath}: ${error instanceof Error ? error.message : String(error)
              }`,
            );
          }
        }
      }
    }

    if (created > 0) {
      await this.db.drive.update({
        where: { id: driveId },
        data: { certificateIssued: true },
      });
    }

    this.logger.log(
      `Certificate generation completed. Created: ${created}, Skipped: ${skipped}, Failed: ${failed}`,
    );

    return {
      message: 'Certificate generation completed',
      created,
      skipped,
      failed,
    };
  }

  async getMyCertificates(userId: number) {
    return this.db.certificate.findMany({
      where: { userId },
      include: { drive: true },
      orderBy: { issuedAt: 'desc' },
    });
  }

  async uploadTemplate(
    file: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
    },
    name?: string,
  ) {
    if (!file) {
      throw new BadRequestException('Template file is required');
    }

    const templateName =
      name?.trim() ||
      file.originalname.replace(/\.[^/.]+$/, '');

    if (!templateName) {
      throw new BadRequestException('Template name is required');
    }

    const upload = await this.cloudinaryService.uploadTemplateBuffer(
      file.buffer,
      file.originalname,
    );

    if (!upload?.secure_url || !upload?.public_id) {
      throw new ServiceUnavailableException(
        'Cloudinary did not confirm the template upload',
      );
    }

    try {
      const template = await this.db.certificateTemplate.create({
        data: {
          name: templateName,
          fileUrl: upload.secure_url,
          publicId: upload.public_id,
        },
      });

      this.logger.log(`Certificate template uploaded: ${template.name}`);

      return {
        message: 'Certificate template uploaded successfully',
        template,
      };
    } catch (error) {
      // Compensate for a successful cloud upload if database persistence fails.
      try {
        await this.cloudinaryService.deleteTemplate(upload.public_id);
      } catch (cleanupError) {
        this.logger.error(
          `Template upload cleanup failed for ${upload.public_id}`,
          cleanupError instanceof Error
            ? cleanupError.stack
            : String(cleanupError),
        );
      }

      throw error;
    }
  }

  async getTemplates() {
    return this.db.certificateTemplate.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteTemplate(id: number) {
    const template = await this.db.certificateTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException('Certificate template not found');
    }

    try {
      await this.cloudinaryService.deleteTemplate(template.publicId);
    } catch (error) {
      this.logger.error(
        `Template ${id} was retained because Cloudinary deletion failed`,
        error instanceof Error ? error.stack : String(error),
      );

      throw new ServiceUnavailableException(
        'Could not delete the template from storage. The template record was retained; please retry.',
      );
    }

    await this.db.certificateTemplate.delete({
      where: { id },
    });

    return {
      message: 'Certificate template deleted successfully',
    };
  }
}