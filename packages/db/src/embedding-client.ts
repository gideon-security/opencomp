/**
 * Self-hosted embedding client, shared by apps/app (linkage) and apps/api
 * (RAG vector-store). Replaces the OpenAI text-embedding-3-large / -small
 * pipeline with BAAI/bge-m3 (1024 dims) served by a local Ollama container.
 *
 * Point `EMBEDDINGS_BASE_URL` at any provider exposing the same JSON API
 * (`POST /api/embed` → `{ embeddings: number[][] }`) — the Ollama container in
 * dev, or TEI on amd64 servers in prod. Responses that are a bare array (TEI's
 * legacy shape) are accepted too.
 */

const DEFAULT_EMBEDDINGS_BASE_URL = 'http://localhost:11434';

export const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL ?? 'bge-m3';
export const EMBEDDING_DIMENSIONS = 1024;

/**
 * Embed a batch of texts. Empty/whitespace-only inputs are dropped, so the
 * returned array may be shorter than `texts` — callers that must preserve
 * index alignment (apps/api) do their own filtering/mapping.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const valid = texts.filter((text) => text.trim().length > 0);
  if (valid.length === 0) return [];

  const baseUrl = process.env.EMBEDDINGS_BASE_URL ?? DEFAULT_EMBEDDINGS_BASE_URL;
  const response = await fetch(`${baseUrl}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: valid }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(
      `Embedding request to ${baseUrl} failed (${response.status}): ${body}`,
    );
  }

  const data: unknown = await response.json();
  const embeddings = Array.isArray(data)
    ? (data as number[][])
    : (data as { embeddings?: number[][] }).embeddings;

  if (!embeddings) {
    throw new Error(`Embedding response from ${baseUrl} is missing embeddings`);
  }
  return embeddings;
}
