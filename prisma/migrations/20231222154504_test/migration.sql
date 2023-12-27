-- CreateTable
CREATE TABLE "ExcelTemplate" (
    "id" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "template" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "ExcelTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExcelTemplate_createdById_key" ON "ExcelTemplate"("createdById");

-- AddForeignKey
ALTER TABLE "ExcelTemplate" ADD CONSTRAINT "ExcelTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
