-- Model switch: OpenAI text-embedding-3-large (1536d) → self-hosted
-- BAAI/bge-m3 (1024d, served by the local Ollama container).
--
-- Existing vectors were produced by a different model, so cosine similarity
-- against them is meaningless. All rows are wiped and re-embedded lazily by the
-- next linkage/RAG run (content hashes already invalidate on model change).
--
-- The HNSW index must be dropped before the type change (pgvector indexes are
-- dimension-bound) and recreated afterwards.

DROP INDEX IF EXISTS "vector_embedding_embedding_idx";

DELETE FROM "vector_embedding";

ALTER TABLE "vector_embedding"
  ALTER COLUMN "embedding" TYPE vector(1024);

CREATE INDEX "vector_embedding_embedding_idx"
  ON "vector_embedding" USING hnsw ("embedding" vector_cosine_ops);
