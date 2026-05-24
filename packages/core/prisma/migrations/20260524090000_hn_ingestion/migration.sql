CREATE TABLE "hn_posts" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "hnObjectId" TEXT NOT NULL,
    "hnItemId" TEXT,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "author" TEXT,
    "points" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "postType" TEXT NOT NULL,
    "postedAt" TIMESTAMP(3) NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawData" JSONB,
    CONSTRAINT "hn_posts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "company_hn_sync_states" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "lastFetchedAt" TIMESTAMP(3),
    "lastSuccessfulSearchAt" TIMESTAMP(3),
    "lastSeenPostedAt" TIMESTAMP(3),
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "company_hn_sync_states_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "hn_posts_hnObjectId_key" ON "hn_posts"("hnObjectId");
CREATE INDEX "hn_posts_companyId_idx" ON "hn_posts"("companyId");
CREATE INDEX "hn_posts_postType_idx" ON "hn_posts"("postType");
CREATE INDEX "hn_posts_postedAt_idx" ON "hn_posts"("postedAt");
CREATE INDEX "hn_posts_points_idx" ON "hn_posts"("points");
CREATE INDEX "hn_posts_commentCount_idx" ON "hn_posts"("commentCount");
CREATE UNIQUE INDEX "company_hn_sync_states_companyId_key" ON "company_hn_sync_states"("companyId");
CREATE INDEX "company_hn_sync_states_lastSuccessfulSearchAt_idx" ON "company_hn_sync_states"("lastSuccessfulSearchAt");
CREATE INDEX "company_hn_sync_states_failureCount_idx" ON "company_hn_sync_states"("failureCount");

ALTER TABLE "hn_posts" ADD CONSTRAINT "hn_posts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "company_hn_sync_states" ADD CONSTRAINT "company_hn_sync_states_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
