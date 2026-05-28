-- CreateEnum
CREATE TYPE "DataQualityFlagKind" AS ENUM ('MISSING_PARTIDA', 'PARTIDA_FLAGGED_FOR_REVIEW', 'UNIT_STATUS_CONTRADICTS_REFUND', 'CATEGORY_MISLABEL', 'TIMELINE_MISALIGNMENT', 'CALENDAR_GAP', 'STALE_FORMULA_WINDOW', 'STALE_LABEL', 'FLOATING_POINT_RESIDUE', 'TC_AMBIGUITY', 'OVERSPEND', 'LARGE_NEGATIVE_REVENUE', 'MIXED_CURRENCY_SUM_VALIDATED_GTQ', 'MISSING_BANCO_INTENTIONAL', 'UNUSED_BUDGET_FORMULA', 'OUTLIER_PRICING', 'CELL_COMMENT', 'CROSS_SHEET_RECONCILIATION', 'UNKNOWN_ANOMALY');

-- CreateEnum
CREATE TYPE "DataQualityFlagSeverity" AS ENUM ('INFO', 'WARNING', 'ERROR_VISIBLE', 'ERROR_BLOCKING');

-- CreateEnum
CREATE TYPE "PartnerContributionKind" AS ENUM ('CASH_CALL', 'DISTRIBUTION', 'IN_KIND_ASSET', 'CASH_PURCHASE');

-- CreateEnum
CREATE TYPE "ContributionSourceKind" AS ENUM ('FORECAST_FCFCASAS2', 'ACTUAL_LEDGER', 'HYBRID');

-- CreateEnum
CREATE TYPE "IsrPaymentPattern" AS ENUM ('LUMP_END', 'QUARTERLY', 'ANNUAL', 'CUSTOM_TRIGGER', 'COMPOSITE');

-- CreateEnum
CREATE TYPE "IsrRateKind" AS ENUM ('EFFECTIVE', 'NOMINAL', 'REGIMEN_SPECIFIC');

-- CreateEnum
CREATE TYPE "AmortizationMechanism" AS ENUM ('REVOLVENTE_HIBRIDO', 'FIXED_AMORTIZATION', 'BULLET', 'INTEREST_ONLY');

-- CreateEnum
CREATE TYPE "ExpenditureKind" AS ENUM ('OPERATING_EXPENSE', 'CASH_MOVEMENT', 'EQUITY_EVENT');

-- CreateEnum
CREATE TYPE "PartnerCategory" AS ENUM ('VENDOR', 'TAX_AUTHORITY', 'BANK_AS_COUNTERPARTY', 'INTERNAL_ENTITY', 'INTERNAL_INDIVIDUAL');

-- AlterEnum
ALTER TYPE "ExpenditureStatus" ADD VALUE 'ANULADO';

-- AlterTable
ALTER TABLE "expenditure" ADD COLUMN     "description_normalized" TEXT,
ADD COLUMN     "exchange_rate_at_transaction" DECIMAL(10,6),
ADD COLUMN     "kind" "ExpenditureKind" NOT NULL DEFAULT 'OPERATING_EXPENSE';

-- AlterTable
ALTER TABLE "partner" ADD COLUMN     "category" "PartnerCategory";

-- AlterTable
ALTER TABLE "project" DROP COLUMN "isr_rate",
ADD COLUMN     "address" TEXT,
ADD COLUMN     "internal_approval_date" DATE,
ADD COLUMN     "legal_representative_name" TEXT,
ADD COLUMN     "model_author_name" TEXT,
ADD COLUMN     "model_notes" JSONB,
ADD COLUMN     "model_recent_editor_name" TEXT,
ADD COLUMN     "original_landowner" TEXT,
ADD COLUMN     "regulatory_history_note" TEXT,
ADD COLUMN     "tc_budgetary_label" TEXT,
ADD COLUMN     "tc_effective_terreno_historical" DECIMAL(10,6);

-- CreateTable
CREATE TABLE "amortization_rule" (
    "id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "applies_from_month" INTEGER NOT NULL,
    "applies_to_month" INTEGER,
    "mechanism" "AmortizationMechanism" NOT NULL,
    "conditions_note" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "amortization_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_contribution" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "partner_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "amount_gtq" DECIMAL(18,2) NOT NULL,
    "amount_usd" DECIMAL(18,2) NOT NULL,
    "kind" "PartnerContributionKind" NOT NULL,
    "asset_description" TEXT,
    "source_workbook_ref" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "partner_contribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contribution_source" (
    "id" UUID NOT NULL,
    "contribution_id" UUID NOT NULL,
    "source_kind" "ContributionSourceKind" NOT NULL,
    "weight" DECIMAL(5,4) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "contribution_source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "isr_obligation" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "ui_label" TEXT NOT NULL,
    "rate" DECIMAL(5,4) NOT NULL,
    "rate_kind" "IsrRateKind" NOT NULL,
    "source_cell" TEXT NOT NULL,
    "source_text_verbatim" TEXT NOT NULL,
    "payment_pattern" "IsrPaymentPattern" NOT NULL,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "isr_obligation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_quality_flag" (
    "id" UUID NOT NULL,
    "kind" "DataQualityFlagKind" NOT NULL,
    "severity" "DataQualityFlagSeverity" NOT NULL,
    "source_workbook_ref" TEXT NOT NULL,
    "source_value" TEXT,
    "recomputed_value" TEXT,
    "human_message" TEXT NOT NULL,
    "related_entity_type" TEXT,
    "related_entity_id" UUID,
    "raised_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "resolved_by_user_id" UUID,
    "resolution_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "data_quality_flag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "amortization_rule_facility_id_idx" ON "amortization_rule"("facility_id");

-- CreateIndex
CREATE INDEX "amortization_rule_deleted_at_idx" ON "amortization_rule"("deleted_at");

-- CreateIndex
CREATE INDEX "partner_contribution_project_id_idx" ON "partner_contribution"("project_id");

-- CreateIndex
CREATE INDEX "partner_contribution_partner_id_idx" ON "partner_contribution"("partner_id");

-- CreateIndex
CREATE INDEX "partner_contribution_date_idx" ON "partner_contribution"("date");

-- CreateIndex
CREATE INDEX "partner_contribution_kind_idx" ON "partner_contribution"("kind");

-- CreateIndex
CREATE INDEX "partner_contribution_deleted_at_idx" ON "partner_contribution"("deleted_at");

-- CreateIndex
CREATE INDEX "contribution_source_contribution_id_idx" ON "contribution_source"("contribution_id");

-- CreateIndex
CREATE INDEX "contribution_source_deleted_at_idx" ON "contribution_source"("deleted_at");

-- CreateIndex
CREATE INDEX "isr_obligation_project_id_idx" ON "isr_obligation"("project_id");

-- CreateIndex
CREATE INDEX "isr_obligation_deleted_at_idx" ON "isr_obligation"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "isr_obligation_project_id_ui_label_key" ON "isr_obligation"("project_id", "ui_label");

-- CreateIndex
CREATE INDEX "data_quality_flag_kind_idx" ON "data_quality_flag"("kind");

-- CreateIndex
CREATE INDEX "data_quality_flag_severity_idx" ON "data_quality_flag"("severity");

-- CreateIndex
CREATE INDEX "data_quality_flag_related_entity_type_related_entity_id_idx" ON "data_quality_flag"("related_entity_type", "related_entity_id");

-- CreateIndex
CREATE INDEX "data_quality_flag_resolved_at_idx" ON "data_quality_flag"("resolved_at");

-- CreateIndex
CREATE INDEX "data_quality_flag_deleted_at_idx" ON "data_quality_flag"("deleted_at");

-- CreateIndex
CREATE INDEX "partner_category_idx" ON "partner"("category");

-- AddForeignKey
ALTER TABLE "amortization_rule" ADD CONSTRAINT "amortization_rule_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "credit_facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_contribution" ADD CONSTRAINT "partner_contribution_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_contribution" ADD CONSTRAINT "partner_contribution_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contribution_source" ADD CONSTRAINT "contribution_source_contribution_id_fkey" FOREIGN KEY ("contribution_id") REFERENCES "partner_contribution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "isr_obligation" ADD CONSTRAINT "isr_obligation_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_quality_flag" ADD CONSTRAINT "data_quality_flag_resolved_by_user_id_fkey" FOREIGN KEY ("resolved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

