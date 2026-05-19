import type { CostSummary } from './types';
import { fmtEur } from './utils';

interface CopilotSidebarProps {
  mode: 'mono' | 'collection';
  onModeChange: (mode: 'mono' | 'collection') => void;
  language: 'fr' | 'en';
  onLanguageChange: (lang: 'fr' | 'en') => void;
  skipVideo: boolean;
  onSkipVideoChange: (skip: boolean) => void;
  cost: CostSummary;
}

export function CopilotSidebar({
  mode,
  onModeChange,
  language,
  onLanguageChange,
  skipVideo,
  onSkipVideoChange,
  cost,
}: CopilotSidebarProps) {
  return (
    <aside className="px-4 py-4 space-y-4 overflow-y-auto text-xs" style={{ background: 'var(--ct-surface-1)' }}>
      {/* Sélecteurs rapides */}
      <div>
        <p className="text-[10px] uppercase tracking-cta font-semibold mb-2" style={{ color: 'var(--ct-text-muted)' }}>
          Format
        </p>
        <div className="ct-seg-track grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => onModeChange('mono')}
            className={`ct-seg-btn${mode === 'mono' ? ' active' : ''}`}
          >
            Mono
          </button>
          <button
            type="button"
            onClick={() => onModeChange('collection')}
            className={`ct-seg-btn${mode === 'collection' ? ' active' : ''}`}
          >
            Collection
          </button>
        </div>
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-cta font-semibold mb-2" style={{ color: 'var(--ct-text-muted)' }}>
          Langue
        </p>
        <div className="ct-seg-track grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => onLanguageChange('fr')}
            className={`ct-seg-btn${language === 'fr' ? ' active' : ''}`}
          >
            FR
          </button>
          <button
            type="button"
            onClick={() => onLanguageChange('en')}
            className={`ct-seg-btn${language === 'en' ? ' active' : ''}`}
          >
            EN
          </button>
        </div>
      </div>

      {mode === 'mono' && (
        <div>
          <label className="flex items-center justify-between gap-2 cursor-pointer">
            <span className="text-[10px] uppercase tracking-cta font-semibold" style={{ color: 'var(--ct-text-muted)' }}>
              Vidéo promo
            </span>
            <input
              type="checkbox"
              checked={!skipVideo}
              onChange={(e) => onSkipVideoChange(!e.target.checked)}
              className="w-3.5 h-3.5"
            />
          </label>
        </div>
      )}

      {/* Comment ça marche */}
      <div className="pt-3" style={{ borderTop: '1px solid var(--ct-border)' }}>
        <p className="text-[10px] uppercase tracking-cta font-semibold mb-2" style={{ color: 'var(--ct-text-muted)' }}>
          Comment ça marche
        </p>
        <ul className="text-[11px] space-y-1.5 leading-snug" style={{ color: 'var(--ct-text-body)' }}>
          <li><span className="font-medium" style={{ color: 'var(--ct-text-primary)' }}>Recherche web</span> · Tavily + Perplexity</li>
          <li><span className="font-medium" style={{ color: 'var(--ct-text-primary)' }}>Meta Ads</span> · saturation 0-100 + angles</li>
          <li><span className="font-medium" style={{ color: 'var(--ct-text-primary)' }}>AliExpress + CJ</span> · supply + marge</li>
        </ul>
      </div>

      {/* Coût session */}
      <div className="pt-3" style={{ borderTop: '1px solid var(--ct-border)' }}>
        <p className="text-[10px] uppercase tracking-cta font-semibold mb-2" style={{ color: 'var(--ct-text-muted)' }}>
          Coût session
        </p>
        <div className="space-y-1 tabular-nums text-[11px]">
          <div className="flex justify-between">
            <span style={{ color: 'var(--ct-text-body)' }}>Tokens i/o</span>
            <span style={{ color: 'var(--ct-text-primary)' }}>
              {cost.input_tokens.toLocaleString('fr-FR')} / {cost.output_tokens.toLocaleString('fr-FR')}
            </span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: 'var(--ct-text-body)' }}>Estimation</span>
            <span className="font-semibold" style={{ color: 'var(--ct-text-primary)' }}>{fmtEur(cost.cost_eur)}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
