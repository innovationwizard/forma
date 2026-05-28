-- CreateEnum
CREATE TYPE "BankName" AS ENUM ('GT_CONTINENTAL', 'PROMERICA', 'BAC', 'INDUSTRIAL', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "StatementType" AS ENUM ('CURRENT_ACCOUNT', 'CHECK_REGISTER', 'CREDIT_CARD', 'SAVINGS', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "SheetParseStatus" AS ENUM ('PARSED', 'UNPARSEABLE', 'EMPTY');

-- CreateEnum
CREATE TYPE "RawRowParseStatus" AS ENUM ('OK', 'UNPARSEABLE');

-- CreateEnum
CREATE TYPE "BankTransactionDirection" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "BankTransactionClassificationStatus" AS ENUM ('UNCLASSIFIED', 'EXPENDITURE', 'RV_PAYMENT', 'PARTNER_CONTRIBUTION', 'INTERNAL_TRANSFER', 'INTEREST', 'FEE', 'TAX', 'IGNORED');

-- CreateTable
CREATE TABLE "bank_statement_import" (
    "id" UUID NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_sha256" TEXT NOT NULL,
    "file_size_bytes" INTEGER NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploaded_by_user_id" UUID NOT NULL,
    "detected_bank" "BankName" NOT NULL DEFAULT 'UNKNOWN',
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "bank_statement_import_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_statement_sheet" (
    "id" UUID NOT NULL,
    "import_id" UUID NOT NULL,
    "sheet_name" TEXT NOT NULL,
    "sheet_index" INTEGER NOT NULL,
    "row_count" INTEGER NOT NULL,
    "statement_type" "StatementType" NOT NULL DEFAULT 'UNKNOWN',
    "detected_bank_account_id" UUID,
    "detected_currency" "Currency",
    "detected_period_start" DATE,
    "detected_period_end" DATE,
    "parse_status" "SheetParseStatus" NOT NULL,
    "parse_note" TEXT,
    "is_canonical" BOOLEAN NOT NULL DEFAULT true,
    "alternates_link_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_statement_sheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_statement_raw_row" (
    "id" UUID NOT NULL,
    "sheet_id" UUID NOT NULL,
    "source_row_number" INTEGER NOT NULL,
    "raw_cells" JSONB NOT NULL,
    "parse_status" "RawRowParseStatus" NOT NULL,
    "parse_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_statement_raw_row_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_transaction" (
    "id" UUID NOT NULL,
    "bank_account_id" UUID NOT NULL,
    "transaction_date" DATE NOT NULL,
    "amount_signed" DECIMAL(18,2) NOT NULL,
    "currency" "Currency" NOT NULL,
    "reference" TEXT,
    "description" TEXT NOT NULL,
    "agencia" TEXT,
    "direction" "BankTransactionDirection" NOT NULL,
    "saldo_after" DECIMAL(18,2),
    "bronze_row_id" UUID NOT NULL,
    "natural_key" TEXT NOT NULL,
    "classification_status" "BankTransactionClassificationStatus" NOT NULL DEFAULT 'UNCLASSIFIED',
    "classifier_note" TEXT,
    "classified_by_user_id" UUID,
    "classified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "bank_transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bank_statement_import_file_sha256_key" ON "bank_statement_import"("file_sha256");

-- CreateIndex
CREATE INDEX "bank_statement_import_uploaded_by_user_id_idx" ON "bank_statement_import"("uploaded_by_user_id");

-- CreateIndex
CREATE INDEX "bank_statement_import_uploaded_at_idx" ON "bank_statement_import"("uploaded_at");

-- CreateIndex
CREATE INDEX "bank_statement_import_deleted_at_idx" ON "bank_statement_import"("deleted_at");

-- CreateIndex
CREATE INDEX "bank_statement_sheet_import_id_idx" ON "bank_statement_sheet"("import_id");

-- CreateIndex
CREATE INDEX "bank_statement_sheet_detected_bank_account_id_idx" ON "bank_statement_sheet"("detected_bank_account_id");

-- CreateIndex
CREATE INDEX "bank_statement_sheet_alternates_link_id_idx" ON "bank_statement_sheet"("alternates_link_id");

-- CreateIndex
CREATE INDEX "bank_statement_raw_row_sheet_id_idx" ON "bank_statement_raw_row"("sheet_id");

-- CreateIndex
CREATE INDEX "bank_statement_raw_row_parse_status_idx" ON "bank_statement_raw_row"("parse_status");

-- CreateIndex
CREATE UNIQUE INDEX "bank_transaction_natural_key_key" ON "bank_transaction"("natural_key");

-- CreateIndex
CREATE INDEX "bank_transaction_bank_account_id_transaction_date_idx" ON "bank_transaction"("bank_account_id", "transaction_date");

-- CreateIndex
CREATE INDEX "bank_transaction_classification_status_idx" ON "bank_transaction"("classification_status");

-- CreateIndex
CREATE INDEX "bank_transaction_bronze_row_id_idx" ON "bank_transaction"("bronze_row_id");

-- CreateIndex
CREATE INDEX "bank_transaction_deleted_at_idx" ON "bank_transaction"("deleted_at");

-- AddForeignKey
ALTER TABLE "bank_statement_import" ADD CONSTRAINT "bank_statement_import_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statement_sheet" ADD CONSTRAINT "bank_statement_sheet_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "bank_statement_import"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statement_sheet" ADD CONSTRAINT "bank_statement_sheet_detected_bank_account_id_fkey" FOREIGN KEY ("detected_bank_account_id") REFERENCES "bank_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statement_sheet" ADD CONSTRAINT "bank_statement_sheet_alternates_link_id_fkey" FOREIGN KEY ("alternates_link_id") REFERENCES "bank_statement_sheet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statement_raw_row" ADD CONSTRAINT "bank_statement_raw_row_sheet_id_fkey" FOREIGN KEY ("sheet_id") REFERENCES "bank_statement_sheet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transaction" ADD CONSTRAINT "bank_transaction_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transaction" ADD CONSTRAINT "bank_transaction_bronze_row_id_fkey" FOREIGN KEY ("bronze_row_id") REFERENCES "bank_statement_raw_row"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transaction" ADD CONSTRAINT "bank_transaction_classified_by_user_id_fkey" FOREIGN KEY ("classified_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

