'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

interface InitialValues {
  ga4MeasurementId: string;
  ga4ApiSecret: string;
  metaPixelId: string;
  metaCapiToken: string;
  tiktokPixelId: string;
  tiktokEventsToken: string;
  clarityId: string;
  googleAdsConversionAction: string;
  googleAdsMerchantId: string;
}

interface Props {
  storeId: string;
  initial: InitialValues;
}

/**
 * Admin form to manage per-store analytics IDs. Three groups:
 *   - Acquisition (UA): GA4 + Meta Pixel + TikTok Pixel — public IDs that
 *     get injected into the storefront on every visit.
 *   - Server-side dedup: Meta CAPI + TikTok Events tokens — sensitive,
 *     used by the server to forward purchase events bypassing ad blockers.
 *   - UX: Microsoft Clarity ID for session replays + heatmaps.
 *
 * Empty string clears a previously-set value, undefined leaves it untouched.
 */
export function StoreAnalyticsForm({ storeId, initial }: Props) {
  const [values, setValues] = useState<InitialValues>(initial);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const router = useRouter();

  const set = (k: keyof InitialValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  function submit() {
    setFeedback(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/agent/stores/${storeId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ analytics: values }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Erreur');
        setFeedback({ type: 'ok', msg: 'Mis à jour.' });
        router.refresh();
      } catch (e) {
        setFeedback({ type: 'err', msg: e instanceof Error ? e.message : 'Erreur' });
      }
    });
  }

  return (
    <div className="border rounded-xl bg-white">
      <div className="px-6 py-4 border-b flex items-baseline justify-between">
        <div>
          <h3 className="text-base font-serif">
            Analytics & <em className="italic text-zinc-700">attribution</em>
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Les pixels et tags injectés sur la boutique. Tous facultatifs, tous propres à ce store.
          </p>
        </div>
      </div>

      <div className="p-6 space-y-8">
        <Group title="Acquisition (UA)" hint="Pixels client-side. Indispensables pour les ads.">
          <Field
            label="Google Analytics 4"
            id="ga4"
            placeholder="G-XXXXXXXXXX"
            value={values.ga4MeasurementId}
            onChange={set('ga4MeasurementId')}
            help="Measurement ID. Trouvé dans Admin → Streams → Web."
          />
          <Field
            label="Meta Pixel ID"
            id="meta"
            placeholder="123456789012345"
            value={values.metaPixelId}
            onChange={set('metaPixelId')}
            help="Numérique, 15-16 chiffres. Events Manager → Data Sources."
          />
          <Field
            label="TikTok Pixel ID"
            id="tiktok"
            placeholder="C..."
            value={values.tiktokPixelId}
            onChange={set('tiktokPixelId')}
            help="Préfixe C. Ads Manager → Assets → Events."
          />
        </Group>

        <Group
          title="Server-side dedup (CAPI / Events API)"
          hint="Tokens secrets. Stockés en clair en DB — n'utilise que ceux de cette boutique."
          tone="warn"
        >
          <Field
            label="Meta Conversions API token"
            id="meta-capi"
            type="password"
            placeholder="EAA..."
            value={values.metaCapiToken}
            onChange={set('metaCapiToken')}
            help="Events Manager → ton pixel → Settings → Generate access token."
          />
          <Field
            label="TikTok Events API access token"
            id="tiktok-events"
            type="password"
            placeholder="..."
            value={values.tiktokEventsToken}
            onChange={set('tiktokEventsToken')}
            help="Ads Manager → Events → Web Events → Settings → Manage Events API."
          />
          <Field
            label="GA4 Measurement Protocol API secret"
            id="ga4-api-secret"
            type="password"
            placeholder="abcDEF123..."
            value={values.ga4ApiSecret}
            onChange={set('ga4ApiSecret')}
            help="GA4 Admin → Data Streams → ton stream Web → Measurement Protocol API secrets → Create."
          />
        </Group>

        <Group title="Comportement (UX)" hint="Replays de session, heatmaps. Gratuit, RGPD-friendly.">
          <Field
            label="Microsoft Clarity Project ID"
            id="clarity"
            placeholder="abcd1234ef"
            value={values.clarityId}
            onChange={set('clarityId')}
            help="clarity.microsoft.com → projet → Settings → Setup."
          />
        </Group>

        <Group title="Google Ads" hint="Remontée des conversions offline — contourne les bloqueurs côté client.">
          <Field
            label="Conversion Action"
            id="google-ads-conversion-action"
            placeholder="customers/2877134493/conversionActions/…"
            value={values.googleAdsConversionAction}
            onChange={set('googleAdsConversionAction')}
            help="Google Ads → Objectifs → Conversions → sélectionne l'action → champ Nom de ressource."
          />
          <Field
            label="Merchant Center ID"
            id="google-merchant-id"
            placeholder="5784865611"
            value={values.googleAdsMerchantId}
            onChange={set('googleAdsMerchantId')}
            help="Merchant Center → Paramètres du compte → Numéro d'ID."
          />
        </Group>
      </div>

      <div className="px-6 py-4 border-t bg-zinc-50/60 flex items-center justify-between gap-4">
        {feedback ? (
          <span className={`text-sm ${feedback.type === 'ok' ? 'text-emerald-700' : 'text-red-700'}`}>
            {feedback.msg}
          </span>
        ) : (
          <span className="text-xs text-zinc-400">
            Champ vide → la valeur est effacée. Champ inchangé → conservé.
          </span>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="bg-zinc-950 text-white px-6 py-2.5 rounded-full text-xs uppercase tracking-cta font-medium hover:bg-black transition-colors disabled:opacity-60"
        >
          {pending ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
}

function Group({
  title,
  hint,
  children,
  tone = 'default',
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  tone?: 'default' | 'warn';
}) {
  return (
    <section>
      <div className="mb-4">
        <h4 className={`text-xs uppercase tracking-label font-medium ${tone === 'warn' ? 'text-amber-700' : 'text-zinc-500'}`}>
          {title}
        </h4>
        {hint && <p className="text-xs text-zinc-400 mt-1">{hint}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  id,
  value,
  onChange,
  placeholder,
  help,
  type = 'text',
}: {
  label: string;
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  help?: string;
  type?: 'text' | 'password';
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-zinc-800 mb-1.5">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400"
        autoComplete="off"
        spellCheck={false}
      />
      {help && <p className="text-[11px] text-zinc-400 mt-1">{help}</p>}
    </div>
  );
}
