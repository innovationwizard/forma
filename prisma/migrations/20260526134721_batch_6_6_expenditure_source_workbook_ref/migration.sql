-- AlterTable
ALTER TABLE "expenditure" ADD COLUMN     "source_workbook_ref" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "expenditure_source_workbook_ref_key" ON "expenditure"("source_workbook_ref");

