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
      className={`rounded-xl border bg-white text-sm overflow-hidden ${
        isError ? 'border-red-200 bg-red-50/20' : 'border-zinc-200'
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-2 flex items-center gap-2 text-left hover:bg-zinc-50 transition-colors"
      >
        <span
          className={`inline-block w-1.5 h-1.5 rounded-full ${
            isError
              ? 'bg-zinc-100'
              : message.tool_output
              ? 'bg-blue-100'
              : 'bg-blue-50'
          }`}
        />
        <code className="font-mono text-xs text-zinc-700">{name}</code>
        <span className="ml-auto text-xs text-zinc-500 line-clamp-1">{message.content}</span>
        <span className="text-xs text-zinc-300">{open ? '▾' : '▸'}</span>
      </button>

      {open && message.tool_output != null && (
        <div className="px-4 pb-4 pt-1 border-t border-zinc-100 space-y-3">
          {name === 'web_search' && <WebSearchRenderer output={message.tool_output} />}
          {name === 'ask_perplexity' && <PerplexityRenderer output={message.tool_output} />}
          {name === 'meta_ads_library' && <MetaLibraryRenderer output={message.tool_output} />}
          {(name === 'aliexpress_search' || name === 'cj_search') && (
            <SupplierRenderer output={message.tool_output} supplier={name === 'cj_search' ? 'cj' : 'aliexpress'} />
          )}
          <details className="text-xs text-zinc-500">
            <summary className="cursor-pointer hover:text-zinc-700">Détails techniques</summary>
            <div className="mt-2 space-y-2">
              <div>
                <div className="text-kicker uppercase tracking-cta text-zinc-400">input</div>
                <pre className="mt-1 bg-zinc-50 rounded p-2 overflow-x-auto font-mono text-xs whitespace-pre-wrap break-all max-w-full">
                  {inputJson}
                </pre>
              </div>
              <div>
                <div className="text-kicker uppercase tracking-cta text-zinc-400">output</div>
                <pre className="mt-1 bg-zinc-50 rounded p-2 overflow-x-auto font-mono text-xs whitespace-pre-wrap break-all max-w-full">
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
