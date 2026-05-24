CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "location" TEXT,
    "isRemote" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "techStack" TEXT[],
    "atsSource" TEXT NOT NULL,
    "applyUrl" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "postedAt" TIMESTAMP(3),
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "jobs_applyUrl_key" ON "jobs"("applyUrl");
CREATE INDEX "jobs_companyId_idx" ON "jobs"("companyId");
CREATE INDEX "jobs_isActive_idx" ON "jobs"("isActive");
CREATE INDEX "jobs_isRemote_idx" ON "jobs"("isRemote");
CREATE INDEX "jobs_atsSource_idx" ON "jobs"("atsSource");
CREATE INDEX "jobs_techStack_idx" ON "jobs" USING GIN ("techStack");

ALTER TABLE "jobs" ADD CONSTRAINT "jobs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
