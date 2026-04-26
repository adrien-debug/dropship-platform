import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('GET /api/medusa/health', () => {
  const origEnv = process.env;
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    process.env = { ...origEnv };
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    process.env = origEnv;
    vi.unstubAllGlobals();
  });

  it('returns 503 when MEDUSA_URL missing in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('MEDUSA_URL', '');
    const { GET } = await import('./route');
    const res = await GET();
    expect(res.status).toBe(503);
    const body = (await res.json()) as { success: boolean; error: string };
    expect(body.success).toBe(false);
    expect(body.error).toContain('MEDUSA_URL');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('proxies Medusa /health when URL configured', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('MEDUSA_URL', 'https://medusa.example.com');
    fetchMock.mockResolvedValue(new Response('ok', { status: 200 }));
    const { GET } = await import('./route');
    const res = await GET();
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://medusa.example.com/health',
      expect.objectContaining({ method: 'GET' }),
    );
    const body = (await res.json()) as { success: boolean; status: number };
    expect(body.success).toBe(true);
    expect(body.status).toBe(200);
  });
});
