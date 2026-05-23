-- AlterTable
ALTER TABLE "appraisal" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "bank_account" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "budget_category" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "budget_execution_partition" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "budget_sub_item" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "cap_adjustment" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "credit_facility" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "disbursement" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "exchange_rate" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "expenditure" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "monthly_projection" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "partner" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "project" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "rv_freeze_requests" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "rv_reservations" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "rv_units" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "appraisal_deleted_at_idx" ON "appraisal"("deleted_at");

-- CreateIndex
CREATE INDEX "bank_account_deleted_at_idx" ON "bank_account"("deleted_at");

-- CreateIndex
CREATE INDEX "budget_category_deleted_at_idx" ON "budget_category"("deleted_at");

-- CreateIndex
CREATE INDEX "budget_execution_partition_deleted_at_idx" ON "budget_execution_partition"("deleted_at");

-- CreateIndex
CREATE INDEX "budget_sub_item_deleted_at_idx" ON "budget_sub_item"("deleted_at");

-- CreateIndex
CREATE INDEX "cap_adjustment_deleted_at_idx" ON "cap_adjustment"("deleted_at");

-- CreateIndex
CREATE INDEX "credit_facility_deleted_at_idx" ON "credit_facility"("deleted_at");

-- CreateIndex
CREATE INDEX "disbursement_deleted_at_idx" ON "disbursement"("deleted_at");

-- CreateIndex
CREATE INDEX "exchange_rate_deleted_at_idx" ON "exchange_rate"("deleted_at");

-- CreateIndex
CREATE INDEX "expenditure_deleted_at_idx" ON "expenditure"("deleted_at");

-- CreateIndex
CREATE INDEX "monthly_projection_deleted_at_idx" ON "monthly_projection"("deleted_at");

-- CreateIndex
CREATE INDEX "partner_deleted_at_idx" ON "partner"("deleted_at");

-- CreateIndex
CREATE INDEX "project_deleted_at_idx" ON "project"("deleted_at");

-- CreateIndex
CREATE INDEX "rv_freeze_requests_deleted_at_idx" ON "rv_freeze_requests"("deleted_at");

-- CreateIndex
CREATE INDEX "rv_reservations_deleted_at_idx" ON "rv_reservations"("deleted_at");

-- CreateIndex
CREATE INDEX "rv_units_deleted_at_idx" ON "rv_units"("deleted_at");

-- CreateIndex
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");
