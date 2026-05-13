'use client';

import { cn } from '@/lib/utils/cn';
import type { CopilotMode } from '@/lib/agent/copilot-router';

const MODE_CONFIG: Record<CopilotMode, { label: string; description: string }> = {
  research: { label: 'Recherche', description: 'Trouver une niche' },
  curation: { label: 'Curation', description: 'Catalogue produits' },
  ads: { label: 'Ads', description: 'Hooks et ciblages' },
  medias: { label: 'Médias', description: 'Hero, lifestyle, promo' },
  dev: { label: 'Dev', description: 'Code de la plateforme' },
};

const MODE_ORDER: CopilotMode[] = ['research', 'curation', 'ads', 'medias', 'dev'];

interface ModeSelectorProps {
  activeMode: CopilotMode;
  onModeChange: (mode: CopilotMode) => void;
}

/**
 * ModeSelector — horizontal pills for copilot modes.
 */
export function ModeSelector({ activeMode, onModeChange }: ModeSelectorProps) {
  return (
    <div className="flex items-center gap-1.5">
      {MODE_ORDER.map((mode) => {
        const isActive = mode === activeMode;
        return (
          <button
            key={mode}
            onClick={() => onModeChange(mode)}
            title={MODE_CONFIG[mode].description}
            className={cn(
              'px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all duration-200',
              isActive
                ? 'bg-[var(--accent-cyan)]/15 text-[var(--accent-cyan)] border border-[var(--accent-cyan)]/25 shadow-[0_0_12px_rgba(0,183,255,0.06)]'
                : 'bg-ds-surface-subtle text-ds-text-muted border border-ds-border-subtle hover:border-ds-border-default hover:text-ds-text-secondary',
            )}
          >
            {MODE_CONFIG[mode].label}
          </button>
        );
      })}
    </div>
  );
}
