import { embedTexts } from '@gideon-defender/db';

/**
 * Generates an embedding vector for the given text using the self-hosted
 * embedding service (BAAI/bge-m3 via Ollama; see `embedTexts` in
 * @gideon-defender/db).
 * @param text - The text to generate an embedding for
 * @returns An array of numbers representing the embedding vector
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const [embedding] = await embedTexts([text]);
    if (!embedding) {
      throw new Error('Empty embedding returned');
    }
    return embedding;
  } catch (error) {
    throw new Error(
      `Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

/**
 * Generates embedding vectors for multiple texts in a single batch request.
 * Much faster than calling generateEmbedding() multiple times.
 *
 * @param texts - Array of texts to generate embeddings for
 * @returns Array of embedding vectors in the same order as input texts
 */
export async function batchGenerateEmbeddings(
  texts: string[],
): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  // Filter out empty texts and track their indices
  const validTexts: { text: string; originalIndex: number }[] = [];
  texts.forEach((text, index) => {
    if (text && text.trim().length > 0) {
      validTexts.push({ text: text.trim(), originalIndex: index });
    }
  });

  if (validTexts.length === 0) {
    return texts.map(() => []);
  }

  try {
    const embeddings = await embedTexts(validTexts.map((v) => v.text));

    // Map embeddings back to original indices, filling empty arrays for skipped texts
    const result: number[][] = texts.map(() => []);
    validTexts.forEach((item, idx) => {
      result[item.originalIndex] = embeddings[idx];
    });

    return result;
  } catch (error) {
    throw new Error(
      `Failed to generate batch embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}
