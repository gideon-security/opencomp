import {
  countVectorsByOrganization,
  listVectorsByOrganizationAndType,
} from './client';
import { logger } from '../../logger';

/**
 * Counts embeddings for a specific organization and source type.
 * Exact metadata counts from the vector_embedding table.
 */
export async function countEmbeddings(
  organizationId: string,
  sourceType?: 'policy' | 'context' | 'manual_answer',
): Promise<{
  total: number;
  bySourceType: Record<string, number>;
  error?: string;
}> {
  if (!organizationId || organizationId.trim().length === 0) {
    return {
      total: 0,
      bySourceType: {},
      error: 'Invalid organizationId',
    };
  }

  try {
    const result = await countVectorsByOrganization(
      organizationId,
      sourceType,
    );

    logger.info('Counted embeddings', {
      organizationId,
      sourceType: sourceType || 'all',
      total: result.total,
      bySourceType: result.bySourceType,
    });

    return {
      total: result.total,
      bySourceType: result.bySourceType,
    };
  } catch (error) {
    logger.error('Failed to count embeddings', {
      organizationId,
      sourceType,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return {
      total: 0,
      bySourceType: {},
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Lists all manual answer embeddings for an organization.
 * Uses exact metadata filtering on the vector_embedding table.
 */
export async function listManualAnswerEmbeddings(
  organizationId: string,
): Promise<
  Array<{
    id: string;
    sourceId: string;
    content: string;
    updatedAt?: string;
  }>
> {
  if (!organizationId || organizationId.trim().length === 0) {
    return [];
  }

  try {
    const embeddings = await listVectorsByOrganizationAndType(
      organizationId,
      'manual_answer',
    );

    const manualAnswerEmbeddings = embeddings.map((e) => ({
      id: e.id,
      sourceId: e.metadata.sourceId,
      content: e.metadata.content || '',
      updatedAt: e.metadata.updatedAt ?? undefined,
    }));

    logger.info('Listed manual answer embeddings', {
      organizationId,
      count: manualAnswerEmbeddings.length,
      ids: manualAnswerEmbeddings.map((e) => e.id),
    });

    return manualAnswerEmbeddings;
  } catch (error) {
    logger.error('Failed to list manual answer embeddings', {
      organizationId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return [];
  }
}
