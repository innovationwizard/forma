-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DataQualityFlagKind" ADD VALUE 'DUPLICATE_OF_PRIOR_IMPORT';
ALTER TYPE "DataQualityFlagKind" ADD VALUE 'BANK_PARSER_WARNING';

