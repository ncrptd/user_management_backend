/*
  Warnings:

  - Added the required column `templateData` to the `FileUpload` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "FileUpload" ADD COLUMN     "templateData" JSONB NOT NULL;
