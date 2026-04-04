import type { SupplierProduct } from './interface';

interface ShopifyConfig {
  storeDomain: string;
  adminToken: string;
}

interface ShopifyProduct {
  id: number;
  title: string;
  body_html: string;
  product_type: string;
  status: string;
  images: { src: string }[];
  variants: {
    id: number;
    sku: string;
    title: string;
    price: string;
    inventory_quantity: number;
  }[];
}

export async function getShopifyProducts(
  config: ShopifyConfig,
  options?: { limit?: number }
): Promise<SupplierProduct[]> {
  const limit = options?.limit ?? 50;
  const url = `https://${config.storeDomain}/admin/api/2024-10/products.json?limit=${limit}&status=active`;
  const res = await fetch(url, {
    headers: { 'X-Shopify-Access-Token': config.adminToken },
  });
  if (!res.ok) throw new Error(`Shopify API error: ${res.status}`);
  const json = (await res.json()) as { products: ShopifyProduct[] };
  return json.products.map(p => ({
    externalId: String(p.id),
    name: p.title,
    description: p.body_html ?? '',
    costCents: Math.round(parseFloat(p.variants[0]?.price || '0') * 100),
    category: p.product_type || 'Uncategorized',
    imageUrls: p.images.map(i => i.src),
    variants: p.variants.map(v => ({
      sku: v.sku || '',
      name: v.title,
      costCents: Math.round(parseFloat(v.price) * 100),
      stock: v.inventory_quantity ?? 999,
      attributes: {},
    })),
    shippingDays: { min: 3, max: 7 },
  }));
}
