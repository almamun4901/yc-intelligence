-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateTable
CREATE TABLE "memory_entries" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "tags" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'active',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "supersedesId" TEXT,
    "supersededById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memory_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memory_sources" (
    "id" TEXT NOT NULL,
    "memoryEntryId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceRef" TEXT NOT NULL,
    "sourceTitle" TEXT,
    "sourceExcerpt" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memory_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_logs" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "recordCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "errorMsg" TEXT,

    CONSTRAINT "refresh_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "memory_entries_type_idx" ON "memory_entries"("type");

-- CreateIndex
CREATE INDEX "memory_entries_status_idx" ON "memory_entries"("status");

-- CreateIndex
CREATE INDEX "memory_entries_tags_idx" ON "memory_entries" USING GIN ("tags");

-- CreateIndex
CREATE INDEX "memory_entries_supersedesId_idx" ON "memory_entries"("supersedesId");

-- CreateIndex
CREATE INDEX "memory_entries_supersededById_idx" ON "memory_entries"("supersededById");

-- CreateIndex
CREATE INDEX "memory_sources_memoryEntryId_idx" ON "memory_sources"("memoryEntryId");

-- CreateIndex
CREATE INDEX "memory_sources_sourceType_idx" ON "memory_sources"("sourceType");

-- CreateIndex
CREATE INDEX "refresh_logs_source_idx" ON "refresh_logs"("source");

-- CreateIndex
CREATE INDEX "refresh_logs_status_idx" ON "refresh_logs"("status");

-- CreateIndex
CREATE INDEX "refresh_logs_startedAt_idx" ON "refresh_logs"("startedAt");

-- AddForeignKey
ALTER TABLE "memory_sources" ADD CONSTRAINT "memory_sources_memoryEntryId_fkey" FOREIGN KEY ("memoryEntryId") REFERENCES "memory_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
