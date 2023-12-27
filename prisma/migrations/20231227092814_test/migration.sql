-- CreateEnum
CREATE TYPE "UploadFolder" AS ENUM ('TEMPLATES', 'ANNUAL_REPORTS');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "uploadFolders" "UploadFolder";
