-- CreateTable
CREATE TABLE "Participation" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "driveId" INTEGER NOT NULL,
    "hours" INTEGER NOT NULL DEFAULT 0,
    "waste" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Participation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Participation_userId_idx" ON "Participation"("userId");

-- CreateIndex
CREATE INDEX "Participation_driveId_idx" ON "Participation"("driveId");

-- CreateIndex
CREATE UNIQUE INDEX "Participation_userId_driveId_key" ON "Participation"("userId", "driveId");

-- AddForeignKey
ALTER TABLE "Participation" ADD CONSTRAINT "Participation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participation" ADD CONSTRAINT "Participation_driveId_fkey" FOREIGN KEY ("driveId") REFERENCES "Drive"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
