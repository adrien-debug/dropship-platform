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
    <aside className="px-4 py-4 space-y-4 bg-zinc-50/30 overflow-y-auto text-xs">
      {/* Sélecteurs rapides */}
      <div>
        <p className="text-[10px] uppercase tracking-cta text-zinc-400 font-semibold mb-2">
          Format
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => onModeChange('mono')}
            className={`px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              mode === 'mono'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-zinc-500 border-zinc-200 hover:bg-blue-50'
            }`}
          >
            Mono
          </button>
          <button
            type="button"
            onClick={() => onModeChange('collection')}
            className={`px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              mode === 'collection'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-zinc-500 border-zinc-200 hover:bg-blue-50'
            }`}
          >
            Collection
          </button>
        </div>
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-cta text-zinc-400 font-semibold mb-2">
          Langue
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => onLanguageChange('fr')}
            className={`px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              language === 'fr'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-zinc-500 border-zinc-200 hover:bg-blue-50'
            }`}
          >
            FR
          </button>
          <button
            type="button"
            onClick={() => onLanguageChange('en')}
            className={`px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              language === 'en'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-zinc-500 border-zinc-200 hover:bg-blue-50'
            }`}
          >
            EN
          </button>
        </div>
      </div>

      {mode === 'mono' && (
        <div>
          <label className="flex items-center justify-between gap-2 cursor-pointer">
            <span className="text-[10px] uppercase tracking-cta text-zinc-400 font-semibold">
              Vidéo promo
            </span>
            <input
              type="checkbox"
              checked={!skipVideo}
              onChange={(e) => onSkipVideoChange(!e.target.checked)}
              className="accent-blue-600 w-3.5 h-3.5"
            />
          </label>
        </div>
      )}

      {/* Comment ça marche */}
      <div className="border-t border-zinc-200 pt-3">
        <p className="text-[10px] uppercase tracking-cta text-zinc-400 font-semibold mb-2">
          Comment ça marche
        </p>
        <ul className="text-[11px] text-zinc-500 space-y-1.5 leading-snug">
          <li><span className="font-medium text-zinc-900">Recherche web</span> · Tavily + Perplexity</li>
          <li><span className="font-medium text-zinc-900">Meta Ads</span> · saturation 0-100 + angles</li>
          <li><span className="font-medium text-zinc-900">AliExpress + CJ</span> · supply + marge</li>
        </ul>
      </div>

      {/* Coût session */}
      <div className="border-t border-zinc-200 pt-3">
        <p className="text-[10px] uppercase tracking-cta text-zinc-400 font-semibold mb-2">
          Coût session
        </p>
        <div className="space-y-1 tabular-nums text-[11px]">
          <div className="flex justify-between">
            <span className="text-zinc-500">Tokens i/o</span>
            <span className="text-zinc-900">
              {cost.input_tokens.toLocaleString('fr-FR')} / {cost.output_tokens.toLocaleString('fr-FR')}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Estimation</span>
            <span className="font-semibold text-zinc-900">{fmtEur(cost.cost_eur)}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
