# Vector Search Utilities

This directory contains utilities for semantic search using pgvector (Postgres) and OpenAI embeddings.

## Structure

```
lib/
├── core/                      # Core functionality
│   ├── client.ts             # Shared pgvector client (re-exported from @gideon-defender/db)
│   ├── generate-embedding.ts # OpenAI embedding generation
│   ├── find-similar.ts       # Semantic search function
│   └── upsert-embedding.ts   # Embedding storage
├── sync/                      # Embedding sync jobs (policies, context, manual answers, KB)
├── utils/                     # Utility functions
│   ├── chunk-text.ts         # Text chunking utility
│   └── extract-policy-text.ts # TipTap JSON to text conversion
├── index.ts                   # Main exports
└── README.md                 # This file
```

## Setup

1. **Enable pgvector**
   - The `vector` extension and `vector_embedding` table (with HNSW index) are created by the
     migration `20260805000000_add_pgvector_embeddings` in `packages/db/prisma/migrations`.
   - Vector writes/reads go through raw SQL in the shared client; Prisma does not own the
     `vector(1536)` column type.

2. **Add Environment Variables**
   Add to your `.env` file:
   ```
   DATABASE_URL=postgres://user:password@host:5432/comp?sslmode=disable
   OPENAI_API_KEY=your_openai_api_key
   ```

3. **Automatic Embedding Creation**
   Embeddings are automatically created when parsing vendor questionnaires.
   The system checks if embeddings exist for your organization and creates them
   automatically if needed (first 10 policies and 10 context entries).

## Usage

### Find Similar Content

```typescript
import { findSimilarContent } from '@/vector-store/lib';

const results = await findSimilarContent(
  "How do we handle encryption?",
  organizationId,
);

// Returns ALL results above similarity threshold (0.2)
// No artificial limit - all relevant data reaches the LLM
//
// Results contain:
// - id: embedding ID
// - score: similarity score (0-1)
// - content: text content
// - sourceType: 'policy' | 'context' | 'manual_answer' | 'knowledge_base_document'
// - sourceId: ID of the source document
// - policyName: (if sourceType is 'policy')
// - contextQuestion: (if sourceType is 'context')
// - manualAnswerQuestion: (if sourceType is 'manual_answer')
// - documentName: (if sourceType is 'knowledge_base_document')
```

### Upsert Embedding

```typescript
import { upsertEmbedding } from '@/vector-store/lib';

await upsertEmbedding(
  'policy_pol123_chunk0',
  'Text content to embed...',
  {
    organizationId: 'org_123',
    sourceType: 'policy',
    sourceId: 'pol_123',
    content: 'Text content...',
    policyName: 'Security Policy',
  }
);
```

### Utilities

```typescript
import { chunkText, extractTextFromPolicy } from '@/vector-store/lib';

// Chunk text into smaller pieces
const chunks = chunkText(longText, 500, 50); // 500 tokens, 50 overlap

// Extract text from TipTap JSON policy
const text = extractTextFromPolicy(policy);
```

## Files

### Core (`core/`)
- `client.ts` - Shared pgvector client (from `@gideon-defender/db`)
- `generate-embedding.ts` - OpenAI embedding generation
- `find-similar.ts` - Semantic search function
- `upsert-embedding.ts` - Embedding storage

### Sync (`sync/`)
- `sync-policies.ts`, `sync-context.ts`, `sync-manual-answer.ts`, `sync-knowledge-base.ts`,
  `sync-organization.ts` - Keep the vector store in sync with source documents.

### Utils (`utils/`)
- `chunk-text.ts` - Text chunking utility
- `extract-policy-text.ts` - TipTap JSON to text conversion

## Next Steps

After setting up vector search, you can:
1. Use `findSimilarContent()` in your auto-answer functionality
2. Create scheduled jobs to keep embeddings up-to-date
3. Add document hub support for additional context sources
