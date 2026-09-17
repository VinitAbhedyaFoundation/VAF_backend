import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { v2 as cloudinary } from "cloudinary";
import * as path from "path";
import * as fs from "fs";

const prisma = new PrismaClient();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const templates = [
  {
    name: "Blood Donation",
    file: "blood-donation-template.png",
  },
  {
    name: "Cloth Donation",
    file: "cloth-donation-template.png",
  },
  {
    name: "Tree Plantation",
    file: "tree-plantation-template.png",
  },
];

async function seedTemplates() {
  console.log("Starting certificate template import...");

  for (const template of templates) {
    const filePath = path.join(
      process.cwd(),
      "assets",
      "certificate-templates",
      template.file,
    );

    console.log(`\nProcessing: ${template.name}`);

    if (!fs.existsSync(filePath)) {
      console.error(
        `File not found: ${filePath}`,
      );
      continue;
    }

    // Check whether this template already exists
    const existing =
      await prisma.certificateTemplate.findFirst({
        where: {
          name: template.name,
        },
      });

    if (existing) {
      console.log(
        `Already exists in database: ${template.name}`,
      );
      continue;
    }

    // Upload to Cloudinary
    console.log("Uploading to Cloudinary...");

    const upload =
      await cloudinary.uploader.upload(
        filePath,
        {
          resource_type: "image",
          folder: "vaf-certificate-templates",
        },
      );

    if (!upload.secure_url || !upload.public_id) {
      throw new Error(
        `Cloudinary upload failed for ${template.name}`,
      );
    }

    console.log(
      `Cloudinary upload successful: ${upload.secure_url}`,
    );

    // Save in database
    const created =
      await prisma.certificateTemplate.create({
        data: {
          name: template.name,
          fileUrl: upload.secure_url,
          publicId: upload.public_id,
        },
      });

    console.log(
      `Database record created: ${created.name}`,
    );
  }

  console.log(
    "\nCertificate template import completed.",
  );
}

seedTemplates()
  .catch((error) => {
    console.error(
      "\nCertificate template import failed:",
      error,
    );
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });