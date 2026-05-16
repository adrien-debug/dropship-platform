import { Metric } from './renderers';
import type { MediaChannel, MediaPlan } from './types';

const CHANNEL_COLOR: Record<MediaChannel['name'], string> = {
  meta: 'bg-blue-600',
  tiktok: 'bg-zinc-900',
  google: 'bg-blue-300',
  pinterest: 'bg-zinc-400',
};

const CHANNEL_LABEL: Record<MediaChannel['name'], string> = {
  meta: 'Meta',
  tiktok: 'TikTok',
  google: 'Google',
  pinterest: 'Pinterest',
};

export function MediaPlanBlock({ plan }: { plan: MediaPlan }) {
  const totalWeight = plan.channels.reduce((acc, c) => acc + c.weight_pct, 0) || 100;
  return (
    <div className="border-t border-zinc-200/70 pt-4 space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-kicker uppercase tracking-label text-zinc-500 font-medium">
          Plan média
        </p>
        <span className="text-xs text-zinc-500 tabular-nums">
          {plan.daily_budget_eur.toLocaleString('fr-FR')} € / jour
        </span>
      </div>

      {/* Channel mix — stacked horizontal bar */}
      <div>
        <div className="flex h-2 rounded-full overflow-hidden bg-zinc-100">
          {plan.channels.map((c) => (
            <div
              key={c.name}
              className={CHANNEL_COLOR[c.name]}
              style={{ width: `${(c.weight_pct / totalWeight) * 100}%` }}
              title={`${CHANNEL_LABEL[c.name]} ${c.weight_pct}%`}
            />
          ))}
        </div>
        <ul className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          {plan.channels.map((c) => (
            <li key={c.name} className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${CHANNEL_COLOR[c.name]}`} />
              <span className="text-zinc-700 font-medium">{CHANNEL_LABEL[c.name]}</span>
              <span className="text-zinc-400 tabular-nums">{c.weight_pct}%</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Outcomes */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-white/70 rounded-lg border border-zinc-200 p-3">
        <Metric label="CPA cible" value={`${plan.expected_outcomes.target_cpa_eur.toFixed(0)} €`} />
        <Metric label="ROAS cible" value={`×${plan.expected_outcomes.target_roas.toFixed(1)}`} />
        <Metric
          label="Cmd / jour"
          value={`${plan.expected_outcomes.daily_orders_low}–${plan.expected_outcomes.daily_orders_high}`}
        />
        <Metric
          label="Budget"
          value={`${plan.daily_budget_eur.toLocaleString('fr-FR')} €`}
        />
      </div>
      {plan.expected_outcomes.breakeven_note && (
        <p className="text-xs text-zinc-500 italic leading-snug">
          {plan.expected_outcomes.breakeven_note}
        </p>
      )}

      {/* Geo + audience side by side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div className="bg-white/70 rounded-lg border border-zinc-200 p-3">
          <p className="text-kicker uppercase tracking-cta text-zinc-400 mb-1.5">Géo</p>
          <p className="font-medium text-zinc-900">{plan.geo.primary_countries.join(' · ')}</p>
          {plan.geo.emphasis && plan.geo.emphasis.length > 0 && (
            <p className="text-zinc-600 mt-1">
              Focus : {plan.geo.emphasis.join(', ')}
            </p>
          )}
          {plan.geo.rationale && (
            <p className="text-zinc-500 mt-1 leading-snug">{plan.geo.rationale}</p>
          )}
        </div>
        <div className="bg-white/70 rounded-lg border border-zinc-200 p-3">
          <p className="text-kicker uppercase tracking-cta text-zinc-400 mb-1.5">Audience</p>
          <p className="text-zinc-700 leading-snug">{plan.audience.demographics}</p>
          {plan.audience.interests.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {plan.audience.interests.slice(0, 6).map((i) => (
                <span
                  key={i}
                  className="inline-flex items-center px-1.5 py-0.5 rounded-sm border border-zinc-200 text-[10px] text-zinc-600"
                >
                  {i}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Schedule */}
      <div className="bg-white/70 rounded-lg border border-zinc-200 p-3 text-xs">
        <p className="text-kicker uppercase tracking-cta text-zinc-400 mb-1.5">Horaires</p>
        <p className="text-zinc-700">
          <span className="font-medium text-zinc-900">{plan.schedule.best_hours_local.join(' · ')}</span>
          <span className="text-zinc-400 mx-1.5">·</span>
          {plan.schedule.best_days.join(', ')}
          {plan.schedule.timezone && (
            <span className="text-zinc-400 ml-1.5">({plan.schedule.timezone})</span>
          )}
        </p>
        {plan.schedule.rationale && (
          <p className="text-zinc-500 mt-1 leading-snug">{plan.schedule.rationale}</p>
        )}
      </div>

      {/* Top hooks */}
      {plan.top_hooks && plan.top_hooks.length > 0 && (
        <div>
          <p className="text-kicker uppercase tracking-cta text-zinc-400 mb-2">Hooks créatifs</p>
          <ul className="space-y-1.5">
            {plan.top_hooks.slice(0, 3).map((h, i) => (
              <li key={i} className="flex items-baseline gap-2 text-xs">
                <span className="text-zinc-400 tabular-nums shrink-0">{(i + 1).toString().padStart(2, '0')}</span>
                <span className="text-zinc-700 leading-snug">«&nbsp;{h}&nbsp;»</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
