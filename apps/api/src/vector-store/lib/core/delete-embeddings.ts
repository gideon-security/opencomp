import { deleteVectorsByOrganization } from './client';
import { logger } from '../../logger';

/**
 * Deletes all embeddings for an organization from the vector database.
 * pgvector supports exact metadata filtering, so a single DELETE keyed on
 * organizationId replaces the search-then-delete approach required by the previous hosted vector database.
 */
export async function deleteOrganizationEmbeddings(
  organizationId: string,
): Promise<void> {
  if (!organizationId || organizationId.trim().length === 0) {
    logger.warn('Invalid organizationId provided for deletion');
    return;
  }

  try {
    await deleteVectorsByOrganization(organizationId);
    logger.info('Successfully deleted organization embeddings', {
      organizationId,
    });
  } catch (error) {
    logger.error('Failed to delete organization embeddings', {
      organizationId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}
