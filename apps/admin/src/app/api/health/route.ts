import { NextResponse } from 'next/server';

interface ServiceCheck {
  name: string;
  url: string;
  status: 'up' | 'down' | 'degraded';
  latencyMs?: number;
  details?: string;
}

async function checkService(name: string, url: string, timeout = 5000): Promise<ServiceCheck> {
  const start = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeout) });
    const latencyMs = Date.now() - start;
    return {
      name,
      url,
      status: res.ok ? 'up' : 'degraded',
      latencyMs,
      details: `HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      name,
      url,
      status: 'down',
      latencyMs: Date.now() - start,
      details: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

export async function GET() {
  const checks = await Promise.all([
    checkService('Storefront', 'http://100.110.74.114:3100'),
    checkService('Medusa API', 'http://100.110.74.114:9000/health'),
    checkService('Medusa Admin', 'http://100.110.74.114:9000/app'),
    checkService('Coolify', 'http://100.110.74.114:8000'),
    checkService('vLLM GPU1 (32B)', 'http://100.88.191.49:8000/v1/models'),
    checkService('vLLM GPU1 (7B)', 'http://100.88.191.49:8001/v1/models'),
    checkService('vLLM GPU2', 'http://100.110.74.114:8000/v1/models'),
    checkService('ComfyUI', 'http://100.88.191.49:8188'),
    checkService('Supabase', `${process.env.SUPABASE_URL || 'https://tbachsziohjydqisbfio.supabase.co'}/rest/v1/`, 3000),
  ]);

  const allUp = checks.every((c) => c.status === 'up');
  const anyDown = checks.some((c) => c.status === 'down');

  return NextResponse.json({
    status: allUp ? 'healthy' : anyDown ? 'unhealthy' : 'degraded',
    timestamp: new Date().toISOString(),
    services: checks,
    summary: {
      total: checks.length,
      up: checks.filter((c) => c.status === 'up').length,
      degraded: checks.filter((c) => c.status === 'degraded').length,
      down: checks.filter((c) => c.status === 'down').length,
    },
  });
}
