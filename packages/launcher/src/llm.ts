const VLLM_URL = process.env['VLLM_GPU1_URL'] || 'http://100.88.191.49:8000/v1';
const VLLM_API_KEY = process.env['VLLM_API_KEY'] || 'vllm-local-key';
const VLLM_MODEL = process.env['VLLM_MODEL'] || 'Qwen/Qwen2.5-Coder-32B-Instruct-AWQ';

export async function llmComplete(prompt: string, maxTokens = 8192): Promise<string> {
  const res = await fetch(`${VLLM_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${VLLM_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: VLLM_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature: 0.1,
      stream: false,
    }),
    signal: AbortSignal.timeout(300_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`LLM ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json() as {
    choices?: { message?: { content?: string } }[];
  };

  return data.choices?.[0]?.message?.content ?? '';
}
