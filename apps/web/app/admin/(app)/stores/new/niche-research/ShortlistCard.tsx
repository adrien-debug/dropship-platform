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
  const verdictTone =
    sat == null
      ? 'border-blue-200 bg-blue-100/40'
      : sat > 70
      ? 'border-zinc-200 bg-zinc-100/40'
      : sat >= 30
      ? 'border-blue-200 bg-blue-50/40'
      : 'border-blue-200 bg-blue-100/40';
  const fp = payload.featured_product;
  const fpCost = fp ? (fp.cost_cents / 100).toFixed(2) : null;
  const fpPrice = fp ? (fp.suggested_price_cents / 100).toFixed(2) : null;
  const fpMargin = fp ? ((fp.suggested_price_cents - fp.cost_cents) / 100).toFixed(2) : null;
  const supplierTag = fp?.supplier === 'cj'
    ? 'bg-blue-50 text-blue-700 border-blue-200'
    : 'bg-zinc-100 text-zinc-700 border-zinc-200';

  return (
    <div className={`rounded-xl border ${verdictTone} px-5 py-4 space-y-4 min-w-0 max-w-full`}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-kicker uppercase tracking-label text-zinc-500 font-medium">
          Recommandation IA
        </p>
        {sat != null && (
          <span className="text-xs text-zinc-500">Saturation {sat}/100</span>
        )}
      </div>
      <h3 className="font-semibold tracking-tight text-xl text-zinc-900">
        <em className="italic">{payload.niche}</em>
      </h3>
      <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">
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
          className="group flex gap-3 items-stretch bg-white rounded-xl border border-zinc-200 hover:border-zinc-300 transition-colors overflow-hidden"
        >
          <div className="w-28 sm:w-32 shrink-0 aspect-square bg-zinc-100 overflow-hidden">
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
              <span className={`px-1.5 py-0.5 rounded-sm border ${supplierTag} font-semibold`}>
                {fp.supplier}
              </span>
              {fp.orders != null && (
                <span className="text-zinc-500 tabular-nums">{fp.orders} cmd</span>
              )}
              {fp.rating && (
                <span className="text-zinc-500 tabular-nums">★ {fp.rating}</span>
              )}
            </div>
            <p className="text-sm font-medium text-zinc-900 line-clamp-2 leading-tight">
              {fp.title}
            </p>
            <div className="flex items-baseline gap-3 text-xs tabular-nums">
              <span className="text-zinc-500">{fpCost} €</span>
              <span className="text-zinc-300">→</span>
              <span className="text-zinc-900 font-semibold">{fpPrice} €</span>
              <span className="text-blue-600 font-medium">+{fpMargin} €</span>
              {fp.expected_aov_eur != null && (
                <span className="text-zinc-400 ml-auto">AOV ~{fp.expected_aov_eur} €</span>
              )}
            </div>
            {fp.pricing_rationale && (
              <p className="text-xs text-zinc-600 leading-snug line-clamp-2 italic">
                {fp.pricing_rationale}
              </p>
            )}
            {fp.why_this_one && (
              <p className="text-xs text-zinc-500 leading-snug line-clamp-2">{fp.why_this_one}</p>
            )}
          </div>
        </a>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div className="bg-white/70 rounded-lg p-3 border border-zinc-200">
          <p className="text-kicker uppercase tracking-cta text-zinc-400">Nom suggéré</p>
          <p className="mt-1 font-medium text-zinc-900">{payload.suggested_store_name}</p>
        </div>
        {payload.estimated_aov_eur != null && (
          <div className="bg-white/70 rounded-lg p-3 border border-zinc-200">
            <p className="text-kicker uppercase tracking-cta text-zinc-400">AOV estimé</p>
            <p className="mt-1 font-medium text-zinc-900">
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
        <p className="text-xs text-zinc-500 leading-relaxed">
          <span className="font-medium text-zinc-700">Cible : </span>
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

      <div className="sticky bottom-0 -mx-5 -mb-4 px-5 pt-3 pb-4 bg-gradient-to-t from-white via-white to-white/0 backdrop-blur-sm">
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
          className="w-full bg-zinc-900 text-white py-3 rounded-lg text-sm font-medium hover:bg-zinc-800 transition-colors shadow-cta"
        >
          Lancer cette niche →
        </button>
      </div>
    </div>
  );
}
