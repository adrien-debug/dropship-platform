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
    <div className="pt-4 space-y-4" style={{ borderTop: '1px solid var(--ct-border)' }}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-kicker uppercase tracking-label font-medium" style={{ color: 'var(--ct-text-muted)' }}>
          Plan média
        </p>
        <span className="text-xs tabular-nums" style={{ color: 'var(--ct-text-body)' }}>
          {plan.daily_budget_eur.toLocaleString('fr-FR')} € / jour
        </span>
      </div>

      {/* Channel mix — stacked horizontal bar */}
      <div>
        <div className="flex h-2 rounded-full overflow-hidden" style={{ background: 'var(--ct-surface-3)' }}>
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
              <span className="font-medium" style={{ color: 'var(--ct-text-body)' }}>{CHANNEL_LABEL[c.name]}</span>
              <span className="tabular-nums" style={{ color: 'var(--ct-text-muted)' }}>{c.weight_pct}%</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Outcomes */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs rounded-lg p-3" style={{ border: '1px solid var(--ct-border)', background: 'var(--ct-surface-1)' }}>
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
        <p className="text-xs italic leading-snug" style={{ color: 'var(--ct-text-body)' }}>
          {plan.expected_outcomes.breakeven_note}
        </p>
      )}

      {/* Geo + audience side by side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div className="rounded-lg p-3" style={{ border: '1px solid var(--ct-border)', background: 'var(--ct-surface-1)' }}>
          <p className="text-kicker uppercase tracking-cta mb-1.5" style={{ color: 'var(--ct-text-muted)' }}>Géo</p>
          <p className="font-medium" style={{ color: 'var(--ct-text-primary)' }}>{plan.geo.primary_countries.join(' · ')}</p>
          {plan.geo.emphasis && plan.geo.emphasis.length > 0 && (
            <p className="mt-1" style={{ color: 'var(--ct-text-body)' }}>
              Focus : {plan.geo.emphasis.join(', ')}
            </p>
          )}
          {plan.geo.rationale && (
            <p className="mt-1 leading-snug" style={{ color: 'var(--ct-text-muted)' }}>{plan.geo.rationale}</p>
          )}
        </div>
        <div className="rounded-lg p-3" style={{ border: '1px solid var(--ct-border)', background: 'var(--ct-surface-1)' }}>
          <p className="text-kicker uppercase tracking-cta mb-1.5" style={{ color: 'var(--ct-text-muted)' }}>Audience</p>
          <p className="leading-snug" style={{ color: 'var(--ct-text-body)' }}>{plan.audience.demographics}</p>
          {plan.audience.interests.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {plan.audience.interests.slice(0, 6).map((i) => (
                <span
                  key={i}
                  className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-[10px]"
                  style={{ border: '1px solid var(--ct-border)', color: 'var(--ct-text-body)' }}
                >
                  {i}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Schedule */}
      <div className="rounded-lg p-3 text-xs" style={{ border: '1px solid var(--ct-border)', background: 'var(--ct-surface-1)' }}>
        <p className="text-kicker uppercase tracking-cta mb-1.5" style={{ color: 'var(--ct-text-muted)' }}>Horaires</p>
        <p style={{ color: 'var(--ct-text-body)' }}>
          <span className="font-medium" style={{ color: 'var(--ct-text-primary)' }}>{plan.schedule.best_hours_local.join(' · ')}</span>
          <span className="mx-1.5" style={{ color: 'var(--ct-text-muted)' }}>·</span>
          {plan.schedule.best_days.join(', ')}
          {plan.schedule.timezone && (
            <span className="ml-1.5" style={{ color: 'var(--ct-text-muted)' }}>({plan.schedule.timezone})</span>
          )}
        </p>
        {plan.schedule.rationale && (
          <p className="mt-1 leading-snug" style={{ color: 'var(--ct-text-muted)' }}>{plan.schedule.rationale}</p>
        )}
      </div>

      {/* Top hooks */}
      {plan.top_hooks && plan.top_hooks.length > 0 && (
        <div>
          <p className="text-kicker uppercase tracking-cta mb-2" style={{ color: 'var(--ct-text-muted)' }}>Hooks créatifs</p>
          <ul className="space-y-1.5">
            {plan.top_hooks.slice(0, 3).map((h, i) => (
              <li key={i} className="flex items-baseline gap-2 text-xs">
                <span className="tabular-nums shrink-0" style={{ color: 'var(--ct-text-muted)' }}>{(i + 1).toString().padStart(2, '0')}</span>
                <span className="leading-snug" style={{ color: 'var(--ct-text-body)' }}>«&nbsp;{h}&nbsp;»</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
