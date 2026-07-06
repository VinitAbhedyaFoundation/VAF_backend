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
}