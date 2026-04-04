import { NextResponse } from 'next/server';

const VLLM_API_KEY = process.env.VLLM_API_KEY || 'vllm-local-key';
const GPU1 = process.env.GPU1_HOST || '100.88.191.49';
const GPU2 = process.env.GPU2_HOST || '100.110.74.114';

interface ModelInfo { id: string; port: number; status: 'up' | 'down' }

async function checkModel(host: string, port: number): Promise<ModelInfo> {
  try {
    const res = await fetch(`http://${host}:${port}/v1/models`, {
      headers: { Authorization: `Bearer ${VLLM_API_KEY}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok && res.status !== 401) return { id: `port-${port}`, port, status: 'down' };
    if (res.status === 401) return { id: `port-${port} (auth)`, port, status: 'up' };
    const data = await res.json();
    const modelId = data?.data?.[0]?.id ?? `port-${port}`;
    return { id: modelId, port, status: 'up' };
  } catch {
    return { id: `port-${port}`, port, status: 'down' };
  }
}

export async function GET() {
  const [m32b, m7b, mEmbed, mReason] = await Promise.all([
    checkModel(GPU1, 8000),
    checkModel(GPU1, 8001),
    checkModel(GPU1, 8002),
    checkModel(GPU1, 8003),
  ]);

  const models = [m32b, m7b, mEmbed, mReason];

  return NextResponse.json({
    nodes: [
      { name: 'GPU1', host: GPU1, models, status: models.some(m => m.status === 'up') ? 'up' : 'down' },
      { name: 'GPU2', host: GPU2, services: ['Medusa', 'Storefront', 'OpenClaw', 'Admin'], status: 'up' },
    ],
    summary: { total_models: models.length, up: models.filter(m => m.status === 'up').length },
  });
}
