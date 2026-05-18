import { useState } from 'react';
import { DesignPickerBlock } from './DesignPickerBlock';
import { MediaPlanBlock } from './MediaPlanBlock';
import type { DesignProposal, ShortlistPayload } from './types';

export function ShortlistCard({
  payload,
  onApply,
}: {
  payload: ShortlistPayload;
  onApply: (p: ShortlistPayload) => void;
}) {
  // The picker selection is local to the card — we don't persist it in the
  // chat history. Defaults to the first proposal so a single-click flow still
  // works (operator sees the first design highlighted, clicks "Lancer").
  const [selectedDesign, setSelectedDesign] = useState<DesignProposal | null>(
    payload.design_proposals?.[0] ?? null,
  );
  const sat = payload.saturation;
  const verdictBorder = sat != null && sat > 70 ? 'var(--ct-border)' : 'var(--ct-border-accent)';
  const verdictBg = sat != null && sat > 70 ? 'var(--ct-surface-1)' : 'var(--ct-accent-soft)';
  const fp = payload.featured_product;
  const fpCost = fp ? (fp.cost_cents / 100).toFixed(2) : null;
  const fpPrice = fp ? (fp.suggested_price_cents / 100).toFixed(2) : null;
  const fpMargin = fp ? ((fp.suggested_price_cents - fp.cost_cents) / 100).toFixed(2) : null;
  const supplierTagStyle = fp?.supplier === 'cj'
    ? { background: 'var(--ct-accent-soft)', color: 'var(--ct-accent)', borderColor: 'var(--ct-border-accent)' }
    : { background: 'var(--ct-surface-3)', color: 'var(--ct-text-body)', borderColor: 'var(--ct-border)' };

  return (
    <div className="rounded-xl px-5 py-4 space-y-4 min-w-0 max-w-full" style={{ border: `1px solid ${verdictBorder}`, background: verdictBg }}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-kicker uppercase tracking-label font-medium" style={{ color: 'var(--ct-text-muted)' }}>
          Recommandation IA
        </p>
        {sat != null && (
          <span className="text-xs" style={{ color: 'var(--ct-text-muted)' }}>Saturation {sat}/100</span>
        )}
      </div>
      <h3 className="font-semibold tracking-tight text-xl" style={{ color: 'var(--ct-text-primary)' }}>
        <em className="italic">{payload.niche}</em>
      </h3>
      <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--ct-text-body)' }}>
        {payload.rationale}
      </p>

      {/* Featured product — image + supplier-grade meta. This is the
          piece the operator wants to actually SEE before committing
          to the niche. */}
      {fp && (
        <a
          href={fp.supplier_url}
          target="_blank"
          rel="noreferrer noopener"
          className="group flex gap-3 items-stretch rounded-xl transition-colors overflow-hidden"
          style={{ border: '1px solid var(--ct-border)', background: 'var(--ct-surface-1)' }}
        >
          <div className="w-28 sm:w-32 shrink-0 aspect-square overflow-hidden" style={{ background: 'var(--ct-surface-2)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={fp.image_url}
              alt={fp.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
              loading="lazy"
            />
          </div>
          <div className="flex-1 min-w-0 py-3 pr-3 space-y-1.5">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-cta">
              <span className="px-1.5 py-0.5 rounded-sm border font-semibold" style={supplierTagStyle}>
                {fp.supplier}
              </span>
              {fp.orders != null && (
                <span className="tabular-nums" style={{ color: 'var(--ct-text-muted)' }}>{fp.orders} cmd</span>
              )}
              {fp.rating && (
                <span className="tabular-nums" style={{ color: 'var(--ct-text-muted)' }}>★ {fp.rating}</span>
              )}
            </div>
            <p className="text-sm font-medium line-clamp-2 leading-tight" style={{ color: 'var(--ct-text-primary)' }}>
              {fp.title}
            </p>
            <div className="flex items-baseline gap-3 text-xs tabular-nums">
              <span style={{ color: 'var(--ct-text-muted)' }}>{fpCost} €</span>
              <span style={{ color: 'var(--ct-border-strong)' }}>→</span>
              <span className="font-semibold" style={{ color: 'var(--ct-text-primary)' }}>{fpPrice} €</span>
              <span className="font-medium" style={{ color: 'var(--ct-accent)' }}>+{fpMargin} €</span>
              {fp.expected_aov_eur != null && (
                <span className="ml-auto" style={{ color: 'var(--ct-text-muted)' }}>AOV ~{fp.expected_aov_eur} €</span>
              )}
            </div>
            {fp.pricing_rationale && (
              <p className="text-xs leading-snug line-clamp-2 italic" style={{ color: 'var(--ct-text-body)' }}>
                {fp.pricing_rationale}
              </p>
            )}
            {fp.why_this_one && (
              <p className="text-xs leading-snug line-clamp-2" style={{ color: 'var(--ct-text-muted)' }}>{fp.why_this_one}</p>
            )}
          </div>
        </a>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg p-3" style={{ background: 'var(--ct-surface-1)', border: '1px solid var(--ct-border)' }}>
          <p className="text-kicker uppercase tracking-cta" style={{ color: 'var(--ct-text-muted)' }}>Nom suggéré</p>
          <p className="mt-1 font-medium" style={{ color: 'var(--ct-text-primary)' }}>{payload.suggested_store_name}</p>
        </div>
        {payload.estimated_aov_eur != null && (
          <div className="rounded-lg p-3" style={{ background: 'var(--ct-surface-1)', border: '1px solid var(--ct-border)' }}>
            <p className="text-kicker uppercase tracking-cta" style={{ color: 'var(--ct-text-muted)' }}>AOV estimé</p>
            <p className="mt-1 font-medium" style={{ color: 'var(--ct-text-primary)' }}>
              {payload.estimated_aov_eur.toLocaleString('fr-FR', {
                style: 'currency',
                currency: 'EUR',
                maximumFractionDigits: 0,
              })}
            </p>
          </div>
        )}
      </div>
      {payload.target_audience && (
        <p className="text-xs leading-relaxed" style={{ color: 'var(--ct-text-muted)' }}>
          <span className="font-medium" style={{ color: 'var(--ct-text-body)' }}>Cible : </span>
          {payload.target_audience}
        </p>
      )}
      {payload.media_plan && <MediaPlanBlock plan={payload.media_plan} />}

      {payload.design_proposals && payload.design_proposals.length > 0 && (
        <DesignPickerBlock
          proposals={payload.design_proposals}
          selected={selectedDesign}
          onSelect={setSelectedDesign}
        />
      )}

      <div className="sticky bottom-0 -mx-5 -mb-4 px-5 pt-3 pb-4 backdrop-blur-sm" style={{ background: 'linear-gradient(to top, var(--ct-surface-0) 60%, transparent)' }}>
        <button
          type="button"
          onClick={() =>
            onApply({
              ...payload,
              // Carry the picker's choice to the parent. If the agent
              // didn't propose any design we just send the payload as-is
              // — the store-creator will fall back to its default preset.
              design_proposals: selectedDesign ? [selectedDesign] : payload.design_proposals,
            })
          }
          className="ct-seg-btn primary w-full py-3 rounded-lg text-sm font-medium"
        >
          Lancer cette niche →
        </button>
      </div>
    </div>
  );
}
