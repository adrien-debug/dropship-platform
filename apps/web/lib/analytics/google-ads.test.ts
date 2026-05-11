import { describe, it, expect, beforeEach, vi } from 'vitest';
import { sendGoogleAdsConversion, _resetTokenCache, _injectCachedToken } from './google-ads';
import type { FunnelEvent } from './funnel';

// ── Helpers ──────────────────────────────────────────────────────────────────

type StoreSlice = {
  googleAdsConversionAction: string | null;
  googleAdsMerchantId: string | null;
};

const STORE: StoreSlice = {
  googleAdsConversionAction: 'customers/2877134493/conversionActions/987654321',
  googleAdsMerchantId: '5784865611',
};

function makeEvent(overrides: Partial<FunnelEvent> = {}): FunnelEvent {
  return {
    storeSlug: 'test-store',
    sessionId: 'sess-abc',
    eventName: 'purchase',
    eventId: 'evt-uuid-1',
    productId: 'prod_1',
    valueMinor: 4999,
    currencyCode: 'eur',
    email: 'buyer@example.com',
    phone: '+33612345678',
    medusaOrderId: 'order_123',
    gclid: 'Cj0KCQjw0test',
    ...overrides,
  };
}

// Token + conversion API capture helpers
type CapturedCall = { url: string; headers: Record<string, string>; body: unknown };

function setupFetchMock(
  tokenResponse: unknown = { access_token: 'mock-access-token', expires_in: 3600 },
  conversionStatus = 200,
  conversionBody: unknown = {},
): { tokenCalls: CapturedCall[]; conversionCalls: CapturedCall[] } {
  const tokenCalls: CapturedCall[] = [];
  const conversionCalls: CapturedCall[] = [];

  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const headers = (init?.headers as Record<string, string>) ?? {};
    let body: unknown;
    try {
      body = JSON.parse((init?.body as string) ?? 'null');
    } catch {
      body = init?.body;
    }

    if (url.includes('oauth2.googleapis.com')) {
      tokenCalls.push({ url, headers, body });
      return new Response(JSON.stringify(tokenResponse), { status: 200 });
    }

    conversionCalls.push({ url, headers, body });
    return new Response(JSON.stringify(conversionBody), { status: conversionStatus });
  });

  return { tokenCalls, conversionCalls };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('sendGoogleAdsConversion', () => {
  beforeEach(() => {
    _resetTokenCache();
    vi.unstubAllGlobals();

    // Default env — all required vars present.
    vi.stubEnv('GOOGLE_ADS_DEVELOPER_TOKEN', 'dev-token-xyz');
    vi.stubEnv('GOOGLE_ADS_CLIENT_ID', 'client-id-xyz');
    vi.stubEnv('GOOGLE_ADS_CLIENT_SECRET', 'client-secret-xyz');
    vi.stubEnv('GOOGLE_ADS_REFRESH_TOKEN', 'refresh-token-xyz');
    vi.stubEnv('GOOGLE_ADS_CUSTOMER_ID', '2877134493');
    vi.stubEnv('GOOGLE_ADS_LOGIN_CUSTOMER_ID', '');
  });

  // 1. No-op when conversion action not set
  it('no-ops when googleAdsConversionAction is not set', async () => {
    const { conversionCalls } = setupFetchMock();
    await sendGoogleAdsConversion(
      { ...STORE, googleAdsConversionAction: null },
      makeEvent(),
    );
    expect(conversionCalls).toHaveLength(0);
  });

  // 2. No-op when env vars missing
  it('no-ops when GOOGLE_ADS_DEVELOPER_TOKEN is absent', async () => {
    vi.stubEnv('GOOGLE_ADS_DEVELOPER_TOKEN', '');
    const { conversionCalls } = setupFetchMock();
    await sendGoogleAdsConversion(STORE, makeEvent());
    expect(conversionCalls).toHaveLength(0);
  });

  it('no-ops when GOOGLE_ADS_CLIENT_ID is absent', async () => {
    vi.stubEnv('GOOGLE_ADS_CLIENT_ID', '');
    const { conversionCalls } = setupFetchMock();
    await sendGoogleAdsConversion(STORE, makeEvent());
    expect(conversionCalls).toHaveLength(0);
  });

  it('no-ops when GOOGLE_ADS_REFRESH_TOKEN is absent', async () => {
    vi.stubEnv('GOOGLE_ADS_REFRESH_TOKEN', '');
    const { conversionCalls } = setupFetchMock();
    await sendGoogleAdsConversion(STORE, makeEvent());
    expect(conversionCalls).toHaveLength(0);
  });

  // 3. No-op when event is not purchase
  it('no-ops when event is not purchase', async () => {
    const { conversionCalls } = setupFetchMock();
    for (const name of ['page_view', 'view_content', 'add_to_cart', 'initiate_checkout'] as const) {
      await sendGoogleAdsConversion(STORE, makeEvent({ eventName: name }));
    }
    expect(conversionCalls).toHaveLength(0);
  });

  // 4. No-op when no gclid AND no email AND no phone
  it('no-ops when no gclid, email or phone', async () => {
    const { conversionCalls } = setupFetchMock();
    await sendGoogleAdsConversion(
      STORE,
      makeEvent({ gclid: undefined, email: undefined, phone: undefined }),
    );
    expect(conversionCalls).toHaveLength(0);
  });

  // 5. Refreshes OAuth token before first upload
  it('fetches an access token before the first conversion upload', async () => {
    const { tokenCalls, conversionCalls } = setupFetchMock();
    await sendGoogleAdsConversion(STORE, makeEvent());
    expect(tokenCalls).toHaveLength(1);
    expect(tokenCalls[0].url).toContain('oauth2.googleapis.com');
    expect(conversionCalls).toHaveLength(1);
  });

  // 6. Caches token and doesn't re-fetch within TTL
  it('reuses cached token on subsequent calls', async () => {
    const { tokenCalls } = setupFetchMock();
    await sendGoogleAdsConversion(STORE, makeEvent());
    await sendGoogleAdsConversion(STORE, makeEvent());
    // Token should have been fetched only once.
    expect(tokenCalls).toHaveLength(1);
  });

  it('does not re-fetch when token injected with future expiry', async () => {
    _injectCachedToken({ accessToken: 'pre-cached-token', expiresAt: Date.now() + 60 * 60 * 1000 });
    const { tokenCalls, conversionCalls } = setupFetchMock();
    await sendGoogleAdsConversion(STORE, makeEvent());
    expect(tokenCalls).toHaveLength(0);
    expect(conversionCalls).toHaveLength(1);
    // Verify the pre-cached token was used.
    const headers = conversionCalls[0].headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer pre-cached-token');
  });

  // 7. Correctly formats the conversion payload
  it('sends correct conversion payload with gclid, hashed email, value', async () => {
    const { conversionCalls } = setupFetchMock();
    await sendGoogleAdsConversion(
      STORE,
      makeEvent({
        gclid: 'gclid-test-123',
        email: 'Buyer@Example.COM',
        phone: undefined,
        valueMinor: 1999,
        currencyCode: 'eur',
        medusaOrderId: 'order_42',
      }),
    );

    expect(conversionCalls).toHaveLength(1);
    const body = conversionCalls[0].body as {
      conversions: Array<Record<string, unknown>>;
      partialFailure: boolean;
    };
    expect(body.partialFailure).toBe(true);
    const conv = body.conversions[0];
    expect(conv.gclid).toBe('gclid-test-123');
    // SHA-256 of 'buyer@example.com' (lowercase trimmed)
    expect(conv.hashedEmail).toBe(
      '6a6c26195c3682faa816966af789717c3bfa834eee6c599d667d2b3429c27cfd',
    );
    expect(conv.conversionValue).toBe(19.99);
    expect(conv.currencyCode).toBe('EUR');
    expect(conv.orderId).toBe('order_42');
    expect(conv.conversionAction).toBe(STORE.googleAdsConversionAction);
  });

  // 8. Swallows API errors — never throws
  it('does not throw when the Google Ads API returns 5xx', async () => {
    setupFetchMock(
      { access_token: 'tok', expires_in: 3600 },
      500,
      { error: { message: 'internal error' } },
    );
    await expect(sendGoogleAdsConversion(STORE, makeEvent())).resolves.toBeUndefined();
  });

  it('does not throw on network error', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new Error('network failure');
    });
    await expect(sendGoogleAdsConversion(STORE, makeEvent())).resolves.toBeUndefined();
  });

  // 9. Handles partial failure response gracefully
  it('handles partialFailureError in response without throwing', async () => {
    setupFetchMock(
      { access_token: 'tok', expires_in: 3600 },
      200,
      {
        partialFailureError: {
          code: 3,
          message: 'Request contains an invalid argument.',
          details: [],
        },
      },
    );
    await expect(sendGoogleAdsConversion(STORE, makeEvent())).resolves.toBeUndefined();
  });

  // 10. Uses store.googleAdsConversionAction, not a hardcoded customer ID
  it('uses store.googleAdsConversionAction in the payload', async () => {
    const customAction = 'customers/9999999999/conversionActions/111222333';
    const { conversionCalls } = setupFetchMock();
    await sendGoogleAdsConversion(
      { ...STORE, googleAdsConversionAction: customAction },
      makeEvent(),
    );
    const body = conversionCalls[0].body as { conversions: Array<Record<string, unknown>> };
    expect(body.conversions[0].conversionAction).toBe(customAction);
  });

  // Bonus: sends developer-token header
  it('includes developer-token in request headers', async () => {
    const { conversionCalls } = setupFetchMock();
    await sendGoogleAdsConversion(STORE, makeEvent());
    const headers = conversionCalls[0].headers as Record<string, string>;
    expect(headers['developer-token']).toBe('dev-token-xyz');
  });

  // Bonus: omits hashedPhoneNumber when phone absent
  it('omits hashedPhoneNumber when phone is not provided', async () => {
    const { conversionCalls } = setupFetchMock();
    await sendGoogleAdsConversion(STORE, makeEvent({ phone: undefined }));
    const body = conversionCalls[0].body as { conversions: Array<Record<string, unknown>> };
    expect(body.conversions[0].hashedPhoneNumber).toBeUndefined();
  });

  // Bonus: proceeds with just email (no gclid)
  it('proceeds when email is present but gclid is absent', async () => {
    const { conversionCalls } = setupFetchMock();
    await sendGoogleAdsConversion(
      STORE,
      makeEvent({ gclid: undefined, phone: undefined }),
    );
    expect(conversionCalls).toHaveLength(1);
    const body = conversionCalls[0].body as { conversions: Array<Record<string, unknown>> };
    expect(body.conversions[0].gclid).toBeUndefined();
    expect(body.conversions[0].hashedEmail).toBeTruthy();
  });
});
