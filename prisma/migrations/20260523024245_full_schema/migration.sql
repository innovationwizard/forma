/*
  Warnings:

  - You are about to drop the `_health_check` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('MASTER', 'CEO', 'ANALISTA', 'AUXILIAR');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('USD', 'GTQ');

-- CreateEnum
CREATE TYPE "PartnerType" AS ENUM ('COMPANY', 'INDIVIDUAL', 'GOVERNMENT');

-- CreateEnum
CREATE TYPE "ExpenditureSource" AS ENUM ('BANK_STATEMENT', 'CHECK', 'INVOICE', 'MANUAL', 'XLSX_IMPORT');

-- CreateEnum
CREATE TYPE "ExpenditureStatus" AS ENUM ('VERIFIED', 'PENDING', 'FLAGGED', 'VOIDED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'VOID', 'IMPORT');

-- CreateEnum
CREATE TYPE "ExchangeRateSource" AS ENUM ('BANGUAT', 'XLSX_HISTORICAL', 'MANUAL');

-- CreateEnum
CREATE TYPE "RvUnitStatus" AS ENUM ('AVAILABLE', 'SOFT_HOLD', 'RESERVED', 'FROZEN', 'SOLD');

-- CreateEnum
CREATE TYPE "RvReservationStatus" AS ENUM ('PENDING_REVIEW', 'CONFIRMED', 'REJECTED', 'DESISTED');

-- CreateEnum
CREATE TYPE "RvFreezeRequestStatus" AS ENUM ('ACTIVE', 'RELEASED');

-- CreateEnum
CREATE TYPE "CreditFacilityType" AS ENUM ('BANK_DEVELOPMENT_LOAN', 'PRIVATE');

-- CreateEnum
CREATE TYPE "CreditFacilityMechanism" AS ENUM ('REVOLVING_HYBRID', 'DEVELOPMENT_DRAWDOWN_WITH_REVALUATION');

-- CreateEnum
CREATE TYPE "CapAdjustmentReason" AS ENUM ('UNITS_SOLD', 'MARKET_REVALUATION', 'LEGAL_REQUEST_OTHER');

-- DropTable
DROP TABLE "_health_check";

-- CreateTable
CREATE TABLE "project" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "legal_entity_name" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "currency_primary" "Currency" NOT NULL DEFAULT 'USD',
    "currency_secondary" "Currency" NOT NULL DEFAULT 'GTQ',
    "locked_exchange_rate" DECIMAL(10,6) NOT NULL,
    "iva_rate" DECIMAL(5,4) NOT NULL,
    "isr_rate" DECIMAL(5,4) NOT NULL,
    "start_date" DATE NOT NULL,
    "projected_end_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "tax_id" TEXT,
    "type" "PartnerType" NOT NULL,
    "is_vendor" BOOLEAN NOT NULL DEFAULT false,
    "is_buyer" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_account" (
    "id" UUID NOT NULL,
    "bank_name" TEXT NOT NULL,
    "account_number" TEXT NOT NULL,
    "currency" "Currency" NOT NULL,
    "display_name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_execution_partition" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_execution_partition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_category" (
    "id" UUID NOT NULL,
    "partition_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "budget_amount_usd" DECIMAL(18,2) NOT NULL,
    "budget_percentage" DECIMAL(7,4) NOT NULL,
    "commission_rate" DECIMAL(5,4),
    "dashboard_visible" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_sub_item" (
    "id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unit" TEXT,
    "quantity" DECIMAL(18,4),
    "unit_price_usd" DECIMAL(18,2),
    "total_usd" DECIMAL(18,2) NOT NULL,
    "total_gtq" DECIMAL(18,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_sub_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenditure" (
    "id" UUID NOT NULL,
    "bank_account_id" UUID NOT NULL,
    "partner_id" UUID,
    "vendor_raw" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "amount_con_iva" DECIMAL(18,2) NOT NULL,
    "amount_sin_iva" DECIMAL(18,2) NOT NULL,
    "iva_amount" DECIMAL(18,2) NOT NULL,
    "currency" "Currency" NOT NULL,
    "exchange_rate" DECIMAL(10,6) NOT NULL,
    "amount_usd" DECIMAL(18,2) NOT NULL,
    "description" TEXT NOT NULL,
    "partition_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "sub_item_id" UUID,
    "check_number" TEXT,
    "invoice_reference" TEXT,
    "source" "ExpenditureSource" NOT NULL,
    "status" "ExpenditureStatus" NOT NULL DEFAULT 'PENDING',
    "show_on_dashboard" BOOLEAN NOT NULL DEFAULT true,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenditure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rv_units" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "area_m2" DECIMAL(10,2) NOT NULL,
    "price_per_m2_usd" DECIMAL(10,2),
    "sale_price_sin_iva_usd" DECIMAL(18,2),
    "enganche_rate" DECIMAL(5,4) NOT NULL DEFAULT 0.25,
    "status" "RvUnitStatus" NOT NULL DEFAULT 'AVAILABLE',
    "buyer_id" UUID,
    "vendedor" TEXT,
    "sale_month" INTEGER,
    "delivery_month" INTEGER,
    "reserved_at" DATE,
    "sold_at" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rv_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rv_reservations" (
    "id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "partner_id" UUID NOT NULL,
    "status" "RvReservationStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reserved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_by_user_id" UUID NOT NULL,
    "decided_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rv_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rv_freeze_requests" (
    "id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "status" "RvFreezeRequestStatus" NOT NULL DEFAULT 'ACTIVE',
    "reason" TEXT NOT NULL,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "released_at" TIMESTAMP(3),
    "created_by_user_id" UUID NOT NULL,
    "released_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rv_freeze_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_projection" (
    "id" UUID NOT NULL,
    "month_number" INTEGER NOT NULL,
    "month_date" DATE NOT NULL,
    "cost_terrenos" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "cost_licencias" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "cost_planificacion" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "cost_construcciones_comp" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "cost_construccion" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "cost_mercadeo" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "cost_comisiones" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "cost_honorarios" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "cost_gastos_legales" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "cost_dev_fee" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "cost_imprevistos" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total_cost_sin_iva" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "iva_on_costs" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total_cost_con_iva" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "cumulative_cost_con_iva" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "revenue_per_house" JSONB NOT NULL DEFAULT '{}',
    "total_revenue_sin_iva" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "cumulative_revenue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "ebitda_con_iva" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "ebitda" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "credit_balance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "interest_payment" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "principal_payment" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_projection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_facility" (
    "id" UUID NOT NULL,
    "lender_name" TEXT NOT NULL,
    "facility_type" "CreditFacilityType" NOT NULL,
    "mechanism" "CreditFacilityMechanism" NOT NULL DEFAULT 'DEVELOPMENT_DRAWDOWN_WITH_REVALUATION',
    "initial_cap_usd" DECIMAL(18,2) NOT NULL,
    "current_cap_usd" DECIMAL(18,2) NOT NULL,
    "annual_rate" DECIMAL(7,6) NOT NULL,
    "ltv_ratio" DECIMAL(5,4) NOT NULL,
    "ltc_ceiling" DECIMAL(5,4) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_facility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appraisal" (
    "id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "appraisal_date" DATE NOT NULL,
    "appraiser_name" TEXT,
    "appraised_value_usd" DECIMAL(18,2) NOT NULL,
    "ltv_at_appraisal" DECIMAL(5,4) NOT NULL,
    "available_for_draw_usd" DECIMAL(18,2) NOT NULL,
    "cycle_number" INTEGER NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appraisal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disbursement" (
    "id" UUID NOT NULL,
    "appraisal_id" UUID NOT NULL,
    "expenditure_id" UUID,
    "date" DATE NOT NULL,
    "amount_usd" DECIMAL(18,2) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "disbursement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cap_adjustment" (
    "id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "prior_cap_usd" DECIMAL(18,2) NOT NULL,
    "new_cap_usd" DECIMAL(18,2) NOT NULL,
    "reason" "CapAdjustmentReason" NOT NULL,
    "justification" TEXT NOT NULL,
    "adjusted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "adjusted_by_user_id" UUID NOT NULL,

    CONSTRAINT "cap_adjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_rate" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "rate_gtq_per_usd" DECIMAL(10,6) NOT NULL,
    "source" "ExchangeRateSource" NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_stale" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "exchange_rate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "action" "AuditAction" NOT NULL,
    "field_name" TEXT,
    "old_value" TEXT,
    "new_value" TEXT,
    "context" TEXT,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "partner_name_idx" ON "partner"("name");

-- CreateIndex
CREATE UNIQUE INDEX "bank_account_account_number_key" ON "bank_account"("account_number");

-- CreateIndex
CREATE UNIQUE INDEX "budget_execution_partition_code_key" ON "budget_execution_partition"("code");

-- CreateIndex
CREATE UNIQUE INDEX "budget_category_code_key" ON "budget_category"("code");

-- CreateIndex
CREATE UNIQUE INDEX "budget_sub_item_category_id_code_key" ON "budget_sub_item"("category_id", "code");

-- CreateIndex
CREATE INDEX "expenditure_date_idx" ON "expenditure"("date");

-- CreateIndex
CREATE INDEX "expenditure_category_id_date_idx" ON "expenditure"("category_id", "date");

-- CreateIndex
CREATE INDEX "expenditure_partner_id_idx" ON "expenditure"("partner_id");

-- CreateIndex
CREATE INDEX "expenditure_status_idx" ON "expenditure"("status");

-- CreateIndex
CREATE UNIQUE INDEX "rv_units_name_key" ON "rv_units"("name");

-- CreateIndex
CREATE INDEX "rv_units_status_idx" ON "rv_units"("status");

-- CreateIndex
CREATE INDEX "rv_reservations_unit_id_idx" ON "rv_reservations"("unit_id");

-- CreateIndex
CREATE INDEX "rv_reservations_partner_id_idx" ON "rv_reservations"("partner_id");

-- CreateIndex
CREATE INDEX "rv_reservations_status_idx" ON "rv_reservations"("status");

-- CreateIndex
CREATE INDEX "rv_freeze_requests_unit_id_idx" ON "rv_freeze_requests"("unit_id");

-- CreateIndex
CREATE INDEX "rv_freeze_requests_status_idx" ON "rv_freeze_requests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_projection_month_number_key" ON "monthly_projection"("month_number");

-- CreateIndex
CREATE UNIQUE INDEX "appraisal_facility_id_cycle_number_key" ON "appraisal"("facility_id", "cycle_number");

-- CreateIndex
CREATE INDEX "disbursement_date_idx" ON "disbursement"("date");

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rate_date_key" ON "exchange_rate"("date");

-- CreateIndex
CREATE INDEX "exchange_rate_date_idx" ON "exchange_rate"("date");

-- CreateIndex
CREATE INDEX "audit_log_entity_type_entity_id_idx" ON "audit_log"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_log_user_id_idx" ON "audit_log"("user_id");

-- CreateIndex
CREATE INDEX "audit_log_timestamp_idx" ON "audit_log"("timestamp");

-- AddForeignKey
ALTER TABLE "budget_category" ADD CONSTRAINT "budget_category_partition_id_fkey" FOREIGN KEY ("partition_id") REFERENCES "budget_execution_partition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_sub_item" ADD CONSTRAINT "budget_sub_item_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "budget_category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenditure" ADD CONSTRAINT "expenditure_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenditure" ADD CONSTRAINT "expenditure_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenditure" ADD CONSTRAINT "expenditure_partition_id_fkey" FOREIGN KEY ("partition_id") REFERENCES "budget_execution_partition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenditure" ADD CONSTRAINT "expenditure_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "budget_category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenditure" ADD CONSTRAINT "expenditure_sub_item_id_fkey" FOREIGN KEY ("sub_item_id") REFERENCES "budget_sub_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenditure" ADD CONSTRAINT "expenditure_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rv_units" ADD CONSTRAINT "rv_units_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rv_reservations" ADD CONSTRAINT "rv_reservations_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "rv_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rv_reservations" ADD CONSTRAINT "rv_reservations_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rv_reservations" ADD CONSTRAINT "rv_reservations_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rv_reservations" ADD CONSTRAINT "rv_reservations_decided_by_user_id_fkey" FOREIGN KEY ("decided_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rv_freeze_requests" ADD CONSTRAINT "rv_freeze_requests_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "rv_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rv_freeze_requests" ADD CONSTRAINT "rv_freeze_requests_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rv_freeze_requests" ADD CONSTRAINT "rv_freeze_requests_released_by_user_id_fkey" FOREIGN KEY ("released_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appraisal" ADD CONSTRAINT "appraisal_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "credit_facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disbursement" ADD CONSTRAINT "disbursement_appraisal_id_fkey" FOREIGN KEY ("appraisal_id") REFERENCES "appraisal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disbursement" ADD CONSTRAINT "disbursement_expenditure_id_fkey" FOREIGN KEY ("expenditure_id") REFERENCES "expenditure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cap_adjustment" ADD CONSTRAINT "cap_adjustment_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "credit_facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cap_adjustment" ADD CONSTRAINT "cap_adjustment_adjusted_by_user_id_fkey" FOREIGN KEY ("adjusted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
