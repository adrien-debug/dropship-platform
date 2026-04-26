import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('getMedusaBaseUrl', () => {
  const origEnv = process.env;

  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    process.env = { ...origEnv };
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    process.env = origEnv;
  });

  it('returns trimmed MEDUSA_URL when set', async () => {
    vi.stubEnv('MEDUSA_URL', 'https://api.example.com/');
    vi.stubEnv('NODE_ENV', 'production');
    const { getMedusaBaseUrl } = await import('@/lib/medusa');
    expect(getMedusaBaseUrl()).toBe('https://api.example.com');
  });

  it('returns empty string in production when MEDUSA_URL missing', async () => {
    vi.stubEnv('MEDUSA_URL', '');
    vi.stubEnv('NODE_ENV', 'production');
    const { getMedusaBaseUrl } = await import('@/lib/medusa');
    expect(getMedusaBaseUrl()).toBe('');
  });

  it('uses dev fallback when MEDUSA_URL missing in development', async () => {
    vi.stubEnv('MEDUSA_URL', '');
    vi.stubEnv('NODE_ENV', 'development');
    const { getMedusaBaseUrl } = await import('@/lib/medusa');
    expect(getMedusaBaseUrl()).toMatch(/^https:\/\//);
  });
});

describe('getMedusaAuthMode', () => {
  const origEnv = process.env;

  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    process.env = { ...origEnv };
    delete process.env.MEDUSA_ADMIN_API_TOKEN;
    delete process.env.MEDUSA_ADMIN_EMAIL;
    delete process.env.MEDUSA_ADMIN_PASSWORD;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    process.env = origEnv;
  });

  it('returns api_token when MEDUSA_ADMIN_API_TOKEN is set', async () => {
    process.env.MEDUSA_ADMIN_API_TOKEN = 'secret';
    const { getMedusaAuthMode } = await import('@/lib/medusa');
    expect(getMedusaAuthMode()).toBe('api_token');
  });

  it('returns jwt when email and password set without token', async () => {
    process.env.MEDUSA_ADMIN_EMAIL = 'a@b.co';
    process.env.MEDUSA_ADMIN_PASSWORD = 'pw';
    const { getMedusaAuthMode } = await import('@/lib/medusa');
    expect(getMedusaAuthMode()).toBe('jwt');
  });

  it('returns missing when no credentials', async () => {
    const { getMedusaAuthMode } = await import('@/lib/medusa');
    expect(getMedusaAuthMode()).toBe('missing');
  });
});
