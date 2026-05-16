import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';

const mocks = vi.hoisted(() => ({
  getCartId: vi.fn(),
  clearCartId: vi.fn(),
  getLastStoreSlug: vi.fn(),
  completeCart: vi.fn(),
  initPaymentSession: vi.fn(),
  capturePayments: vi.fn(),
  getOrder: vi.fn(),
  stripeEnabled: vi.fn(() => true),
  STRIPE_PROVIDER_ID: 'pp_stripe_stripe',
  enforceRateLimit: vi.fn<() => Promise<Response | null>>(() => Promise.resolve(null)),
  checkRateLimit: vi.fn(() => Promise.resolve({ ok: true })),
  getStoreBySlug: vi.fn(),
  trackEvent: vi.fn(() => Promise.resolve({ eventId: 'evt_123' })),
}));

vi.mock('@/lib/cart-cookie', () => ({
  getCartId: mocks.getCartId,
  clearCartId: mocks.clearCartId,
  getLastStoreSlug: mocks.getLastStoreSlug,
}));

vi.mock('@/lib/medusa-store', () => ({
  completeCart: mocks.completeCart,
  initPaymentSession: mocks.initPaymentSession,
}));

vi.mock('@/lib/medusa', () => ({
  medusa: {
    capturePayments: mocks.capturePayments,
    getOrder: mocks.getOrder,
  },
}));

vi.mock('@/lib/stripe-env', () => ({
  stripeEnabled: mocks.stripeEnabled,
  STRIPE_PROVIDER_ID: mocks.STRIPE_PROVIDER_ID,
}));

vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: mocks.enforceRateLimit,
  checkRateLimit: mocks.checkRateLimit,
  clientIp: () => '127.0.0.1',
}));

vi.mock('@/lib/store-config', () => ({
  getStoreBySlug: mocks.getStoreBySlug,
}));

vi.mock('@/lib/analytics/track', () => ({
  trackEvent: mocks.trackEvent,
}));

function makeReq(body?: unknown) {
  return new Request('http://localhost/api/checkout/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  }) as unknown as import('next/server').NextRequest;
}

describe('POST /api/checkout/complete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enforceRateLimit.mockResolvedValue(null);
    mocks.checkRateLimit.mockResolvedValue({ ok: true });
    mocks.getCartId.mockResolvedValue('cart_123');
    mocks.completeCart.mockResolvedValue({ type: 'order', order: { id: 'ord_123', display_id: 42 } });
    mocks.getOrder.mockResolvedValue({
      total: 99.9,
      currency_code: 'eur',
      email: 'test@example.com',
      shipping_address: { phone: '+33600000000' },
    });
    mocks.getStoreBySlug.mockResolvedValue({ id: 'store_1', slug: 'test-store' });
    mocks.getLastStoreSlug.mockResolvedValue('test-store');
  });

  it('returns 400 when no cart id', async () => {
    mocks.getCartId.mockResolvedValue(null);
    const res = await POST(makeReq());
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
  });

  it('completes checkout, captures payment and tracks purchase', async () => {
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.orderId).toBe('ord_123');
    expect(mocks.initPaymentSession).toHaveBeenCalledWith('cart_123', 'pp_stripe_stripe');
    expect(mocks.completeCart).toHaveBeenCalledWith('cart_123');
    expect(mocks.capturePayments).toHaveBeenCalledWith('ord_123');
    expect(mocks.clearCartId).toHaveBeenCalled();
    expect(mocks.trackEvent).toHaveBeenCalled();
  });

  it('returns 429 when rate limited', async () => {
    mocks.enforceRateLimit.mockResolvedValue(
      new Response(JSON.stringify({ error: 'too many' }), { status: 429 }),
    );
    const res = await POST(makeReq());
    expect(res.status).toBe(429);
  });

  it('returns 503 when payment session init fails', async () => {
    mocks.initPaymentSession.mockRejectedValue(new Error('Stripe down'));
    const res = await POST(makeReq());
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.success).toBe(false);
  });
});
