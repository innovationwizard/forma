-- CreateTable
CREATE TABLE "issued_cheque" (
    "id" UUID NOT NULL,
    "cheque_number" TEXT NOT NULL,
    "issue_date" DATE,
    "currency" "Currency" NOT NULL,
    "bank_account_id" UUID,
    "payee_name" TEXT NOT NULL,
    "amount_signed" DECIMAL(18,2) NOT NULL,
    "concepto" TEXT NOT NULL,
    "solicitud" TEXT,
    "partida" TEXT,
    "cxc" TEXT,
    "saldo_after" DECIMAL(18,2),
    "is_voided" BOOLEAN NOT NULL DEFAULT false,
    "bronze_row_id" UUID NOT NULL,
    "natural_key" TEXT NOT NULL,
    "cashed_by_bank_transaction_id" UUID,
    "classified_expenditure_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "issued_cheque_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "issued_cheque_natural_key_key" ON "issued_cheque"("natural_key");

-- CreateIndex
CREATE INDEX "issued_cheque_bank_account_id_currency_cheque_number_idx" ON "issued_cheque"("bank_account_id", "currency", "cheque_number");

-- CreateIndex
CREATE INDEX "issued_cheque_bronze_row_id_idx" ON "issued_cheque"("bronze_row_id");

-- CreateIndex
CREATE INDEX "issued_cheque_cashed_by_bank_transaction_id_idx" ON "issued_cheque"("cashed_by_bank_transaction_id");

-- CreateIndex
CREATE INDEX "issued_cheque_is_voided_idx" ON "issued_cheque"("is_voided");

-- CreateIndex
CREATE INDEX "issued_cheque_deleted_at_idx" ON "issued_cheque"("deleted_at");

-- AddForeignKey
ALTER TABLE "issued_cheque" ADD CONSTRAINT "issued_cheque_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issued_cheque" ADD CONSTRAINT "issued_cheque_bronze_row_id_fkey" FOREIGN KEY ("bronze_row_id") REFERENCES "bank_statement_raw_row"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issued_cheque" ADD CONSTRAINT "issued_cheque_cashed_by_bank_transaction_id_fkey" FOREIGN KEY ("cashed_by_bank_transaction_id") REFERENCES "bank_transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issued_cheque" ADD CONSTRAINT "issued_cheque_classified_expenditure_id_fkey" FOREIGN KEY ("classified_expenditure_id") REFERENCES "expenditure"("id") ON DELETE SET NULL ON UPDATE CASCADE;
