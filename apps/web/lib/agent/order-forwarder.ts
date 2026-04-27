/**
 * Forward a paid Medusa order to AliExpress for fulfillment.
 *
 * Default behaviour is dry-run: we build the payload and persist it in
 * `dropship_order_forwards` but never call AliExpress. Set `dryRun: false`
 * (and pass an explicit `confirm: true`) to actually place the order.
 */

import { medusa, type MedusaOrder } from '@/lib/medusa';
import { placeOrder, type AliExpressPlaceOrderInput, type AliExpressLogisticsAddress } from '@/lib/suppliers/aliexpress';
import { getDb } from '@/lib/db';

export interface ForwardOptions {
  dryRun: boolean;
  /** Override the province if the Medusa shipping address has none. AE requires it. */
  provinceOverride?: string;
}

export interface ForwardResult {
  ok: boolean;
  status: 'dry_run' | 'sent' | 'error';
  forwardId: string;            // dropship_order_forwards.id
  aeOrderId?: string;
  payload: AliExpressPlaceOrderInput;
  error?: string;
  /** Items the agent could not map to an AliExpress product_id — always to be reviewed. */
  unmappedItems: { itemId: string; title: string; reason: string }[];
}

function digitsOnly(s: string | undefined | null): string {
  return (s || '').replace(/\D+/g, '');
}

function splitPhone(raw: string | undefined | null, defaultDial = '33'): { dial: string; number: string } {
  const cleaned = (raw || '').trim();
  if (!cleaned) return { dial: defaultDial, number: '' };
  if (cleaned.startsWith('+')) {
    const digits = cleaned.slice(1).replace(/\s+/g, '');
    // dial code = 1-3 digits at the start; treat the rest as the number.
    const m = digits.match(/^(\d{1,3})(\d+)$/);
    if (m) return { dial: m[1], number: m[2] };
  }
  return { dial: defaultDial, number: digitsOnly(cleaned) };
}

function buildLogisticsAddress(order: MedusaOrder, provinceOverride?: string): { address: AliExpressLogisticsAddress; missing: string[] } {
  const a = order.shipping_address ?? {};
  const fullName = [a.first_name, a.last_name].filter(Boolean).join(' ').trim();
  const province = (a.province || provinceOverride || '').trim();
  const phone = splitPhone(a.phone);

  const missing: string[] = [];
  if (!fullName) missing.push('full_name');
  if (!a.address_1) missing.push('address');
  if (!a.city) missing.push('city');
  if (!a.country_code) missing.push('country');
  if (!a.postal_code) missing.push('zip');
  if (!province) missing.push('province');
  if (!phone.number) missing.push('mobile_no');

  const address: AliExpressLogisticsAddress = {
    address: a.address_1 || '',
    address2: a.address_2 || undefined,
    city: a.city || '',
    contact_person: fullName || order.email || '',
    country: (a.country_code || '').toUpperCase(),
    full_name: fullName || order.email || '',
    mobile_no: phone.number,
    phone_country: phone.dial,
    province,
    zip: a.postal_code || '',
  };

  return { address, missing };
}

interface ProductMapping {
  medusa_product_id: string;
  external_id: string;
  store_id: string;
  supplier: string;
}

async function mapItemsToAliExpress(order: MedusaOrder): Promise<{
  product_items: { product_count: number; product_id: string; sku_attr?: string }[];
  unmapped: { itemId: string; title: string; reason: string }[];
  storeId?: string;
}> {
  const items = order.items ?? [];
  if (items.length === 0) return { product_items: [], unmapped: [], storeId: undefined };

  const productIds = Array.from(new Set(items.map((i) => i.product_id).filter(Boolean)));
  if (productIds.length === 0) {
    return {
      product_items: [],
      unmapped: items.map((i) => ({ itemId: i.id, title: i.title, reason: 'Medusa item has no product_id' })),
    };
  }

  const placeholders = productIds.map((_, i) => `$${i + 1}`).join(', ');
  const { rows } = await getDb().query<ProductMapping>(
    `SELECT medusa_product_id, external_id, store_id, supplier
       FROM dropship_store_products
      WHERE medusa_product_id IN (${placeholders})`,
    productIds,
  );

  const byMedusaId = new Map(rows.map((r) => [r.medusa_product_id, r]));

  const product_items: { product_count: number; product_id: string; sku_attr?: string }[] = [];
  const unmapped: { itemId: string; title: string; reason: string }[] = [];
  let storeId: string | undefined;

  for (const item of items) {
    const mapping = byMedusaId.get(item.product_id);
    if (!mapping) {
      unmapped.push({ itemId: item.id, title: item.title, reason: 'No row in dropship_store_products' });
      continue;
    }
    if (mapping.supplier !== 'aliexpress') {
      unmapped.push({ itemId: item.id, title: item.title, reason: `supplier=${mapping.supplier}, only aliexpress is forwardable` });
      continue;
    }
    storeId = mapping.store_id;
    const sku = item.variant?.sku || undefined;
    product_items.push({
      product_count: item.quantity,
      product_id: mapping.external_id,
      ...(sku ? { sku_attr: sku } : {}),
    });
  }

  return { product_items, unmapped, storeId };
}

/**
 * Forward a single Medusa order. Persists the attempt — dry-run or live —
 * to `dropship_order_forwards`.
 */
export async function forwardOrder(medusaOrderId: string, opts: ForwardOptions): Promise<ForwardResult> {
  const order = await medusa.getOrder(medusaOrderId);
  const { product_items, unmapped, storeId } = await mapItemsToAliExpress(order);
  const { address, missing } = buildLogisticsAddress(order, opts.provinceOverride);

  const payload: AliExpressPlaceOrderInput = {
    logistics_address: address,
    product_items,
    out_order_id: medusaOrderId,
  };

  const db = getDb();

  // Hard gates: nothing to ship, missing address, or all items unmapped.
  const hardError =
    product_items.length === 0
      ? `No mappable items (unmapped: ${unmapped.length})`
      : missing.length > 0
        ? `Missing required address fields: ${missing.join(', ')}`
        : null;

  if (hardError) {
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO dropship_order_forwards
         (medusa_order_id, store_id, payload, status, error_message, dry_run)
       VALUES ($1, $2, $3, 'error', $4, $5)
       RETURNING id`,
      [medusaOrderId, storeId ?? null, JSON.stringify(payload), hardError, opts.dryRun],
    );
    return {
      ok: false,
      status: 'error',
      forwardId: rows[0]!.id,
      payload,
      unmappedItems: unmapped,
      error: hardError,
    };
  }

  if (opts.dryRun) {
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO dropship_order_forwards
         (medusa_order_id, store_id, payload, status, dry_run)
       VALUES ($1, $2, $3, 'dry_run', true)
       RETURNING id`,
      [medusaOrderId, storeId ?? null, JSON.stringify(payload)],
    );
    return {
      ok: true,
      status: 'dry_run',
      forwardId: rows[0]!.id,
      payload,
      unmappedItems: unmapped,
    };
  }

  // Live: actually call AliExpress. The unique partial index on
  // (medusa_order_id) WHERE dry_run=false AND status='sent' guards against
  // a double-send racing with itself.
  const aeRes = await placeOrder(payload);
  if (aeRes.success) {
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO dropship_order_forwards
         (medusa_order_id, store_id, ae_order_id, payload, response, status, dry_run)
       VALUES ($1, $2, $3, $4, $5, 'sent', false)
       RETURNING id`,
      [medusaOrderId, storeId ?? null, aeRes.ae_order_id ?? null, JSON.stringify(payload), JSON.stringify(aeRes.raw)],
    );
    return {
      ok: true,
      status: 'sent',
      forwardId: rows[0]!.id,
      aeOrderId: aeRes.ae_order_id,
      payload,
      unmappedItems: unmapped,
    };
  }

  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO dropship_order_forwards
       (medusa_order_id, store_id, payload, response, status, error_message, dry_run)
     VALUES ($1, $2, $3, $4, 'error', $5, false)
     RETURNING id`,
    [medusaOrderId, storeId ?? null, JSON.stringify(payload), JSON.stringify(aeRes.raw), aeRes.error ?? 'unknown error'],
  );
  return {
    ok: false,
    status: 'error',
    forwardId: rows[0]!.id,
    payload,
    unmappedItems: unmapped,
    error: aeRes.error,
  };
}
