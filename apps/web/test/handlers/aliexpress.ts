import { http, HttpResponse } from 'msw';

/**
 * AliExpress mock handler.
 *
 * The real client (`apps/web/lib/suppliers/aliexpress.ts`) hits two endpoints:
 *   1. `api-sg.aliexpress.com/sync?method=aliexpress.ds.text.search&...`
 *   2. `api-sg.aliexpress.com/rest/auth/token/refresh`
 *
 * The signature & timestamps are computed client-side, so we only need to
 * respond to the URL. The signature parameter is the last to be appended and
 * we don't validate it — MSW matches by path only.
 *
 * Default behaviour: return 4 plausible yoga-equipment products in the AE
 * `selection_search_product` shape, with EUR pricing and HTTPS image URLs.
 * Tests override via `server.use(emptyAliexpress())` etc.
 */

const DEFAULT_PRODUCTS = [
  {
    itemId: '1005006701234',
    title: 'Premium Eco-Friendly Yoga Mat 6mm Anti-Slip',
    itemMainPic: 'https://ae01.alicdn.com/kf/yoga-mat-premium.jpg',
    itemUrl: 'https://www.aliexpress.com/item/1005006701234.html',
    salePrice: '19.99',
    targetSalePrice: '19.99',
    originalPrice: '29.99',
    targetOriginalPrice: '29.99',
    targetOriginalPriceCurrency: 'EUR',
    salePriceCurrency: 'EUR',
    discount: '33%',
    evaluateRate: '4.8',
    orders: '1240',
    cateId: '200002543',
  },
  {
    itemId: '1005006702345',
    title: 'Yoga Block Set High Density Cork',
    itemMainPic: 'https://ae01.alicdn.com/kf/yoga-block.jpg',
    itemUrl: 'https://www.aliexpress.com/item/1005006702345.html',
    salePrice: '14.50',
    targetSalePrice: '14.50',
    originalPrice: '22.00',
    targetOriginalPrice: '22.00',
    targetOriginalPriceCurrency: 'EUR',
    salePriceCurrency: 'EUR',
    discount: '34%',
    evaluateRate: '4.7',
    orders: '870',
    cateId: '200002543',
  },
  {
    itemId: '1005006703456',
    title: 'Resistance Bands Set 5 Levels',
    itemMainPic: 'https://ae01.alicdn.com/kf/resistance-bands.jpg',
    itemUrl: 'https://www.aliexpress.com/item/1005006703456.html',
    salePrice: '9.20',
    targetSalePrice: '9.20',
    originalPrice: '15.00',
    targetOriginalPrice: '15.00',
    targetOriginalPriceCurrency: 'EUR',
    salePriceCurrency: 'EUR',
    discount: '39%',
    evaluateRate: '4.6',
    orders: '2030',
    cateId: '200002543',
  },
  {
    itemId: '1005006704567',
    title: 'Yoga Strap Cotton Adjustable 8ft',
    itemMainPic: 'https://ae01.alicdn.com/kf/yoga-strap.jpg',
    itemUrl: 'https://www.aliexpress.com/item/1005006704567.html',
    salePrice: '6.80',
    targetSalePrice: '6.80',
    originalPrice: '11.00',
    targetOriginalPrice: '11.00',
    targetOriginalPriceCurrency: 'EUR',
    salePriceCurrency: 'EUR',
    discount: '38%',
    evaluateRate: '4.9',
    orders: '560',
    cateId: '200002543',
  },
];

export const aliexpressHandlers = [
  // ds.text.search is on /sync. We respond regardless of method (?method=...)
  // because the AE TOP gateway routes everything through one URL.
  http.get('https://api-sg.aliexpress.com/sync', () => {
    return HttpResponse.json({
      aliexpress_ds_text_search_response: {
        code: '0',
        data: {
          pageIndex: 1,
          pageSize: DEFAULT_PRODUCTS.length,
          totalCount: DEFAULT_PRODUCTS.length,
          products: { selection_search_product: DEFAULT_PRODUCTS },
        },
      },
    });
  }),
  // POST goes to the same /sync URL for some calls (place order). Default
  // empty body — tests overriding will add a specific handler.
  http.post('https://api-sg.aliexpress.com/sync', () => {
    return HttpResponse.json({});
  }),
];

/**
 * Override helper: makes AE search return zero results, mimicking the case
 * where the niche has no matching products on AliExpress.
 */
export function emptyAliexpress() {
  return http.get('https://api-sg.aliexpress.com/sync', () => {
    return HttpResponse.json({
      aliexpress_ds_text_search_response: {
        code: '0',
        data: {
          pageIndex: 1,
          pageSize: 0,
          totalCount: 0,
          products: { selection_search_product: [] },
        },
      },
    });
  });
}
