-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('RUNNING', 'WAITING_FOR_USER', 'COMPLETED', 'FAILED');

-- AlterTable: make password nullable, add githubId and githubLogin
ALTER TABLE "User" ALTER COLUMN "password" DROP NOT NULL;
ALTER TABLE "User" ADD COLUMN "githubId" TEXT;
ALTER TABLE "User" ADD COLUMN "githubLogin" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_githubId_key" ON "User"("githubId");

-- AlterTable: convert Job.status from TEXT to JobStatus enum
ALTER TABLE "Job" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Job" ALTER COLUMN "status" TYPE "JobStatus" USING (
  CASE "status"
    WHEN 'PENDING' THEN 'RUNNING'::"JobStatus"
    WHEN 'RUNNING' THEN 'RUNNING'::"JobStatus"
    WHEN 'COMPLETED' THEN 'COMPLETED'::"JobStatus"
    WHEN 'FAILED' THEN 'FAILED'::"JobStatus"
    WHEN 'WAITING_FOR_USER' THEN 'WAITING_FOR_USER'::"JobStatus"
    ELSE 'RUNNING'::"JobStatus"
  END
);
