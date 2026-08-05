-- ============================================================================
-- pgvector embedding store (replaces Upstash Vector)
-- ============================================================================
--
-- The `vector` extension ships in the pgvector Postgres image (see
-- docker-compose.yml). `IF NOT EXISTS` keeps this idempotent for databases
-- that already have it enabled.
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateTable
CREATE TABLE "vector_embedding" (
    "id" TEXT NOT NULL,
    "embedding" vector(1536),
    "organizationId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "content" TEXT,
    "policyName" TEXT,
    "contextQuestion" TEXT,
    "documentName" TEXT,
    "manualAnswerQuestion" TEXT,
    "department" TEXT,
    "updatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VectorEmbedding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vector_embedding_organizationId_sourceType_idx" ON "vector_embedding"("organizationId", "sourceType");

-- CreateIndex
CREATE INDEX "vector_embedding_sourceId_idx" ON "vector_embedding"("sourceId");

-- CreateIndex
CREATE INDEX "vector_embedding_sourceType_sourceId_idx" ON "vector_embedding"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "vector_embedding_organizationId_idx" ON "vector_embedding"("organizationId");

-- HNSW index over cosine distance. Synchronous with writes (no
-- pendingVectorCount like Upstash) and supports SQL filtering during
-- traversal, so org-scoped ANN queries are exact-by-filter.
CREATE INDEX "vector_embedding_embedding_idx" ON "vector_embedding" USING hnsw ("embedding" vector_cosine_ops);
