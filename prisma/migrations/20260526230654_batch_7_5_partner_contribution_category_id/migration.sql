-- AlterTable
ALTER TABLE "partner_contribution" ADD COLUMN     "category_id" UUID;

-- CreateIndex
CREATE INDEX "partner_contribution_category_id_idx" ON "partner_contribution"("category_id");

-- AddForeignKey
ALTER TABLE "partner_contribution" ADD CONSTRAINT "partner_contribution_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "budget_category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

