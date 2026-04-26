import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GET } from './route';

describe('GET /api/suppliers/config', () => {
  const orig = { ...process.env };

  beforeEach(() => {
    delete process.env.ALIEXPRESS_APP_KEY;
    delete process.env.CJ_DROPSHIPPING_EMAIL;
    delete process.env.CJ_DROPSHIPPING_API_KEY;
  });

  afterEach(() => {
    process.env = { ...orig };
  });

  it('reports not configured when env keys missing', async () => {
    const res = await GET();
    const body = (await res.json()) as {
      success: boolean;
      config: {
        aliexpress: { configured: boolean };
        cjdropshipping: { configured: boolean };
      };
    };
    expect(body.success).toBe(true);
    expect(body.config.aliexpress.configured).toBe(false);
    expect(body.config.cjdropshipping.configured).toBe(false);
  });

  it('reports configured when credentials present', async () => {
    process.env.ALIEXPRESS_APP_KEY = 'k';
    process.env.CJ_DROPSHIPPING_EMAIL = 'e@e.com';
    process.env.CJ_DROPSHIPPING_API_KEY = 'apikey';
    const res = await GET();
    const body = (await res.json()) as {
      config: {
        aliexpress: { configured: boolean };
        cjdropshipping: { configured: boolean };
      };
    };
    expect(body.config.aliexpress.configured).toBe(true);
    expect(body.config.cjdropshipping.configured).toBe(true);
  });
});
