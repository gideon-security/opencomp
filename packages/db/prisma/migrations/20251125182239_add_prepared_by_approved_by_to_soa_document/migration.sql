-- AlterTable
ALTER TABLE "SOADocument" ADD COLUMN "preparedBy" TEXT NOT NULL DEFAULT 'OpenComp';
ALTER TABLE "SOADocument" ADD COLUMN "approvedBy" TEXT;
ALTER TABLE "SOADocument" ADD COLUMN "approvedAt" TIMESTAMP(3);

