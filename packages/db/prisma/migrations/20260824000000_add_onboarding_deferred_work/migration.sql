-- CreateEnum
CREATE TYPE "DeferredWorkStatus" AS ENUM ('pending', 'done', 'failed');

-- CreateTable
CREATE TABLE "OnboardingDeferredWork" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingDeferredWork_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OnboardingDeferredWork_nextAttemptAt_idx" ON "OnboardingDeferredWork"("nextAttemptAt");

-- CreateIndex
CREATE INDEX "OnboardingDeferredWork_organizationId_idx" ON "OnboardingDeferredWork"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingDeferredWork_dedupeKey_key" ON "OnboardingDeferredWork"("dedupeKey");

-- AddForeignKey
ALTER TABLE "OnboardingDeferredWork" ADD CONSTRAINT "OnboardingDeferredWork_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
