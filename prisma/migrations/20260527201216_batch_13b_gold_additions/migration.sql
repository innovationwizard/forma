-- CreateEnum
CREATE TYPE "RvPaymentReconciliationStatus" AS ENUM ('MATCHED', 'OVERPAYMENT', 'UNDERPAYMENT', 'UNMATCHED');

-- AlterTable
ALTER TABLE "expenditure" ADD COLUMN     "source_bank_transaction_id" UUID;

-- AlterTable
ALTER TABLE "partner_contribution" ADD COLUMN     "source_bank_transaction_id" UUID;

-- CreateTable
CREATE TABLE "rv_payment" (
    "id" UUID NOT NULL,
    "rv_unit_id" UUID NOT NULL,
    "bank_transaction_id" UUID,
    "payment_date" DATE NOT NULL,
    "amount_usd" DECIMAL(18,2) NOT NULL,
    "amount_gtq" DECIMAL(18,2) NOT NULL,
    "exchange_rate_used" DECIMAL(10,6) NOT NULL,
    "reconciliation_status" "RvPaymentReconciliationStatus" NOT NULL DEFAULT 'UNMATCHED',
    "notes" TEXT,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "rv_payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rv_payment_rv_unit_id_idx" ON "rv_payment"("rv_unit_id");

-- CreateIndex
CREATE INDEX "rv_payment_bank_transaction_id_idx" ON "rv_payment"("bank_transaction_id");

-- CreateIndex
CREATE INDEX "rv_payment_payment_date_idx" ON "rv_payment"("payment_date");

-- CreateIndex
CREATE INDEX "rv_payment_deleted_at_idx" ON "rv_payment"("deleted_at");

-- CreateIndex
CREATE INDEX "expenditure_source_bank_transaction_id_idx" ON "expenditure"("source_bank_transaction_id");

-- CreateIndex
CREATE INDEX "partner_contribution_source_bank_transaction_id_idx" ON "partner_contribution"("source_bank_transaction_id");

-- AddForeignKey
ALTER TABLE "expenditure" ADD CONSTRAINT "expenditure_source_bank_transaction_id_fkey" FOREIGN KEY ("source_bank_transaction_id") REFERENCES "bank_transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_contribution" ADD CONSTRAINT "partner_contribution_source_bank_transaction_id_fkey" FOREIGN KEY ("source_bank_transaction_id") REFERENCES "bank_transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rv_payment" ADD CONSTRAINT "rv_payment_rv_unit_id_fkey" FOREIGN KEY ("rv_unit_id") REFERENCES "rv_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rv_payment" ADD CONSTRAINT "rv_payment_bank_transaction_id_fkey" FOREIGN KEY ("bank_transaction_id") REFERENCES "bank_transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rv_payment" ADD CONSTRAINT "rv_payment_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

