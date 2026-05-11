import { describe, expect, it, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/setup-msw';
import { sendGa4Conversion } from './ga4-mp';
import type { FunnelEvent } from './funnel';
import type { StoreConfig } from '@/lib/store-config';

const GA4_URL = 'https://www.google-analytics.com/mp/collect';

type StoreSlice = Pick<StoreConfig, 'ga4MeasurementId' | 'ga4ApiSecret'>;

const STORE: StoreSlice = {
  ga4MeasurementId: 'G-TESTXYZ123',
  ga4ApiSecret: 'mp_api_secret_xyz',
};

function makeEvent(overrides: Partial<FunnelEvent> = {}): FunnelEvent {
  return {
    storeSlug: 'yoga-store',
    sessionId: 'sess-abc-123',
    eventName: 'purchase',
    eventId: 'evt-uuid-1',
    productId: 'prod_1',
    valueMinor: 1999,
    currencyCode: 'eur',
    email: 'buyer@example.com',
    medusaOrderId: 'order_42',
    referrer: 'https://google.com/',
    ...overrides,
  };
}

interface CapturedRequest {
  url: string;
  payload: {
    client_id?: string;
    user_id?: string;
    events?: Array<{ name?: string; params?: Record<string, unknown> }>;
  };
}

function captureGa4(status = 204): { calls: CapturedRequest[] } {
  const calls: CapturedRequest[] = [];
  server.use(
    http.post(GA4_URL, async ({ request }) => {
      calls.push({
        url: request.url,
        payload: (await request.json()) as CapturedRequest['payload'],
      });
      return new HttpResponse(null, { status });
    }),
  );
  return { calls };
}

describe('sendGa4Conversion', () => {
  beforeEach(() => {
    // each test installs its own handler via captureGa4
  });

  it('no-ops when measurement_id is missing', async () => {
    const calls: CapturedRequest[] = [];
    server.use(
      http.post(GA4_URL, async ({ request }) => {
        calls.push({
          url: request.url,
          payload: (await request.json()) as CapturedRequest['payload'],
        });
        return new HttpResponse(null, { status: 204 });
      }),
    );
    await sendGa4Conversion(
      { ga4MeasurementId: null, ga4ApiSecret: 'x' },
      makeEvent(),
    );
    expect(calls).toHaveLength(0);
  });

  it('no-ops when api_secret is missing', async () => {
    const calls: CapturedRequest[] = [];
    server.use(
      http.post(GA4_URL, async ({ request }) => {
        calls.push({
          url: request.url,
          payload: (await request.json()) as CapturedRequest['payload'],
        });
        return new HttpResponse(null, { status: 204 });
      }),
    );
    await sendGa4Conversion(
      { ga4MeasurementId: 'G-AAA', ga4ApiSecret: null },
      makeEvent(),
    );
    expect(calls).toHaveLength(0);
  });

  it('POSTs to the MP endpoint with measurement_id + api_secret in query', async () => {
    const { calls } = captureGa4();
    await sendGa4Conversion(STORE, makeEvent());
    expect(calls).toHaveLength(1);
    const u = new URL(calls[0].url);
    expect(u.origin + u.pathname).toBe(GA4_URL);
    expect(u.searchParams.get('measurement_id')).toBe('G-TESTXYZ123');
    expect(u.searchParams.get('api_secret')).toBe('mp_api_secret_xyz');
  });

  it('maps funnel event names to GA4 standard names', async () => {
    const cases: Array<[FunnelEvent['eventName'], string]> = [
      ['page_view', 'page_view'],
      ['view_content', 'view_item'],
      ['add_to_cart', 'add_to_cart'],
      ['initiate_checkout', 'begin_checkout'],
      ['purchase', 'purchase'],
    ];
    for (const [funnelName, ga4Name] of cases) {
      const { calls } = captureGa4();
      await sendGa4Conversion(STORE, makeEvent({ eventName: funnelName }));
      expect(calls[0].payload.events?.[0]?.name).toBe(ga4Name);
    }
  });

  it('includes event_id in params for client/server dedup', async () => {
    const { calls } = captureGa4();
    await sendGa4Conversion(STORE, makeEvent({ eventId: 'dedup-uuid-7' }));
    expect(calls[0].payload.events?.[0]?.params?.event_id).toBe('dedup-uuid-7');
  });

  it('sets client_id to the session id', async () => {
    const { calls } = captureGa4();
    await sendGa4Conversion(STORE, makeEvent({ sessionId: 'sid-xyz' }));
    expect(calls[0].payload.client_id).toBe('sid-xyz');
  });

  it('hashes email to user_id (SHA-256, lowercase trimmed)', async () => {
    const { calls } = captureGa4();
    // SHA-256 of 'buyer@example.com'
    const expected =
      '6a6c26195c3682faa816966af789717c3bfa834eee6c599d667d2b3429c27cfd';
    await sendGa4Conversion(STORE, makeEvent({ email: '  BUYER@example.com  ' }));
    expect(calls[0].payload.user_id).toBe(expected);
  });

  it('converts value from minor to major units', async () => {
    const { calls } = captureGa4();
    await sendGa4Conversion(
      STORE,
      makeEvent({ valueMinor: 1999, currencyCode: 'eur' }),
    );
    expect(calls[0].payload.events?.[0]?.params?.value).toBe(19.99);
    expect(calls[0].payload.events?.[0]?.params?.currency).toBe('EUR');
  });

  it('emits items array for view_content / add_to_cart / purchase', async () => {
    for (const eventName of [
      'view_content',
      'add_to_cart',
      'initiate_checkout',
      'purchase',
    ] as const) {
      const { calls } = captureGa4();
      await sendGa4Conversion(
        STORE,
        makeEvent({ eventName, productId: 'prod_xyz' }),
      );
      const params = calls[0].payload.events?.[0]?.params as { items?: unknown[] };
      expect(params.items).toEqual([{ item_id: 'prod_xyz' }]);
    }
  });

  it('omits items array for page_view', async () => {
    const { calls } = captureGa4();
    await sendGa4Conversion(STORE, makeEvent({ eventName: 'page_view' }));
    const params = calls[0].payload.events?.[0]?.params as { items?: unknown[] };
    expect(params.items).toBeUndefined();
  });

  it('sets transaction_id on purchase from medusaOrderId', async () => {
    const { calls } = captureGa4();
    await sendGa4Conversion(
      STORE,
      makeEvent({ eventName: 'purchase', medusaOrderId: 'order_99' }),
    );
    expect(calls[0].payload.events?.[0]?.params?.transaction_id).toBe('order_99');
  });

  it('does not throw when GA4 returns a 4xx', async () => {
    captureGa4(400);
    await expect(sendGa4Conversion(STORE, makeEvent())).resolves.toBeUndefined();
  });

  it('does not throw on network error', async () => {
    server.use(
      http.post(GA4_URL, () => {
        return HttpResponse.error();
      }),
    );
    await expect(sendGa4Conversion(STORE, makeEvent())).resolves.toBeUndefined();
  });
});
