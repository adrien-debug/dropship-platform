import { http, HttpResponse } from 'msw';

/**
 * Medusa Admin API mock.
 *
 * Covers exactly the endpoints `lib/medusa.ts` touches during store creation:
 *   - POST /admin/sales-channels       → createSalesChannel
 *   - POST /admin/api-keys             → createPublishableApiKey
 *   - POST /admin/api-keys/:id/sales-channels       → addSalesChannelsToPublishableKey
 *   - GET  /admin/stock-locations      → listStockLocations
 *   - POST /admin/stock-locations/:id/sales-channels → linkSalesChannelsToStockLocation
 *   - POST /admin/products             → createProduct
 *   - POST /admin/sales-channels/:id/products       → addProductsToSalesChannel
 *
 * IDs are deterministic (sc_test, pak_test, prod_test_{n}) so tests can
 * assert against exact values when they need to.
 */

const MEDUSA_BASE = 'http://medusa-mock.local';

let productCounter = 0;

export const medusaHandlers = [
  http.post(`${MEDUSA_BASE}/admin/sales-channels`, () => {
    return HttpResponse.json({
      sales_channel: {
        id: 'sc_test_001',
        name: 'Test Channel',
        description: 'Test',
      },
    });
  }),

  http.delete(`${MEDUSA_BASE}/admin/sales-channels/:id`, () => {
    return new HttpResponse(null, { status: 200 });
  }),

  http.post(`${MEDUSA_BASE}/admin/api-keys`, () => {
    return HttpResponse.json({
      api_key: {
        id: 'pak_test_001',
        token: 'pk_test_publishable_token_abcdef123456',
        title: 'Test Store Key',
      },
    });
  }),

  http.post(`${MEDUSA_BASE}/admin/api-keys/:id/sales-channels`, () => {
    return HttpResponse.json({ api_key: { id: 'pak_test_001' } });
  }),

  http.get(`${MEDUSA_BASE}/admin/stock-locations`, () => {
    return HttpResponse.json({
      stock_locations: [{ id: 'sloc_test_001', name: 'Main Warehouse' }],
    });
  }),

  http.post(
    `${MEDUSA_BASE}/admin/stock-locations/:id/sales-channels`,
    () => {
      return HttpResponse.json({});
    },
  ),

  http.post(`${MEDUSA_BASE}/admin/products`, async ({ request }) => {
    productCounter += 1;
    const body = (await request.json()) as {
      title?: string;
      handle?: string;
      thumbnail?: string;
    };
    return HttpResponse.json({
      product: {
        id: `prod_test_${String(productCounter).padStart(3, '0')}`,
        title: body.title || 'Untitled',
        handle: body.handle || `prod-${productCounter}`,
        thumbnail: body.thumbnail,
        status: 'published',
        is_giftcard: false,
        images: [],
        variants: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    });
  }),

  http.post(`${MEDUSA_BASE}/admin/sales-channels/:id/products`, () => {
    return HttpResponse.json({ sales_channel: { id: 'sc_test_001' } });
  }),
];

/** Reset product id counter between tests for deterministic assertions. */
export function resetMedusaCounter() {
  productCounter = 0;
}
