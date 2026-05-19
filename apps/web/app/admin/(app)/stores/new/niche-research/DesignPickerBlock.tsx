import type { DesignProposal } from './types';

const PRESET_LABELS: Record<DesignProposal['preset'], { label: string; tagline: string }> = {
  'editorial-serif':  { label: 'Editorial serif',  tagline: 'Magazine, italiques cinéma, blancs généreux.' },
  'tech-mono':        { label: 'Tech mono',        tagline: 'Vercel-grade, Geist, lettres précises.' },
  'brutalist-luxe':   { label: 'Brutalist luxe',   tagline: 'Off-White, blocs noirs, contraste max.' },
  'gen-z-bold':       { label: 'Gen-Z bold',       tagline: 'TikTok, saturé, énergique, grain.' },
  'lifestyle-warm':   { label: 'Lifestyle warm',   tagline: 'Aimé Leon Dore, sable, dimanche matin.' },
};

const PRESET_DISPLAY_FONT: Record<DesignProposal['preset'], string> = {
  'editorial-serif': "'Instrument Serif', Georgia, serif",
  'tech-mono':       "'Geist', system-ui, sans-serif",
  'brutalist-luxe':  "'PP Editorial New', 'Times New Roman', serif",
  'gen-z-bold':      "'Migra', 'Playfair Display', serif",
  'lifestyle-warm':  "'Fraunces', Georgia, serif",
};

export function DesignPickerBlock({
  proposals,
  selected,
  onSelect,
}: {
  proposals: DesignProposal[];
  selected: DesignProposal | null;
  onSelect: (p: DesignProposal) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-kicker uppercase tracking-cta font-medium" style={{ color: 'var(--ct-text-muted)' }}>
        Design system — choisis l&apos;ambiance
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {proposals.map((p) => {
          const isActive =
            selected?.preset === p.preset &&
            selected.primary === p.primary &&
            selected.accent === p.accent;
          const meta = PRESET_LABELS[p.preset];
          return (
            <button
              key={`${p.preset}-${p.primary}`}
              type="button"
              onClick={() => onSelect(p)}
              className="text-left rounded-xl overflow-hidden transition-all"
              style={{
                border: isActive ? '1px solid var(--ct-text-primary)' : '1px solid var(--ct-border)',
                background: 'var(--ct-surface-1)',
                boxShadow: isActive ? '0 0 0 2px var(--ct-border-strong)' : 'none',
              }}
              aria-pressed={isActive}
            >
              {/* Sample */}
              <div
                className="px-3 py-3 flex items-baseline gap-2"
                style={{ background: p.primary }}
              >
                <span
                  className="text-xl text-white leading-none"
                  style={{ fontFamily: PRESET_DISPLAY_FONT[p.preset], fontStyle: 'italic' }}
                >
                  Aa
                </span>
                <span
                  className="text-[11px] uppercase tracking-cta text-white/70 font-medium"
                  style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
                >
                  Sample
                </span>
                <span
                  className="ml-auto w-4 h-4 rounded-full border border-white/40"
                  style={{ background: p.accent }}
                  aria-hidden
                />
              </div>
              {/* Body */}
              <div className="px-3 py-2.5 space-y-1">
                <p className="text-[13px] font-semibold leading-tight" style={{ color: 'var(--ct-text-primary)' }}>
                  {meta.label}
                </p>
                <p className="text-[11px] leading-snug line-clamp-2" style={{ color: 'var(--ct-text-muted)' }}>
                  {meta.tagline}
                </p>
                <div className="flex items-center gap-1.5 pt-1">
                  <span
                    className="inline-block w-3 h-3 rounded-sm"
                    style={{ background: p.primary, border: '1px solid var(--ct-border)' }}
                    aria-hidden
                  />
                  <span className="text-[10px] tabular-nums uppercase" style={{ color: 'var(--ct-text-muted)' }}>{p.primary}</span>
                  <span
                    className="inline-block w-3 h-3 rounded-sm ml-1.5"
                    style={{ background: p.accent, border: '1px solid var(--ct-border)' }}
                    aria-hidden
                  />
                  <span className="text-[10px] tabular-nums uppercase" style={{ color: 'var(--ct-text-muted)' }}>{p.accent}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      {selected?.rationale && (
        <p className="text-xs leading-relaxed italic" style={{ color: 'var(--ct-text-muted)' }}>{selected.rationale}</p>
      )}
    </div>
  );
}
