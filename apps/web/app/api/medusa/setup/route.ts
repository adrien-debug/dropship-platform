import { NextRequest, NextResponse } from 'next/server';
import { medusa, getMedusaBaseUrl, getMedusaAuthMode } from '@/lib/medusa';

interface AdminResult<T> { ok: boolean; status: number; data?: T; error?: string }

async function getAdminAuthHeader(): Promise<Record<string, string>> {
  const token = (process.env.MEDUSA_ADMIN_API_TOKEN || '').trim();
  if (token) return { 'x-medusa-access-token': token, 'Content-Type': 'application/json' };
  if (getMedusaAuthMode() === 'jwt') {
    const jwt = await medusa.authenticateJwt();
    return { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' };
  }
  throw new Error('Medusa admin auth missing');
}

async function admin<T>(path: string, headers: Record<string, string>, init?: { method?: string; body?: unknown }): Promise<AdminResult<T>> {
  const res = await fetch(`${getMedusaBaseUrl()}${path}`, {
    method: init?.method ?? 'GET',
    headers,
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
  });
  const text = await res.text();
  if (!res.ok) return { ok: false, status: res.status, error: text.slice(0, 400) };
  try { return { ok: true, status: res.status, data: JSON.parse(text) as T }; } catch { return { ok: false, status: res.status, error: 'invalid json: ' + text.slice(0, 200) }; }
}

interface PublishableKey { id: string; title: string; token: string; revoked_at: string | null }
interface SalesChannel { id: string; name: string }
interface Region { id: string; name: string; currency_code: string }
interface FulfillmentProvider { id: string; is_enabled?: boolean }
interface StockLocation { id: string; name: string }
interface FulfillmentSet { id: string; name: string; type: string; service_zones?: ServiceZone[] }
interface ServiceZone { id: string; name: string }
interface ShippingProfile { id: string; name: string; type: string }
interface ShippingOption { id: string; name: string }

/**
 * GET /api/medusa/setup
 * Returns full snapshot to drive next setup decisions.
 */
export async function GET() {
  const auth = await getAdminAuthHeader();

  const [pubKeys, channels, regions, fulfillmentProviders, stockLocations, shippingProfiles, shippingOptions] = await Promise.all([
    admin<{ api_keys: PublishableKey[] }>('/admin/api-keys?type=publishable', auth),
    admin<{ sales_channels: SalesChannel[] }>('/admin/sales-channels', auth),
    admin<{ regions: Region[] }>('/admin/regions?fields=*payment_providers', auth),
    admin<{ fulfillment_providers: FulfillmentProvider[] }>('/admin/fulfillment-providers', auth),
    admin<{ stock_locations: (StockLocation & { fulfillment_sets?: (FulfillmentSet & { service_zones?: ServiceZone[] })[] })[] }>('/admin/stock-locations?fields=id,name,fulfillment_sets.id,fulfillment_sets.name,fulfillment_sets.service_zones.id,fulfillment_sets.service_zones.name', auth),
    admin<{ shipping_profiles: ShippingProfile[] }>('/admin/shipping-profiles', auth),
    admin<{ shipping_options: ShippingOption[] }>('/admin/shipping-options', auth),
  ]);

  return NextResponse.json({
    success: true,
    publishableKeys: pubKeys.data?.api_keys?.map((k) => ({ title: k.title, token: k.token, revoked: !!k.revoked_at })) ?? { error: pubKeys.error, status: pubKeys.status },
    salesChannels: channels.data?.sales_channels ?? { error: channels.error, status: channels.status },
    regions: regions.data?.regions ?? { error: regions.error, status: regions.status },
    fulfillmentProviders: fulfillmentProviders.data ?? { error: fulfillmentProviders.error, status: fulfillmentProviders.status },
    stockLocations: stockLocations.data ?? { error: stockLocations.error, status: stockLocations.status },
    shippingProfiles: shippingProfiles.data ?? { error: shippingProfiles.error, status: shippingProfiles.status },
    shippingOptions: shippingOptions.data ?? { error: shippingOptions.error, status: shippingOptions.status },
  });
}

/**
 * POST /api/medusa/setup
 * Idempotent setup: ensures a stock location, fulfillment set, service zone (Europe),
 * default shipping profile, and one Standard shipping option exist on the default region.
 */
export async function POST(request: NextRequest) {
  const auth = await getAdminAuthHeader();
  const body = await request.json().catch(() => ({}));
  const dryRun: boolean = body?.dryRun === true;
  const log: string[] = [];

  async function step<T>(label: string, fn: () => Promise<T>): Promise<T> {
    log.push(`▶ ${label}`);
    const out = await fn();
    log.push(`✓ ${label}`);
    return out;
  }

  type StockLocationDeep = StockLocation & {
    fulfillment_sets?: (FulfillmentSet & { service_zones?: ServiceZone[] })[];
    sales_channels?: { id: string }[];
  };

  async function getStockLocations(): Promise<StockLocationDeep[]> {
    const r = await admin<{ stock_locations: StockLocationDeep[] }>(
      '/admin/stock-locations?fields=id,name,fulfillment_sets.id,fulfillment_sets.name,fulfillment_sets.service_zones.id,fulfillment_sets.service_zones.name,sales_channels.id',
      auth,
    );
    if (!r.ok) throw new Error(`list stock_locations: ${r.error}`);
    return r.data?.stock_locations ?? [];
  }

  try {
    const regionsRes = await admin<{ regions: Region[] }>('/admin/regions', auth);
    if (!regionsRes.ok || !regionsRes.data?.regions?.length) {
      return NextResponse.json({ success: false, error: 'No regions in Medusa', log }, { status: 400 });
    }
    const region = regionsRes.data.regions[0];
    log.push(`region=${region.name} (${region.id})`);

    const channelsRes = await admin<{ sales_channels: SalesChannel[] }>('/admin/sales-channels', auth);
    const salesChannel = channelsRes.data?.sales_channels?.[0];
    if (!salesChannel) throw new Error('no sales channel');
    log.push(`salesChannel=${salesChannel.id}`);

    let stockLocations = await getStockLocations();
    let stockLocation = stockLocations[0];
    if (!stockLocation) {
      if (dryRun) { log.push('would create stock_location'); }
      else {
        const created = await step('create stock_location', () => admin<{ stock_location: StockLocation }>('/admin/stock-locations', auth, {
          method: 'POST',
          body: { name: 'Main Warehouse' },
        }));
        if (!created.ok) throw new Error(`stock_location: ${created.error}`);
        stockLocations = await getStockLocations();
        stockLocation = stockLocations[0];
      }
    }
    log.push(`stockLocation=${stockLocation?.id ?? '(dry)'}`);

    if (stockLocation && !stockLocation.sales_channels?.some((sc) => sc.id === salesChannel.id) && !dryRun) {
      const linked = await step('link sales_channel to stock_location', () =>
        admin<unknown>(`/admin/stock-locations/${stockLocation!.id}/sales-channels`, auth, {
          method: 'POST',
          body: { add: [salesChannel.id] },
        }),
      );
      if (!linked.ok) log.push(`(warn) link sales_channel: ${linked.error}`);
    }

    if (stockLocation && !dryRun) {
      const linkedFp = await step('link fulfillment_provider manual_manual to stock_location', () =>
        admin<unknown>(`/admin/stock-locations/${stockLocation!.id}/fulfillment-providers`, auth, {
          method: 'POST',
          body: { add: ['manual_manual'] },
        }),
      );
      if (!linkedFp.ok) log.push(`(warn) link fulfillment_provider: ${linkedFp.error}`);
    }

    let fulfillmentSet = stockLocation?.fulfillment_sets?.[0];
    if (stockLocation && !fulfillmentSet) {
      if (dryRun) { log.push('would create fulfillment_set'); }
      else {
        const created = await step('create fulfillment_set on stock_location', () =>
          admin<unknown>(
            `/admin/stock-locations/${stockLocation!.id}/fulfillment-sets`,
            auth,
            { method: 'POST', body: { name: 'Default Fulfillment', type: 'shipping' } },
          ),
        );
        if (!created.ok) throw new Error(`fulfillment_set: ${created.error}`);
        stockLocations = await getStockLocations();
        stockLocation = stockLocations[0];
        fulfillmentSet = stockLocation?.fulfillment_sets?.[0];
      }
    }
    log.push(`fulfillmentSet=${fulfillmentSet?.id ?? '(dry)'}`);

    let serviceZone = fulfillmentSet?.service_zones?.[0];
    if (fulfillmentSet && !serviceZone) {
      if (dryRun) { log.push('would create service_zone Europe'); }
      else {
        const created = await step('create service_zone Europe', () =>
          admin<unknown>(
            `/admin/fulfillment-sets/${fulfillmentSet!.id}/service-zones`,
            auth,
            {
              method: 'POST',
              body: {
                name: 'Europe',
                geo_zones: [
                  { type: 'country', country_code: 'fr' },
                  { type: 'country', country_code: 'be' },
                  { type: 'country', country_code: 'de' },
                  { type: 'country', country_code: 'it' },
                  { type: 'country', country_code: 'nl' },
                  { type: 'country', country_code: 'pt' },
                  { type: 'country', country_code: 'es' },
                ],
              },
            },
          ),
        );
        if (!created.ok) throw new Error(`service_zone: ${created.error}`);
        stockLocations = await getStockLocations();
        stockLocation = stockLocations[0];
        fulfillmentSet = stockLocation?.fulfillment_sets?.[0];
        serviceZone = fulfillmentSet?.service_zones?.[0];
      }
    }
    log.push(`serviceZone=${serviceZone?.id ?? '(dry)'}`);

    const spRes = await admin<{ shipping_profiles: ShippingProfile[] }>('/admin/shipping-profiles', auth);
    let shippingProfile = spRes.data?.shipping_profiles?.[0];
    if (!shippingProfile && !dryRun) {
      const created = await step('create shipping_profile', () =>
        admin<{ shipping_profile: ShippingProfile }>('/admin/shipping-profiles', auth, {
          method: 'POST',
          body: { name: 'Default Shipping Profile', type: 'default' },
        }),
      );
      if (!created.ok) throw new Error(`shipping_profile: ${created.error}`);
      shippingProfile = created.data!.shipping_profile;
    }
    log.push(`shippingProfile=${shippingProfile?.id ?? '(dry)'}`);

    const fpRes = await admin<{ fulfillment_providers: FulfillmentProvider[] }>('/admin/fulfillment-providers', auth);
    const manualProvider = fpRes.data?.fulfillment_providers?.find((p) => p.id === 'manual_manual') ?? fpRes.data?.fulfillment_providers?.[0];
    log.push(`fulfillmentProvider=${manualProvider?.id ?? '(none)'}`);

    const soRes = await admin<{ shipping_options: ShippingOption[] }>('/admin/shipping-options', auth);
    let shippingOption = soRes.data?.shipping_options?.[0];
    if (!shippingOption && serviceZone && shippingProfile && manualProvider && !dryRun) {
      const created = await step('create shipping_option Standard 5€', () =>
        admin<{ shipping_option: ShippingOption }>('/admin/shipping-options', auth, {
          method: 'POST',
          body: {
            name: 'Standard',
            service_zone_id: serviceZone!.id,
            shipping_profile_id: shippingProfile!.id,
            provider_id: manualProvider!.id,
            price_type: 'flat',
            type: { label: 'Standard', description: 'Livraison standard 3-5 jours', code: 'standard' },
            // Medusa v2 stores money in major units (EUR with decimals), not minor units.
            prices: [{ currency_code: 'eur', amount: 5 }],
            rules: [
              { attribute: 'enabled_in_store', value: 'true', operator: 'eq' },
              { attribute: 'is_return', value: 'false', operator: 'eq' },
            ],
          },
        }),
      );
      if (!created.ok) throw new Error(`shipping_option: ${created.error}`);
      shippingOption = created.data!.shipping_option;
    }
    log.push(`shippingOption=${shippingOption?.id ?? '(dry)'}`);

    if (!dryRun) {
      const providersList = await admin<{ payment_providers: { id: string }[] }>(
        '/admin/payments/payment-providers',
        auth,
      );
      const knownProviders = providersList.data?.payment_providers?.map((p) => p.id) ?? [];
      log.push(`globalProviders=${JSON.stringify(knownProviders)}`);

      const desired = ['pp_system_default', ...(knownProviders.includes('pp_stripe_stripe') ? ['pp_stripe_stripe'] : [])];

      for (const pp of desired) {
        const linkPp = await step(`enable ${pp} on region`, () =>
          admin<unknown>(`/admin/regions/${region.id}/payment-providers`, auth, {
            method: 'POST',
            body: { add: [pp] },
          }),
        );
        if (!linkPp.ok) {
          const patchRegion = await step(`patch region payment_providers (${pp}) fallback`, () =>
            admin<unknown>(`/admin/regions/${region.id}`, auth, {
              method: 'POST',
              body: { payment_providers: desired },
            }),
          );
          if (!patchRegion.ok) log.push(`(warn) enable ${pp}: ${linkPp.error} | fallback: ${patchRegion.error}`);
          break;
        }
      }
    }

    return NextResponse.json({
      success: true,
      dryRun,
      summary: {
        regionId: region.id,
        salesChannelId: salesChannel.id,
        stockLocationId: stockLocation?.id,
        fulfillmentSetId: fulfillmentSet?.id,
        serviceZoneId: serviceZone?.id,
        shippingProfileId: shippingProfile?.id,
        shippingOptionId: shippingOption?.id,
      },
      log,
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : 'unknown', log }, { status: 500 });
  }
}
