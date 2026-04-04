import OpenAI from 'openai';

const getEmbeddingClient = () => new OpenAI({
  baseURL: process.env.VLLM_EMBEDDING_URL || 'http://100.88.191.49:8002/v1',
  apiKey: process.env.VLLM_API_KEY || 'not-needed',
});

export async function getEmbedding(text: string): Promise<number[]> {
  const client = getEmbeddingClient();
  const res = await client.embeddings.create({
    model: 'default',
    input: text,
  });
  return res.data[0]!.embedding;
}

export async function findSimilarProducts(
  queryEmbedding: number[],
  productEmbeddings: { id: string; embedding: number[] }[],
  topK = 5
): Promise<string[]> {
  const scored = productEmbeddings.map(p => ({
    id: p.id,
    score: cosineSimilarity(queryEmbedding, p.embedding),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).map(s => s.id);
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
