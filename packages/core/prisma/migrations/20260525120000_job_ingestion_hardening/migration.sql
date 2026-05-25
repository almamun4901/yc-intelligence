CREATE TABLE "company_job_sync_states" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "lastFetchedAt" TIMESTAMP(3),
    "lastSuccessfulFetchAt" TIMESTAMP(3),
    "lastFoundJobsAt" TIMESTAMP(3),
    "lastAtsSource" TEXT,
    "lastStatus" TEXT,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_job_sync_states_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "company_job_sync_states_companyId_key" ON "company_job_sync_states"("companyId");
CREATE INDEX "company_job_sync_states_lastSuccessfulFetchAt_idx" ON "company_job_sync_states"("lastSuccessfulFetchAt");
CREATE INDEX "company_job_sync_states_lastAtsSource_idx" ON "company_job_sync_states"("lastAtsSource");
CREATE INDEX "company_job_sync_states_lastStatus_idx" ON "company_job_sync_states"("lastStatus");
CREATE INDEX "company_job_sync_states_failureCount_idx" ON "company_job_sync_states"("failureCount");

ALTER TABLE "company_job_sync_states" ADD CONSTRAINT "company_job_sync_states_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
