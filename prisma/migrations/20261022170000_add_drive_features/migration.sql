-- Add the initiative enum
CREATE TYPE "Initiative" AS ENUM (
  'LAAL_BINDI',
  'SOCIAL_SHELF',
  'SAMBHAJINAGAR_PLOGGERS'
);

-- Add optional drive fields
ALTER TABLE "Drive"
ADD COLUMN "description" TEXT,
ADD COLUMN "initiative" "Initiative",
ADD COLUMN "driveResourcesUrl" TEXT,
ADD COLUMN "certificateTemplateId" INTEGER;

-- Index the new fields
CREATE INDEX "Drive_initiative_idx"
ON "Drive"("initiative");

CREATE INDEX "Drive_certificateTemplateId_idx"
ON "Drive"("certificateTemplateId");

-- Link drives to certificate templates
ALTER TABLE "Drive"
ADD CONSTRAINT "Drive_certificateTemplateId_fkey"
FOREIGN KEY ("certificateTemplateId")
REFERENCES "CertificateTemplate"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

-- Create guest volunteer attendance table
CREATE TABLE "GuestVolunteer" (
  "id" SERIAL NOT NULL,
  "driveId" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "hours" INTEGER NOT NULL DEFAULT 0,
  "waste" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "GuestVolunteer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GuestVolunteer_driveId_idx"
ON "GuestVolunteer"("driveId");

ALTER TABLE "GuestVolunteer"
ADD CONSTRAINT "GuestVolunteer_driveId_fkey"
FOREIGN KEY ("driveId")
REFERENCES "Drive"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;