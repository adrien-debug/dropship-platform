import { NextResponse } from 'next/server';

const GPU1_BACKEND = process.env.GPU1_BACKEND_URL || 'http://100.88.191.49:3848';

export async function GET() {
  try {
    const res = await fetch(`${GPU1_BACKEND}/server-control/status`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`GPU backend: ${res.status}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error('[gpu-status] Proxy error:', err);
    return NextResponse.json({ nodes: [], error: 'Cannot connect to GPU servers' }, { status: 502 });
  }
}
