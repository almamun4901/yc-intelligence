-- Existing company embeddings were generated for the previous 1536-dimensional
-- provider and cannot be reused with Voyage's 1024-dimensional embedding model.
TRUNCATE TABLE "company_embeddings";

ALTER TABLE "company_embeddings"
  ALTER COLUMN "embedding" TYPE vector(1024);
