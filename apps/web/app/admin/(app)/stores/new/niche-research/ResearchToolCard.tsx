import { useMemo, useState } from 'react';
import {
  MetaLibraryRenderer,
  PerplexityRenderer,
  SupplierRenderer,
  WebSearchRenderer,
} from './renderers';
import { ShortlistCard } from './ShortlistCard';
import type { ChatMessage, ShortlistPayload } from './types';

interface ResearchToolCardProps {
  message: ChatMessage;
  onApplyShortlist: (payload: ShortlistPayload) => void;
}

export function ResearchToolCard({ message, onApplyShortlist }: ResearchToolCardProps) {
  const [open, setOpen] = useState(true);
  const isError = message.is_error;
  const name = message.tool_name || 'tool';

  // Stringify on every render is expensive when the chat scroll mounts many
  // tool cards — memoize per message so re-renders of the parent (streaming
  // ticks, cost updates) don't re-stringify potentially large payloads.
  const inputJson = useMemo(
    () => JSON.stringify(message.tool_input ?? {}, null, 2),
    [message.tool_input],
  );
  const outputJson = useMemo(
    () => JSON.stringify(message.tool_output ?? {}, null, 2),
    [message.tool_output],
  );

  // The shortlist card is a special-case: it doesn't get the collapsible
  // shell, it's a prominent CTA.
  if (name === 'shortlist_niche' && message.shortlist) {
    return <ShortlistCard payload={message.shortlist} onApply={onApplyShortlist} />;
  }

  return (
    <div
      className="rounded-xl text-sm overflow-hidden"
      style={{
        border: `1px solid ${isError ? 'var(--ct-border-accent)' : 'var(--ct-border)'}`,
        background: isError ? 'var(--ct-accent-soft)' : 'var(--ct-surface-1)',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-2 flex items-center gap-2 text-left transition-colors"
        style={{ background: 'transparent' }}
      >
        <span
          className="inline-block w-1.5 h-1.5 rounded-full"
          style={{
            background: isError
              ? 'var(--ct-accent-strong)'
              : message.tool_output
              ? 'var(--ct-accent)'
              : 'var(--ct-border-strong)',
          }}
        />
        <code className="font-mono text-xs" style={{ color: 'var(--ct-text-body)' }}>{name}</code>
        <span className="ml-auto text-xs line-clamp-1" style={{ color: 'var(--ct-text-muted)' }}>{message.content}</span>
        <span className="text-xs" style={{ color: 'var(--ct-border-strong)' }}>{open ? '▾' : '▸'}</span>
      </button>

      {open && message.tool_output != null && (
        <div className="px-4 pb-4 pt-1 space-y-3" style={{ borderTop: '1px solid var(--ct-border-soft)' }}>
          {name === 'web_search' && <WebSearchRenderer output={message.tool_output} />}
          {name === 'ask_perplexity' && <PerplexityRenderer output={message.tool_output} />}
          {name === 'meta_ads_library' && <MetaLibraryRenderer output={message.tool_output} />}
          {(name === 'aliexpress_search' || name === 'cj_search') && (
            <SupplierRenderer output={message.tool_output} supplier={name === 'cj_search' ? 'cj' : 'aliexpress'} />
          )}
          <details className="text-xs" style={{ color: 'var(--ct-text-muted)' }}>
            <summary className="cursor-pointer">Détails techniques</summary>
            <div className="mt-2 space-y-2">
              <div>
                <div className="text-kicker uppercase tracking-cta" style={{ color: 'var(--ct-text-muted)' }}>input</div>
                <pre className="mt-1 rounded p-2 overflow-x-auto font-mono text-xs whitespace-pre-wrap break-all max-w-full" style={{ background: 'var(--ct-surface-0)', color: 'var(--ct-text-body)' }}>
                  {inputJson}
                </pre>
              </div>
              <div>
                <div className="text-kicker uppercase tracking-cta" style={{ color: 'var(--ct-text-muted)' }}>output</div>
                <pre className="mt-1 rounded p-2 overflow-x-auto font-mono text-xs whitespace-pre-wrap break-all max-w-full" style={{ background: 'var(--ct-surface-0)', color: 'var(--ct-text-body)' }}>
                  {outputJson}
                </pre>
              </div>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
