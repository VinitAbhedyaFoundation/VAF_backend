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
            resource_type: 'auto',
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
        .replace(/[^a-zA-Z0-9-_]/g, '-');

      const publicId = `${baseName}-${Date.now()}`;

      const uploadStream =
        cloudinary.uploader.upload_stream(
          {
            resource_type: 'image',
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
}