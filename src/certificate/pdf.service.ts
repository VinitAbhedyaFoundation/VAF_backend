
import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  PDFDocument,
  rgb,
  StandardFonts,
} from 'pdf-lib';
import { randomUUID } from 'crypto';

import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  async generateCertificate(
    volunteerName: string,
    driveName: string,
    driveDate: Date,
    location: string,
    templatePath: string,
  ): Promise<string> {
    try {
      if (!fs.existsSync(templatePath)) {
        throw new Error(`Template not found: ${templatePath}`);
      }

      const templateBytes =
        await fs.promises.readFile(templatePath);

      const isPng =
        templateBytes.length >= 8 &&
        templateBytes.subarray(0, 8).equals(
          Buffer.from([
            0x89, 0x50, 0x4e, 0x47,
            0x0d, 0x0a, 0x1a, 0x0a,
          ]),
        );

      const isJpeg =
        templateBytes.length >= 3 &&
        templateBytes[0] === 0xff &&
        templateBytes[1] === 0xd8 &&
        templateBytes[2] === 0xff;

      if (!isPng && !isJpeg) {
        throw new BadRequestException(
          'Certificate template must be a PNG or JPEG image',
        );
      }

      const pdfDoc = await PDFDocument.create();

      const image = isPng
        ? await pdfDoc.embedPng(templateBytes)
        : await pdfDoc.embedJpg(templateBytes);

      const page = pdfDoc.addPage([
        image.width,
        image.height,
      ]);

      page.drawImage(image, {
        x: 0,
        y: 0,
        width: image.width,
        height: image.height,
      });

      const font = await pdfDoc.embedFont(
        StandardFonts.HelveticaBold,
      );

      const name = volunteerName.toUpperCase();
      const fontSize = 30;

      const textWidth = font.widthOfTextAtSize(
        name,
        fontSize,
      );

      const centerX = (image.width - textWidth) / 2;

      page.drawText(name, {
        x: centerX,
        y: 510,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });

      const issuedDate = driveDate.toLocaleDateString(
        'en-IN',
        {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        },
      );

      page.drawText(issuedDate, {
        x: 1235,
        y: 932,
        size: 14,
        font,
        color: rgb(0, 0, 0),
      });

      page.drawText(location, {
        x: 500,
        y: 140,
        size: 16,
        font,
        color: rgb(0, 0.3, 0),
      });

      const pdfBytes = await pdfDoc.save();

      const tempDir = path.join(
        process.cwd(),
        'temp',
      );

      await fs.promises.mkdir(tempDir, {
        recursive: true,
      });

      const outputPath = path.join(
        tempDir,
        `${randomUUID()}.pdf`,
      );

      await fs.promises.writeFile(
        outputPath,
        pdfBytes,
      );

      this.logger.log(
        `Certificate generated for ${volunteerName}`,
      );

      return outputPath;
    } catch (error) {
      this.logger.error(
        `Certificate generation failed for ${volunteerName}`,
        error instanceof Error
          ? error.stack
          : String(error),
      );

      throw error;
    }
  }
}
