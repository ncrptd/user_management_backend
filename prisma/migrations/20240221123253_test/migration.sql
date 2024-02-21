-- AlterTable
ALTER TABLE "FileUpload" ADD COLUMN     "comment" TEXT;

-- CreateTable
CREATE TABLE "RelatedFile" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileType" TEXT NOT NULL,
    "primaryFileId" TEXT NOT NULL,
    "s3Bucket" TEXT NOT NULL,
    "organization" TEXT,
    "filePath" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "RelatedFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RelatedFile_primaryFileId_key" ON "RelatedFile"("primaryFileId");

-- AddForeignKey
ALTER TABLE "RelatedFile" ADD CONSTRAINT "RelatedFile_primaryFileId_fkey" FOREIGN KEY ("primaryFileId") REFERENCES "FileUpload"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
