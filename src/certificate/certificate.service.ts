import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { DatabaseService } from '../database/database.service';
import { PdfService } from './pdf.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { getTemplatePath } from './template.helper';

import { v2 as cloudinary } from 'cloudinary';

import * as fs from 'fs/promises';

@Injectable()
export class CertificateService {
  private readonly logger = new Logger(
    CertificateService.name,
  );

  constructor(
    private readonly db: DatabaseService,
    private readonly pdfService: PdfService,
    private readonly cloudinaryService: CloudinaryService,
  ) { }

  // =========================================================
  // EXISTING CERTIFICATE GENERATION
  // =========================================================

  async generateCertificates(driveId: number) {
    const drive = await this.db.drive.findUnique({
      where: { id: driveId },
    });

    if (!drive) {
      throw new NotFoundException('Drive not found');
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

        pdfPath =
          await this.pdfService.generateCertificate(
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
          await this.cloudinaryService.uploadFile(
            pdfPath,
          );

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

  // =========================================================
  // GET LOGGED-IN USER CERTIFICATES
  // =========================================================

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

  // =========================================================
  // UPLOAD CERTIFICATE TEMPLATE
  // =========================================================

  async uploadTemplate(
  file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
  },
  name?: string,
) {
    if (!file) {
      throw new BadRequestException(
        'Template file is required',
      );
    }

    const templateName =
      name?.trim() ||
      file.originalname.replace(/\.[^/.]+$/, '');

    if (!templateName) {
      throw new BadRequestException(
        'Template name is required',
      );
    }

    try {
      this.logger.log(
        `Uploading certificate template: ${templateName}`,
      );

      const upload =
        await this.cloudinaryService.uploadTemplateBuffer(
          file.buffer,
          file.originalname,
        );

      if (
        !upload?.secure_url ||
        !upload?.public_id
      ) {
        throw new Error(
          'Cloudinary upload failed',
        );
      }

      const template =
        await this.db.certificateTemplate.create({
          data: {
            name: templateName,
            fileUrl: upload.secure_url,
            publicId: upload.public_id,
          },
        });

      this.logger.log(
        `Certificate template uploaded successfully: ${template.name}`,
      );

      return {
        message:
          'Certificate template uploaded successfully',
        template,
      };
    } catch (error) {
      this.logger.error(
        'Failed to upload certificate template',
        error instanceof Error
          ? error.stack
          : String(error),
      );

      throw error;
    }
  }

  // =========================================================
  // GET ALL CERTIFICATE TEMPLATES
  // =========================================================

  async getTemplates() {
    return this.db.certificateTemplate.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  // =========================================================
  // DELETE CERTIFICATE TEMPLATE
  // =========================================================

  async deleteTemplate(id: number) {
    const template =
      await this.db.certificateTemplate.findUnique({
        where: {
          id,
        },
      });

    if (!template) {
      throw new NotFoundException(
        'Certificate template not found',
      );
    }

    try {
      await cloudinary.uploader.destroy(
        template.publicId,
        {
          resource_type: 'image',
        },
      );

      this.logger.log(
        `Cloudinary template deleted: ${template.publicId}`,
      );
    } catch (error) {
      this.logger.warn(
        `Could not delete template from Cloudinary: ${template.publicId}`,
      );
    }

    await this.db.certificateTemplate.delete({
      where: {
        id,
      },
    });

    return {
      message:
        'Certificate template deleted successfully',
    };
  }
}