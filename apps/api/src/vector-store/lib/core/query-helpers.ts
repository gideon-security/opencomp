import { vectorIndex } from './client';
import { generateEmbedding } from './generate-embedding';
import { logger } from '../../logger';

export type SourceType =
  'policy' | 'context' | 'manual_answer' | 'knowledge_base_document';

export interface ExistingEmbedding {
  id: string;
  sourceId: string;
  sourceType: SourceType;
  updatedAt?: string;
}

interface QueryFilter {
  organizationId: string;
  sourceType: SourceType;
  sourceId: string;
}

/**
 * Execute a vector query and filter results by metadata
 */
async function executeVectorQuery(
  queryText: string,
  filter: QueryFilter,
  strategyName: string,
): Promise<ExistingEmbedding[]> {
  if (!vectorIndex) {
    return [];
  }

  try {
    const queryEmbedding = await generateEmbedding(queryText);
    const results = await vectorIndex.query({
      vector: queryEmbedding,
      topK: 100,
      organizationId: filter.organizationId,
      includeMetadata: true,
      // Server-side metadata filtering (exact match on the indexed columns) so
      // we never depend on top-K recall to find every chunk of a source.
      filter: `organizationId = "${filter.organizationId}" AND sourceType = "${filter.sourceType}" AND sourceId = "${filter.sourceId}"`,
    });

    return filterAndMapResults(results, filter);
  } catch (error) {
    logger.warn(`Error in ${strategyName} query strategy`, {
      sourceId: filter.sourceId,
      sourceType: filter.sourceType,
      organizationId: filter.organizationId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return [];
  }
}

/**
 * Filter vector query results by metadata and map to ExistingEmbedding
 */
function filterAndMapResults(
  results: Array<{ id: string | number; metadata?: unknown }>,
  filter: QueryFilter,
): ExistingEmbedding[] {
  const filtered: ExistingEmbedding[] = [];

  for (const result of results) {
    const metadata = result.metadata as Record<string, unknown> | undefined;
    if (
      metadata?.organizationId === filter.organizationId &&
      metadata?.sourceType === filter.sourceType &&
      metadata?.sourceId === filter.sourceId
    ) {
      filtered.push({
        id: String(result.id),
        sourceId: metadata?.sourceId || '',
        sourceType: metadata?.sourceType as SourceType,
        updatedAt: metadata?.updatedAt as string | undefined,
      });
    }
  }

  return filtered;
}

/**
 * Add embeddings to a Map, avoiding duplicates
 */
function addToResultsMap(
  resultsMap: Map<string, ExistingEmbedding>,
  embeddings: ExistingEmbedding[],
): void {
  for (const embedding of embeddings) {
    if (!resultsMap.has(embedding.id)) {
      resultsMap.set(embedding.id, embedding);
    }
  }
}
