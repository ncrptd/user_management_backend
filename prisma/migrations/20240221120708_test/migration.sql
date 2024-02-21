/*
  Warnings:

  - You are about to drop the column `uploadTimestamp` on the `FileUpload` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "FileUpload" DROP COLUMN "uploadTimestamp";
