CREATE TABLE "company_embeddings" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "sourceText" TEXT NOT NULL,
  "sourceHash" TEXT NOT NULL,
  "embeddingModel" TEXT NOT NULL,
  "embedding" vector(1536) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "company_embeddings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "company_embeddings_companyId_key" ON "company_embeddings"("companyId");
CREATE INDEX "company_embeddings_companyId_idx" ON "company_embeddings"("companyId");
CREATE INDEX "company_embeddings_sourceHash_idx" ON "company_embeddings"("sourceHash");
CREATE INDEX "company_embeddings_embeddingModel_idx" ON "company_embeddings"("embeddingModel");
CREATE INDEX "company_embeddings_embedding_idx" ON "company_embeddings" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);

ALTER TABLE "company_embeddings"
  ADD CONSTRAINT "company_embeddings_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
