import { NextResponse } from 'next/server';
import { medusa, getMedusaBaseUrl, getMedusaAuthMode } from '@/lib/medusa';

interface MedusaRegion {
  id: string;
  name: string;
  currency_code: string;
  countries?: { iso_2: string }[];
  payment_providers?: { id: string }[];
}
interface MedusaSalesChannel { id: string; name: string; is_disabled: boolean }
interface MedusaApiKey { id: string; title: string; token: string; type: string; revoked_at: string | null }
interface MedusaPaymentProvider { id: string; is_enabled?: boolean }
interface MedusaShippingOption { id: string; name: string }
interface MedusaStore { id: string; name: string; default_sales_channel_id?: string; supported_currencies?: { currency_code: string }[] }

async function getAdminAuthHeader(): Promise<Record<string, string>> {
  const token = (process.env.MEDUSA_ADMIN_API_TOKEN || '').trim();
  if (token) return { 'x-medusa-access-token': token };
  if (getMedusaAuthMode() === 'jwt') {
    const jwt = await medusa.authenticateJwt();
    return { Authorization: `Bearer ${jwt}` };
  }
  throw new Error('Medusa admin auth missing');
}

async function admin<T>(path: string, headers: Record<string, string>): Promise<{ ok: boolean; status: number; data?: T; error?: string }> {
  const res = await fetch(`${getMedusaBaseUrl()}${path}`, { headers, cache: 'no-store' });
  const text = await res.text();
  if (!res.ok) return { ok: false, status: res.status, error: text.slice(0, 200) };
  try { return { ok: true, status: res.status, data: JSON.parse(text) as T }; } catch { return { ok: false, status: res.status, error: 'invalid json' }; }
}

export async function GET() {
  const cfg = medusa.checkConfig();
  if (!cfg.ok) return NextResponse.json({ success: false, error: cfg.message }, { status: 503 });

  let auth: Record<string, string>;
  try {
    auth = await getAdminAuthHeader();
  } catch (e) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : 'auth failed' }, { status: 503 });
  }

  const [stores, regions, channels, pubKeys, providers, shippingOptions, products] = await Promise.all([
    admin<{ stores: MedusaStore[] }>('/admin/stores', auth),
    admin<{ regions: MedusaRegion[] }>('/admin/regions', auth),
    admin<{ sales_channels: MedusaSalesChannel[] }>('/admin/sales-channels', auth),
    admin<{ api_keys: MedusaApiKey[] }>('/admin/api-keys?type=publishable', auth),
    admin<{ payment_providers: MedusaPaymentProvider[] }>('/admin/payments/payment-providers', auth),
    admin<{ shipping_options: MedusaShippingOption[] }>('/admin/shipping-options', auth),
    admin<{ products: { id: string; title: string; status: string }[]; count: number }>('/admin/products?limit=5&fields=id,title,status', auth),
  ]);

  const stripeProvider = providers.data?.payment_providers?.find((p) => p.id?.includes('stripe'));

  return NextResponse.json({
    success: true,
    medusaUrl: getMedusaBaseUrl(),
    stores: stores.data?.stores?.map((s) => ({
      name: s.name,
      defaultSalesChannelId: s.default_sales_channel_id,
      currencies: s.supported_currencies?.map((c) => c.currency_code),
    })) ?? { error: stores.error, status: stores.status },
    regions: regions.data?.regions?.map((r) => ({
      id: r.id,
      name: r.name,
      currency: r.currency_code,
      countries: r.countries?.map((c) => c.iso_2),
      paymentProviders: r.payment_providers?.map((p) => p.id),
    })) ?? { error: regions.error, status: regions.status },
    salesChannels: channels.data?.sales_channels?.map((s) => ({ id: s.id, name: s.name, disabled: s.is_disabled })) ?? { error: channels.error, status: channels.status },
    publishableKeys: pubKeys.data?.api_keys?.map((k) => ({
      title: k.title,
      tokenPrefix: k.token?.slice(0, 12) + '…',
      revoked: !!k.revoked_at,
    })) ?? { error: pubKeys.error, status: pubKeys.status },
    paymentProviders: providers.data?.payment_providers?.map((p) => p.id) ?? { error: providers.error, status: providers.status },
    stripeEnabled: !!stripeProvider,
    shippingOptionsCount: shippingOptions.data?.shipping_options?.length ?? null,
    products: {
      count: products.data?.count ?? null,
      sample: products.data?.products?.map((p) => ({ title: p.title, status: p.status })),
    },
  });
}
