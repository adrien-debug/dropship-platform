import { notFound } from 'next/navigation';
import { getDbRead } from '@/lib/db';
import { PageHeader } from '../../../../_components/AdminUI';
import { StoreTemplateForm } from '../StoreTemplateForm';
import { StoreCustomDomainForm } from '../StoreCustomDomainForm';
import { StoreAnalyticsForm } from '../StoreAnalyticsForm';

export const dynamic = 'force-dynamic';

interface SettingsRow {
  id: string;
  slug: string;
  template: 'auto' | 'mono' | 'collection-grid' | 'collection-editorial';
  custom_domain: string | null;
  ga4_measurement_id: string | null;
  ga4_api_secret: string | null;
  meta_pixel_id: string | null;
  meta_capi_token: string | null;
  tiktok_pixel_id: string | null;
  tiktok_events_token: string | null;
  clarity_id: string | null;
  google_ads_conversion_action: string | null;
  google_merchant_id: string | null;
}

export default async function StoreSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDbRead();
  const { rows } = await db.query<SettingsRow>(
    `SELECT id, slug, template, custom_domain,
            ga4_measurement_id, ga4_api_secret,
            meta_pixel_id, meta_capi_token,
            tiktok_pixel_id, tiktok_events_token, clarity_id,
            google_ads_conversion_action, google_merchant_id
       FROM dropship_stores WHERE id = $1 LIMIT 1`,
    [id],
  );
  const store = rows[0];
  if (!store) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Réglages"
        title={<span>Configuration <em className="italic text-ds-text-muted">du store</em></span>}
        lede="Rendu, domaine et tokens analytics. Tous les changements sont instantanés, sans rebuild."
      />

      <StoreTemplateForm
        storeId={store.id}
        storeSlug={store.slug}
        initial={store.template}
      />

      <StoreCustomDomainForm
        storeId={store.id}
        initial={store.custom_domain ?? ''}
      />

      <StoreAnalyticsForm
        storeId={store.id}
        initial={{
          ga4MeasurementId: store.ga4_measurement_id ?? '',
          ga4ApiSecret: store.ga4_api_secret ?? '',
          metaPixelId: store.meta_pixel_id ?? '',
          metaCapiToken: store.meta_capi_token ?? '',
          tiktokPixelId: store.tiktok_pixel_id ?? '',
          tiktokEventsToken: store.tiktok_events_token ?? '',
          clarityId: store.clarity_id ?? '',
          googleAdsConversionAction: store.google_ads_conversion_action ?? '',
          googleAdsMerchantId: store.google_merchant_id ?? '',
        }}
      />
    </div>
  );
}
