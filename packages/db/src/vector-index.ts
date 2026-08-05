import { Prisma } from '@prisma/client';
import { db } from './client';

// pgvector-backed vector store that mirrors the Upstash Vector index API used
// across apps/api/src/vector-store and apps/app/src/lib/embedding. Kept as a
// drop-in (query/upsert/fetch/delete/range/info) so the consuming modules
// required no structural changes during the migration off Upstash.
//
// The embedding column is VECTOR(1536) (both consumers embed to 1536 dims) and
// cosine similarity is used, matching Upstash's COSINE score scale: pgvector's
// `<=>` returns cosine distance in [0,2], Upstash returns (1+cos)/2 in [0,1],
// so score = 1 - distance/2.

export interface VectorMetadata {
  organizationId: string;
  sourceType: string;
  sourceId: string;
  content: string | null;
  policyName: string | null;
  contextQuestion: string | null;
  documentName: string | null;
  manualAnswerQuestion: string | null;
  department: string | null;
  updatedAt: string | null;
}

export interface VectorRecord {
  id: string;
  metadata: VectorMetadata;
}

// Upserts accept a partial metadata payload (optional fields may be omitted),
// matching how the API and app build metadata before writing.
export type VectorMetadataInput = Pick<
  VectorMetadata,
  'organizationId' | 'sourceType' | 'sourceId'
> &
  Partial<Omit<VectorMetadata, 'organizationId' | 'sourceType' | 'sourceId'>>;

export interface VectorRecordInput {
  id: string;
  vector: number[];
  metadata: VectorMetadataInput;
}

export interface VectorQueryOptions {
  vector: number[];
  topK: number;
  includeMetadata?: boolean;
  filter?: string;
}

export interface VectorQueryResult {
  id: string;
  score: number;
  metadata?: VectorMetadata;
}

export interface VectorFetchOptions {
  includeVectors?: boolean;
}

export interface VectorFetchResult {
  id: string;
  vector?: number[];
  metadata?: VectorMetadata;
}

export interface VectorRangeOptions {
  cursor?: string;
  limit: number;
  prefix?: string;
  includeVectors?: boolean;
  includeMetadata?: boolean;
}

export interface VectorRangeResult {
  vectors: VectorFetchResult[];
  nextCursor: string | null;
}

export interface VectorInfoResult {
  totalVectorCount: number;
  pendingVectorCount: number;
  dimension: number;
}

export interface VectorIndex {
  query(options: VectorQueryOptions): Promise<VectorQueryResult[]>;
  upsert(input: VectorRecordInput): Promise<{ id: string }>;
  fetch(ids: string[], options?: VectorFetchOptions): Promise<VectorFetchResult[]>;
  delete(ids: string[]): Promise<void>;
  range(options: VectorRangeOptions): Promise<VectorRangeResult>;
  info(): Promise<VectorInfoResult>;
}

interface VectorRow {
  id: string;
  score?: number | string;
  embedding?: string;
  organizationId: string;
  sourceType: string;
  sourceId: string;
  content: string | null;
  policyName: string | null;
  contextQuestion: string | null;
  documentName: string | null;
  manualAnswerQuestion: string | null;
  department: string | null;
  updatedAt: Date | null;
}

const METADATA_SELECT = Prisma.sql`
  "organizationId",
  "sourceType",
  "sourceId",
  "content",
  "policyName",
  "contextQuestion",
  "documentName",
  "manualAnswerQuestion",
  "department",
  "updatedAt"
`;

const FILTER_COLUMNS = new Set(['organizationId', 'sourceType', 'sourceId']);

function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(',')}]`;
}

function parseVector(value: unknown): number[] | undefined {
  if (Array.isArray(value)) return value as number[];
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      const inner = trimmed.slice(1, -1).trim();
      if (inner.length === 0) return [];
      return inner.split(',').map((part) => Number(part.trim()));
    }
  }
  return undefined;
}

function rowToMetadata(row: VectorRow): VectorMetadata {
  return {
    organizationId: row.organizationId,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    content: row.content,
    policyName: row.policyName,
    contextQuestion: row.contextQuestion,
    documentName: row.documentName,
    manualAnswerQuestion: row.manualAnswerQuestion,
    department: row.department,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

function rowToRecord(row: VectorRow): VectorRecord {
  return { id: row.id, metadata: rowToMetadata(row) };
}

function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

// Parses Upstash's filter DSL subset used by the codebase:
//   `organizationId = "x"` or `organizationId = "x" AND sourceType = "y"`.
// Only equality on the three indexed metadata columns is supported; anything
// else is ignored so queries degrade to a full similarity search.
function filterToWhere(filter?: string): Prisma.Sql {
  if (!filter) return Prisma.empty;
  const conditions: Prisma.Sql[] = [];
  const re = /([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(filter)) !== null) {
    const key = match[1];
    const value = match[2];
    if (key === undefined || value === undefined) continue;
    if (FILTER_COLUMNS.has(key)) {
      conditions.push(Prisma.sql`"${Prisma.raw(key)}" = ${value}`);
    }
  }
  if (conditions.length === 0) return Prisma.empty;
  return Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;
}

function idsInClause(ids: string[]): Prisma.Sql {
  return Prisma.sql`IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}`))})`;
}

export const vectorIndex: VectorIndex | null = process.env.DATABASE_URL
  ? {
      async query({ vector, topK, includeMetadata = false, filter }): Promise<VectorQueryResult[]> {
        const vectorLiteral = toVectorLiteral(vector);
        const rows = await db.$queryRaw<VectorRow[]>(Prisma.sql`
          SELECT "id",
            1 - (("embedding" <=> ${vectorLiteral}::vector) / 2) AS "score",
            ${METADATA_SELECT}
          FROM "vector_embedding"
          ${filterToWhere(filter)}
          ORDER BY "embedding" <=> ${vectorLiteral}::vector
          LIMIT ${topK}
        `);
        return rows.map((row) => ({
          id: row.id,
          score: Number(row.score),
          ...(includeMetadata ? { metadata: rowToMetadata(row) } : {}),
        }));
      },

      async upsert({ id, vector, metadata }): Promise<{ id: string }> {
        await db.$executeRaw(Prisma.sql`
          INSERT INTO "vector_embedding" (
            "id", "embedding", "organizationId", "sourceType", "sourceId",
            "content", "policyName", "contextQuestion", "documentName",
            "manualAnswerQuestion", "department", "updatedAt"
          ) VALUES (
            ${id}, ${toVectorLiteral(vector)}::vector, ${metadata.organizationId},
            ${metadata.sourceType}, ${metadata.sourceId},
            ${metadata.content ?? null},
            ${metadata.policyName ?? null}, ${metadata.contextQuestion ?? null},
            ${metadata.documentName ?? null},
            ${metadata.manualAnswerQuestion ?? null},
            ${metadata.department ?? null},
            ${metadata.updatedAt ? new Date(metadata.updatedAt) : null}
          )
          ON CONFLICT ("id") DO UPDATE SET
            "embedding" = EXCLUDED."embedding",
            "organizationId" = EXCLUDED."organizationId",
            "sourceType" = EXCLUDED."sourceType",
            "sourceId" = EXCLUDED."sourceId",
            "content" = EXCLUDED."content",
            "policyName" = EXCLUDED."policyName",
            "contextQuestion" = EXCLUDED."contextQuestion",
            "documentName" = EXCLUDED."documentName",
            "manualAnswerQuestion" = EXCLUDED."manualAnswerQuestion",
            "department" = EXCLUDED."department",
            "updatedAt" = EXCLUDED."updatedAt"
        `);
        return { id };
      },

      async fetch(ids, options = {}): Promise<VectorFetchResult[]> {
        if (ids.length === 0) return [];
        const rows = await db.$queryRaw<VectorRow[]>(Prisma.sql`
          SELECT "id", ${options.includeVectors ? Prisma.sql`"embedding",` : Prisma.empty} ${METADATA_SELECT}
          FROM "vector_embedding"
          WHERE "id" ${idsInClause(ids)}
        `);
        return rows.map((row) => ({
          id: row.id,
          ...(options.includeVectors ? { vector: parseVector(row.embedding) } : {}),
          metadata: rowToMetadata(row),
        }));
      },

      async delete(ids: string[]): Promise<void> {
        if (ids.length === 0) return;
        await db.$executeRaw(Prisma.sql`
          DELETE FROM "vector_embedding"
          WHERE "id" ${idsInClause(ids)}
        `);
      },

      async range({
        cursor = '0',
        limit,
        prefix = '',
        includeVectors = false,
        includeMetadata = false,
      }): Promise<VectorRangeResult> {
        const pattern = `${escapeLike(prefix)}%`;
        const rows = await db.$queryRaw<VectorRow[]>(Prisma.sql`
          SELECT "id", ${includeVectors ? Prisma.sql`"embedding",` : Prisma.empty} ${METADATA_SELECT}
          FROM "vector_embedding"
          WHERE "id" LIKE ${pattern} AND (${String(cursor)} = '' OR "id" > ${String(cursor)})
          ORDER BY "id"
          LIMIT ${limit + 1}
        `);
        const hasMore = rows.length > limit;
        const page = hasMore ? rows.slice(0, limit) : rows;
        return {
          vectors: page.map((row) => ({
            id: row.id,
            ...(includeVectors ? { vector: parseVector(row.embedding) } : {}),
            ...(includeMetadata ? { metadata: rowToMetadata(row) } : {}),
          })),
          nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
        };
      },

      async info(): Promise<VectorInfoResult> {
        const rows = await db.$queryRaw<Array<{ total: number }>>(Prisma.sql`
          SELECT count(*)::int AS "total" FROM "vector_embedding"
        `);
        return {
          totalVectorCount: rows[0]?.total ?? 0,
          pendingVectorCount: 0,
          dimension: 1536,
        };
      },
    }
  : null;

export async function deleteVectorsByOrganization(organizationId: string): Promise<void> {
  await db.$executeRaw(Prisma.sql`DELETE FROM "vector_embedding" WHERE "organizationId" = ${organizationId}`);
}

export async function findVectorsByFilter(input: {
  organizationId: string;
  sourceType: string;
  sourceId: string;
}): Promise<VectorRecord[]> {
  const rows = await db.$queryRaw<VectorRow[]>(Prisma.sql`
    SELECT "id", ${METADATA_SELECT}
    FROM "vector_embedding"
    WHERE "organizationId" = ${input.organizationId}
      AND "sourceType" = ${input.sourceType}
      AND "sourceId" = ${input.sourceId}
    ORDER BY "id"
  `);
  return rows.map(rowToRecord);
}

export async function listVectorsByOrganizationAndType(
  organizationId: string,
  sourceType: string,
): Promise<VectorRecord[]> {
  const rows = await db.$queryRaw<VectorRow[]>(Prisma.sql`
    SELECT "id", ${METADATA_SELECT}
    FROM "vector_embedding"
    WHERE "organizationId" = ${organizationId}
      AND "sourceType" = ${sourceType}
    ORDER BY "id"
  `);
  return rows.map(rowToRecord);
}

export async function listVectorsByOrganization(organizationId: string): Promise<VectorRecord[]> {
  const rows = await db.$queryRaw<VectorRow[]>(Prisma.sql`
    SELECT "id", ${METADATA_SELECT}
    FROM "vector_embedding"
    WHERE "organizationId" = ${organizationId}
    ORDER BY "id"
  `);
  return rows.map(rowToRecord);
}

export async function countVectorsByOrganization(
  organizationId: string,
  sourceType?: string,
): Promise<{ total: number; bySourceType: Record<string, number> }> {
  const where = sourceType
    ? Prisma.sql`WHERE "organizationId" = ${organizationId} AND "sourceType" = ${sourceType}`
    : Prisma.sql`WHERE "organizationId" = ${organizationId}`;
  const rows = await db.$queryRaw<Array<{ sourceType: string; count: number }>>(Prisma.sql`
    SELECT "sourceType", count(*)::int AS "count"
    FROM "vector_embedding"
    ${where}
    GROUP BY "sourceType"
  `);
  const bySourceType: Record<string, number> = {};
  let total = 0;
  for (const row of rows) {
    bySourceType[row.sourceType] = row.count;
    total += row.count;
  }
  return { total, bySourceType };
}
