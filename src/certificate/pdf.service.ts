import { Injectable } from '@nestjs/common';
import {
  PDFDocument,
  rgb,
  StandardFonts,
} from 'pdf-lib';

import * as fs from 'fs';

@Injectable()
export class PdfService {
  async generateCertificate(
    volunteerName: string,
    driveName: string,
    driveDate: Date,
    location: string,
    templatePath: string,
  ) {
    console.log(
      'Template path:',
      templatePath,
    );

    console.log(
      'Template exists:',
      fs.existsSync(templatePath),
    );

    if (!fs.existsSync(templatePath)) {
      throw new Error(
        `Template not found: ${templatePath}`,
      );
    }

    const templateBytes =
      fs.readFileSync(templatePath);

    console.log(
      'Template loaded:',
      templateBytes.length,
      'bytes',
    );

    const pdfDoc =
      await PDFDocument.create();

    console.log(
      'PDF document created',
    );

    console.log(
      'Embedding PNG...',
    );

    const image =
      await pdfDoc.embedPng(
        templateBytes,
      );

    console.log(
      'PNG embedded successfully',
    );

    const page =
      pdfDoc.addPage([
        image.width,
        image.height,
      ]);

    page.drawImage(image, {
      x: 0,
      y: 0,
      width: image.width,
      height: image.height,
    });

    const font =
      await pdfDoc.embedFont(
        StandardFonts.HelveticaBold,
      );

    const name =
      volunteerName.toUpperCase();

    const fontSize = 30;

    const textWidth =
      font.widthOfTextAtSize(
        name,
        fontSize,
      );

    const centerX =
      (image.width - textWidth) / 2;

    page.drawText(name, {
      x: centerX,
      y: 510,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    });

    const issuedDate =
      driveDate.toLocaleDateString(
        'en-IN',
        {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        },
      );

    page.drawText(
      issuedDate,
      {
        x: 1235,
        y: 932,
        size: 14,
        font,
        color: rgb(0, 0, 0),
      },
    );

    page.drawText(
      location,
      {
        x: 500,
        y: 140,
        size: 16,
        font,
        color: rgb(0, 0.3, 0),
      },
    );

    const pdfBytes =
      await pdfDoc.save();

    console.log(
      'PDF saved:',
      pdfBytes.length,
      'bytes',
    );

    if (!fs.existsSync('temp')) {
      fs.mkdirSync('temp');
      console.log(
        'Created temp directory',
      );
    }

    const fileName =
      volunteerName
        .replace(/\s+/g, '-')
        .toLowerCase();

    const outputPath =
      `temp/${fileName}.pdf`;

    fs.writeFileSync(
      outputPath,
      pdfBytes,
    );

    console.log(
      'Output path:',
      outputPath,
    );

    const verifyPdf =
      await PDFDocument.load(
        pdfBytes,
      );

    console.log(
      'PDF verified successfully',
      verifyPdf.getPageCount(),
      'page(s)',
    );

    return outputPath;
  }
}