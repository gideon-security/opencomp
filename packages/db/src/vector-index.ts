import { Prisma } from '@prisma/client';
import { withService, withTenant } from './client';

// pgvector-backed vector store that mirrors the Upstash Vector index API used
// across apps/api/src/vector-store and apps/app/src/lib/embedding. Kept as a
// drop-in (query/upsert/fetch/delete/range/info) so the consuming modules
// required no structural changes during the migration off Upstash.
//
// The embedding column is VECTOR(1024) (both consumers embed to 1024 dims via
// self-hosted BAAI/bge-m3) and cosine similarity is used, matching Upstash's
// COSINE score scale: pgvector's `<=>` returns cosine distance in [0,2],
// Upstash returns (1+cos)/2 in [0,1], so score = 1 - distance/2.
//
// Every operation is tenant-scoped: callers must pass the owning
// `organizationId` and every query runs inside `withTenant` so Postgres RLS
// (see `packages/db/prisma/migrations/*_add_vector_embedding_rls`) enforces the
// same boundary the raw SQL already asserts with an explicit
// `"organizationId" = ...` predicate. System-level `info()` runs as the
// BYPASSRLS service role instead.

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
  organizationId: string;
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
  organizationId: string;
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
  fetch(
    ids: string[],
    organizationId: string,
    options?: VectorFetchOptions,
  ): Promise<VectorFetchResult[]>;
  delete(ids: string[], organizationId: string): Promise<void>;
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

// Only `sourceType`/`sourceId` may be supplied through the filter DSL — the
// owning `organizationId` is always added explicitly by the callers' tenant
// scope, so it is intentionally not read from the filter string.
const FILTER_COLUMNS = new Set(['sourceType', 'sourceId']);

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
//   `sourceType = "y" AND sourceId = "z"`.
// Only equality on the two indexed metadata columns is supported; anything
// else is ignored so queries degrade to a full similarity search.
function filterConditions(filter?: string): Prisma.Sql[] {
  if (!filter) return [];
  const conditions: Prisma.Sql[] = [];
  // Linear scan for `key = "value"` pairs instead of a regex exec loop —
  // CodeQL js/polynomial-redos: the equivalent pattern backtracks
  // quadratically on uncontrolled filter strings (e.g. long word-char runs
  // with no '='). This scan advances monotonically and never re-examines
  // characters, so worst case stays O(n).
  let idx = 0;
  while (idx < filter.length) {
    const eq = filter.indexOf('=', idx);
    if (eq === -1) break;

    // Walk backwards over whitespace, then over key characters.
    let keyEnd = eq;
    while (keyEnd > idx && /\s/.test(filter[keyEnd - 1]!)) keyEnd--;
    const isKeyChar = (ch: string) => /[A-Za-z0-9_]/.test(ch);
    let keyStart = keyEnd;
    while (keyStart > 0 && isKeyChar(filter[keyStart - 1]!)) keyStart--;
    const key = filter.slice(keyStart, keyEnd);

    if (key.length > 0 && /^[A-Za-z_]/.test(key) && FILTER_COLUMNS.has(key)) {
      // Skip whitespace after '=', then require an opening double quote.
      let v = eq + 1;
      while (v < filter.length && /\s/.test(filter[v]!)) v++;
      if (filter[v] === '"') {
        const close = filter.indexOf('"', v + 1);
        if (close === -1) break; // unterminated quote — nothing more to parse
        conditions.push(Prisma.sql`"${Prisma.raw(key)}" = ${filter.slice(v + 1, close)}`);
        idx = close + 1;
        continue;
      }
    }
    idx = eq + 1;
  }
  return conditions;
}

function tenantWhere(organizationId: string, filter?: string): Prisma.Sql {
  const conditions = [Prisma.sql`"organizationId" = ${organizationId}`];
  conditions.push(...filterConditions(filter));
  return Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;
}

function idsInClause(ids: string[]): Prisma.Sql {
  return Prisma.sql`IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}`))})`;
}

export const vectorIndex: VectorIndex | null = process.env.DATABASE_URL
  ? {
      async query({
        vector,
        topK,
        organizationId,
        includeMetadata = false,
        filter,
      }): Promise<VectorQueryResult[]> {
        const vectorLiteral = toVectorLiteral(vector);
        return withTenant(organizationId, async (tx) => {
          const rows = await tx.$queryRaw<VectorRow[]>(Prisma.sql`
            SELECT "id",
              1 - (("embedding" <=> ${vectorLiteral}::vector) / 2) AS "score",
              ${METADATA_SELECT}
            FROM "vector_embedding"
            ${tenantWhere(organizationId, filter)}
            ORDER BY "embedding" <=> ${vectorLiteral}::vector
            LIMIT ${topK}
          `);
          return rows.map((row) => ({
            id: row.id,
            score: Number(row.score),
            ...(includeMetadata ? { metadata: rowToMetadata(row) } : {}),
          }));
        });
      },

      async upsert({ id, vector, metadata }): Promise<{ id: string }> {
        await withTenant(metadata.organizationId, async (tx) => {
          await tx.$executeRaw(Prisma.sql`
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
        });
        return { id };
      },

      async fetch(
        ids,
        organizationId,
        options = {},
      ): Promise<VectorFetchResult[]> {
        if (ids.length === 0) return [];
        return withTenant(organizationId, async (tx) => {
          const rows = await tx.$queryRaw<VectorRow[]>(Prisma.sql`
            SELECT "id", ${options.includeVectors ? Prisma.sql`"embedding",` : Prisma.empty} ${METADATA_SELECT}
            FROM "vector_embedding"
            WHERE "id" ${idsInClause(ids)} AND "organizationId" = ${organizationId}
          `);
          return rows.map((row) => ({
            id: row.id,
            ...(options.includeVectors ? { vector: parseVector(row.embedding) } : {}),
            metadata: rowToMetadata(row),
          }));
        });
      },

      async delete(ids: string[], organizationId: string): Promise<void> {
        if (ids.length === 0) return;
        await withTenant(organizationId, async (tx) => {
          await tx.$executeRaw(Prisma.sql`
            DELETE FROM "vector_embedding"
            WHERE "id" ${idsInClause(ids)} AND "organizationId" = ${organizationId}
          `);
        });
      },

      async range({
        cursor = '0',
        limit,
        prefix = '',
        includeVectors = false,
        includeMetadata = false,
        organizationId,
      }): Promise<VectorRangeResult> {
        const pattern = `${escapeLike(prefix)}%`;
        return withTenant(organizationId, async (tx) => {
          const rows = await tx.$queryRaw<VectorRow[]>(Prisma.sql`
            SELECT "id", ${includeVectors ? Prisma.sql`"embedding",` : Prisma.empty} ${METADATA_SELECT}
            FROM "vector_embedding"
            WHERE "organizationId" = ${organizationId}
              AND "id" LIKE ${pattern} AND (${String(cursor)} = '' OR "id" > ${String(cursor)})
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
        });
      },

      async info(): Promise<VectorInfoResult> {
        return withService(async (tx) => {
          const rows = await tx.$queryRaw<Array<{ total: number }>>(Prisma.sql`
            SELECT count(*)::int AS "total" FROM "vector_embedding"
          `);
          return {
            totalVectorCount: rows[0]?.total ?? 0,
            pendingVectorCount: 0,
            dimension: 1024,
          };
        });
      },
    }
  : null;

export async function deleteVectorsByOrganization(organizationId: string): Promise<void> {
  await withTenant(organizationId, async (tx) => {
    await tx.$executeRaw(
      Prisma.sql`DELETE FROM "vector_embedding" WHERE "organizationId" = ${organizationId}`,
    );
  });
}

export async function findVectorsByFilter(input: {
  organizationId: string;
  sourceType: string;
  sourceId: string;
}): Promise<VectorRecord[]> {
  const rows = await withTenant(input.organizationId, async (tx) =>
    tx.$queryRaw<VectorRow[]>(Prisma.sql`
      SELECT "id", ${METADATA_SELECT}
      FROM "vector_embedding"
      WHERE "organizationId" = ${input.organizationId}
        AND "sourceType" = ${input.sourceType}
        AND "sourceId" = ${input.sourceId}
      ORDER BY "id"
    `),
  );
  return rows.map(rowToRecord);
}

export async function listVectorsByOrganizationAndType(
  organizationId: string,
  sourceType: string,
): Promise<VectorRecord[]> {
  const rows = await withTenant(organizationId, async (tx) =>
    tx.$queryRaw<VectorRow[]>(Prisma.sql`
      SELECT "id", ${METADATA_SELECT}
      FROM "vector_embedding"
      WHERE "organizationId" = ${organizationId}
        AND "sourceType" = ${sourceType}
      ORDER BY "id"
    `),
  );
  return rows.map(rowToRecord);
}

export async function listVectorsByOrganization(organizationId: string): Promise<VectorRecord[]> {
  const rows = await withTenant(organizationId, async (tx) =>
    tx.$queryRaw<VectorRow[]>(Prisma.sql`
      SELECT "id", ${METADATA_SELECT}
      FROM "vector_embedding"
      WHERE "organizationId" = ${organizationId}
      ORDER BY "id"
    `),
  );
  return rows.map(rowToRecord);
}

export async function countVectorsByOrganization(
  organizationId: string,
  sourceType?: string,
): Promise<{ total: number; bySourceType: Record<string, number> }> {
  const rows = await withTenant(organizationId, async (tx) => {
    const where = sourceType
      ? Prisma.sql`WHERE "organizationId" = ${organizationId} AND "sourceType" = ${sourceType}`
      : Prisma.sql`WHERE "organizationId" = ${organizationId}`;
    return tx.$queryRaw<Array<{ sourceType: string; count: number }>>(Prisma.sql`
      SELECT "sourceType", count(*)::int AS "count"
      FROM "vector_embedding"
      ${where}
      GROUP BY "sourceType"
    `);
  });
  const bySourceType: Record<string, number> = {};
  let total = 0;
  for (const row of rows) {
    bySourceType[row.sourceType] = row.count;
    total += row.count;
  }
  return { total, bySourceType };
}
