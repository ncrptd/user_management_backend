/*
  Warnings:

  - You are about to drop the column `globalTemplate` on the `FileUpload` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "FileUpload" DROP COLUMN "globalTemplate",
ADD COLUMN     "isGlobalTemplate" BOOLEAN NOT NULL DEFAULT false;
