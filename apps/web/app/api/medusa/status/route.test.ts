import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { medusa } from '@/lib/medusa';
import { GET } from './route';

describe('GET /api/medusa/status', () => {
  let checkSpy: ReturnType<typeof vi.spyOn>;
  let verifySpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    checkSpy = vi.spyOn(medusa, 'checkConfig');
    verifySpy = vi.spyOn(medusa, 'verifyAdminConnection');
  });

  afterEach(() => {
    checkSpy.mockRestore();
    verifySpy.mockRestore();
  });

  it('returns 200 when config and admin probe succeed', async () => {
    checkSpy.mockReturnValue({ ok: true, message: 'Medusa configuré' });
    verifySpy.mockResolvedValue({
      healthOk: true,
      authMode: 'api_token',
      authOk: true,
      message: 'Medusa joignable',
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      config: { ok: boolean; message: string };
      authOk: boolean;
      healthOk: boolean;
    };
    expect(body.success).toBe(true);
    expect(body.config.ok).toBe(true);
    expect(body.authOk).toBe(true);
    expect(body.healthOk).toBe(true);
  });

  it('returns 200 with config.ok false when auth fails', async () => {
    checkSpy.mockReturnValue({ ok: true, message: 'URL ok' });
    verifySpy.mockResolvedValue({
      healthOk: true,
      authMode: 'missing',
      authOk: false,
      message: 'Bad credentials',
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { config: { ok: boolean; message: string } };
    expect(body.config.ok).toBe(false);
    expect(body.config.message).toBe('Bad credentials');
  });

  it('returns 500 when verifyAdminConnection throws', async () => {
    const logErr = vi.spyOn(console, 'error').mockImplementation(() => {});
    checkSpy.mockReturnValue({ ok: true, message: 'ok' });
    verifySpy.mockRejectedValue(new Error('network down'));
    const res = await GET();
    expect(res.status).toBe(500);
    const body = (await res.json()) as { success: boolean; config: { ok: boolean } };
    expect(body.success).toBe(false);
    expect(body.config.ok).toBe(false);
    logErr.mockRestore();
  });
});
