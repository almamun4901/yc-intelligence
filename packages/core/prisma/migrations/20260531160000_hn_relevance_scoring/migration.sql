ALTER TABLE "hn_posts"
ADD COLUMN "relevanceScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "matchReasons" JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX "hn_posts_relevanceScore_idx" ON "hn_posts"("relevanceScore");
