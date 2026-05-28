-- DropForeignKey
ALTER TABLE "expenditure" DROP CONSTRAINT "expenditure_bank_account_id_fkey";

-- AlterTable
ALTER TABLE "expenditure" ALTER COLUMN "bank_account_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "expenditure" ADD CONSTRAINT "expenditure_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

