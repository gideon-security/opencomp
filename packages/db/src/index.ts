export * from '@prisma/client';
export { db, tenantDb, serviceDb, withTenant, withService } from './client';
export type { SslConfig } from './client';
export {
  vectorIndex,
  deleteVectorsByOrganization,
  findVectorsByFilter,
  listVectorsByOrganization,
  listVectorsByOrganizationAndType,
  countVectorsByOrganization,
} from './vector-index';
export type {
  VectorMetadata,
  VectorMetadataInput,
  VectorRecord,
  VectorRecordInput,
  VectorQueryOptions,
  VectorQueryResult,
  VectorFetchOptions,
  VectorFetchResult,
  VectorRangeOptions,
  VectorRangeResult,
  VectorInfoResult,
  VectorIndex,
} from './vector-index';
