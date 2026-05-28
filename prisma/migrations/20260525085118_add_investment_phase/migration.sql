-- CreateEnum
CREATE TYPE "InvestmentPhaseStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD');

-- CreateTable
CREATE TABLE "investment_phase" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "planned_start_month" INTEGER,
    "planned_end_month" INTEGER,
    "planned_capital_usd" DECIMAL(18,2),
    "status" "InvestmentPhaseStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "notes" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "investment_phase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "investment_phase_code_key" ON "investment_phase"("code");

-- CreateIndex
CREATE UNIQUE INDEX "investment_phase_sort_order_key" ON "investment_phase"("sort_order");

-- CreateIndex
CREATE INDEX "investment_phase_deleted_at_idx" ON "investment_phase"("deleted_at");

-- CreateIndex
CREATE INDEX "investment_phase_sort_order_idx" ON "investment_phase"("sort_order");

