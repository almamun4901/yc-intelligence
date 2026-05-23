-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "batch" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "description" TEXT,
    "shortDescription" TEXT,
    "website" TEXT,
    "teamSize" TEXT,
    "isHiring" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT[],
    "location" TEXT,
    "rawData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "founders" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "linkedinUrl" TEXT,
    "previousEmployers" TEXT[],
    "schools" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "founders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "companies_slug_key" ON "companies"("slug");

-- CreateIndex
CREATE INDEX "companies_slug_idx" ON "companies"("slug");

-- CreateIndex
CREATE INDEX "companies_batch_idx" ON "companies"("batch");

-- CreateIndex
CREATE INDEX "companies_status_idx" ON "companies"("status");

-- CreateIndex
CREATE INDEX "companies_isHiring_idx" ON "companies"("isHiring");

-- CreateIndex
CREATE INDEX "companies_tags_idx" ON "companies" USING GIN ("tags");

-- CreateIndex
CREATE UNIQUE INDEX "founders_companyId_name_key" ON "founders"("companyId", "name");

-- CreateIndex
CREATE INDEX "founders_companyId_idx" ON "founders"("companyId");

-- AddForeignKey
ALTER TABLE "founders" ADD CONSTRAINT "founders_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
