/*
  Warnings:

  - You are about to drop the column `drivescount` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `ploggersid` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `Admin` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_DriveUser` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[temporaryToken]` on the table `Drive` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[ploggerId]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `Drive` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `DriveLocation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ploggerId` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'User';

-- DropForeignKey
ALTER TABLE "_DriveUser" DROP CONSTRAINT "_DriveUser_A_fkey";

-- DropForeignKey
ALTER TABLE "_DriveUser" DROP CONSTRAINT "_DriveUser_B_fkey";

-- DropIndex
DROP INDEX "User_ploggersid_key";

-- AlterTable
ALTER TABLE "Drive" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "DriveLocation" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "drivescount",
DROP COLUMN "ploggersid",
ADD COLUMN     "drivesCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ploggerId" TEXT NOT NULL,
ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'User';

-- DropTable
DROP TABLE "Admin";

-- DropTable
DROP TABLE "_DriveUser";

-- CreateTable
CREATE TABLE "_DriveUsers" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_DriveUsers_AB_unique" ON "_DriveUsers"("A", "B");

-- CreateIndex
CREATE INDEX "_DriveUsers_B_index" ON "_DriveUsers"("B");

-- CreateIndex
CREATE UNIQUE INDEX "Drive_temporaryToken_key" ON "Drive"("temporaryToken");

-- CreateIndex
CREATE INDEX "Drive_locationId_idx" ON "Drive"("locationId");

-- CreateIndex
CREATE INDEX "Drive_temporaryToken_idx" ON "Drive"("temporaryToken");

-- CreateIndex
CREATE UNIQUE INDEX "User_ploggerId_key" ON "User"("ploggerId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- AddForeignKey
ALTER TABLE "_DriveUsers" ADD CONSTRAINT "_DriveUsers_A_fkey" FOREIGN KEY ("A") REFERENCES "Drive"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DriveUsers" ADD CONSTRAINT "_DriveUsers_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
