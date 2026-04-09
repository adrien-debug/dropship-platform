import OpenAI from 'openai';

export function createVLLMClient(baseURL?: string, apiKey?: string): OpenAI {
  return new OpenAI({
    baseURL: baseURL || process.env.VLLM_GPU1_URL || 'http://100.88.191.49:8000/v1',
    apiKey: apiKey || process.env.VLLM_API_KEY || 'not-needed',
  });
}

const heavy = () => createVLLMClient(process.env.VLLM_GPU1_URL);
const fast = () => createVLLMClient(process.env.VLLM_GPU1_FAST_URL || 'http://100.88.191.49:8001/v1');

export async function generateProductDescription(product: {
  name: string;
  category: string;
  costCents: number;
}): Promise<string> {
  const client = heavy();
  const res = await client.chat.completions.create({
    model: 'default',
    messages: [{
      role: 'system',
      content: 'You are an expert e-commerce copywriter. Write compelling, SEO-optimized product descriptions in French. Be concise (150-200 words). Include key selling points, materials, and usage suggestions.',
    }, {
      role: 'user',
      content: `Write a product description for: "${product.name}" in category "${product.category}". Base price: ${(product.costCents / 100).toFixed(2)} EUR.`,
    }],
    max_tokens: 500,
    temperature: 0.7,
  });
  return res.choices[0]?.message?.content ?? '';
}

export async function generateSEOMeta(product: {
  name: string;
  category: string;
  description: string;
}): Promise<{ title: string; description: string; keywords: string[] }> {
  const client = fast();
  const res = await client.chat.completions.create({
    model: 'default',
    messages: [{
      role: 'system',
      content: 'Generate SEO metadata for an e-commerce product. Return JSON with: title (max 60 chars), description (max 160 chars), keywords (array of 5-10 terms). French language.',
    }, {
      role: 'user',
      content: `Product: ${product.name}\nCategory: ${product.category}\nDescription: ${product.description.slice(0, 300)}`,
    }],
    max_tokens: 300,
    temperature: 0.3,
    response_format: { type: 'json_object' },
  });
  try {
    return JSON.parse(res.choices[0]?.message?.content ?? '{}');
  } catch {
    return { title: product.name, description: '', keywords: [] };
  }
}

const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 200;

export async function generateBatchDescriptions(products: {
  name: string;
  category: string;
  costCents: number;
}[]): Promise<string[]> {
  const results: string[] = [];
  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map(p => generateProductDescription(p)));
    results.push(...batchResults);
    if (i + BATCH_SIZE < products.length) {
      await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
    }
  }
  return results;
}
