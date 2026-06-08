import { Injectable, Logger } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import * as fs from 'fs';

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(
    CloudinaryService.name,
  );

  constructor() {
    cloudinary.config({
      cloud_name:
        process.env.CLOUDINARY_CLOUD_NAME,
      api_key:
        process.env.CLOUDINARY_API_KEY,
      api_secret:
        process.env.CLOUDINARY_API_SECRET,
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
        'Cloudinary upload failed',
        error,
      );

      throw error;
    }
  }
}