import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import * as fs from 'fs';

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(
    CloudinaryService.name,
  );

  constructor(
    private readonly configService: ConfigService,
  ) {
    cloudinary.config({
      cloud_name: this.configService.get<string>(
        'CLOUDINARY_CLOUD_NAME',
      ),
      api_key: this.configService.get<string>(
        'CLOUDINARY_API_KEY',
      ),
      api_secret: this.configService.get<string>(
        'CLOUDINARY_API_SECRET',
      ),
    });
  }

  async uploadFile(filePath: string) {
    if (!fs.existsSync(filePath)) {
      throw new Error(
        `File not found: ${filePath}`,
      );
    }

    try {
      this.logger.log(
        `Uploading file: ${filePath}`,
      );

      const result =
        await cloudinary.uploader.upload(
          filePath,
          {
            resource_type: 'raw',
            folder: 'vaf-certificates',
          },
        );

      this.logger.log(
        `Upload successful: ${result.secure_url}`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Cloudinary upload failed for file: ${filePath}`,
        error instanceof Error
          ? error.stack
          : String(error),
      );

      throw error;
    }
  }

  async uploadTemplateBuffer(
    buffer: Buffer,
    originalName: string,
  ) {
    return new Promise<any>((resolve, reject) => {
      const baseName = originalName
        .replace(/\.[^/.]+$/, '')
        .replace(/[^a-zA-Z0-9_-]/g, '-');

      const publicId = `${baseName}-${Date.now()}`;

      const uploadStream =
        cloudinary.uploader.upload_stream(
          {
            resource_type: 'raw',
            folder: 'vaf-certificate-templates',
            public_id: publicId,
          },
          (error, result) => {
            if (error) {
              this.logger.error(
                'Certificate template upload failed',
                error instanceof Error
                  ? error.stack
                  : String(error),
              );

              reject(error);
              return;
            }

            resolve(result);
          },
        );

      uploadStream.end(buffer);
    });
  }

  async deleteTemplate(publicId: string) {
    try {
      const result = await cloudinary.uploader.destroy(
        publicId,
        {
          resource_type: 'image',
          invalidate: true,
        },
      );

      if (!['ok', 'not found'].includes(result.result)) {
        throw new Error(
          `Cloudinary deletion was not confirmed: ${result.result}`,
        );
      }

      this.logger.log(
        `Cloudinary template deletion result: ${result.result} (${publicId})`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to delete Cloudinary template: ${publicId}`,
        error instanceof Error ? error.stack : String(error),
      );

      throw error;
    }
  }

  async deleteCertificate(publicId: string) {
    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: 'image',
        invalidate: true,
      });

      if (!['ok', 'not found'].includes(result.result)) {
        throw new Error(
          `Cloudinary certificate deletion was not confirmed: ${result.result}`,
        );
      }

      this.logger.log(
        `Cloudinary certificate deletion result: ${result.result} (${publicId})`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to delete Cloudinary certificate: ${publicId}`,
        error instanceof Error ? error.stack : String(error),
      );

      throw error;
    }
  }
  async ping() {
  return cloudinary.api.ping();
}
}