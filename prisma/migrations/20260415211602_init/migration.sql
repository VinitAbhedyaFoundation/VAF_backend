-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('Male', 'Female', 'Other');

-- CreateEnum
CREATE TYPE "Occupation" AS ENUM ('Student', 'WorkingProfessional', 'Other');

-- CreateEnum
CREATE TYPE "BloodGroup" AS ENUM ('A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE', 'AB_POSITIVE', 'AB_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('User', 'Admin', 'SuperAdmin');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "parentNumber" TEXT NOT NULL,
    "bloodGroup" "BloodGroup" NOT NULL,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "gender" "Gender" NOT NULL,
    "occupation" "Occupation" NOT NULL,
    "highestQualification" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT,
    "state" TEXT,
    "collegeOrCompany" TEXT,
    "role" "Role" NOT NULL,
    "drivesCount" INTEGER NOT NULL DEFAULT 0,
    "ploggerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Drive" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "totalHours" INTEGER NOT NULL,
    "volunteerCount" INTEGER NOT NULL DEFAULT 0,
    "temporaryToken" TEXT NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "locationId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Drive_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriveLocation" (
    "id" SERIAL NOT NULL,
    "location" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriveLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_DriveUsers" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_ploggerId_key" ON "User"("ploggerId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Drive_temporaryToken_key" ON "Drive"("temporaryToken");

-- CreateIndex
CREATE INDEX "Drive_locationId_idx" ON "Drive"("locationId");

-- CreateIndex
CREATE INDEX "Drive_temporaryToken_idx" ON "Drive"("temporaryToken");

-- CreateIndex
CREATE UNIQUE INDEX "DriveLocation_location_key" ON "DriveLocation"("location");

-- CreateIndex
CREATE UNIQUE INDEX "_DriveUsers_AB_unique" ON "_DriveUsers"("A", "B");

-- CreateIndex
CREATE INDEX "_DriveUsers_B_index" ON "_DriveUsers"("B");

-- AddForeignKey
ALTER TABLE "Drive" ADD CONSTRAINT "Drive_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "DriveLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DriveUsers" ADD CONSTRAINT "_DriveUsers_A_fkey" FOREIGN KEY ("A") REFERENCES "Drive"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DriveUsers" ADD CONSTRAINT "_DriveUsers_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
