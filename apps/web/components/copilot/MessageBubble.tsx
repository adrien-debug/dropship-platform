'use client';

import { cn } from '@/lib/utils/cn';

interface MessageBubbleProps {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  streaming?: boolean;
}

/**
 * MessageBubble — chat message with role-appropriate styling.
 *
 * User: right-aligned, cyan accent, rounded-tr-sm
 * Assistant: left-aligned, surface bg, rounded-tl-sm
 * Tool: left-aligned, distinct border
 */
export function MessageBubble({ role, content, streaming }: MessageBubbleProps) {
  if (role === 'user') {
    return (
      <div className="flex justify-end">
        <div
          className={cn(
            'max-w-[80%] px-4 py-2.5 text-sm whitespace-pre-wrap',
            'bg-[var(--accent-cyan)]/15 text-ds-text-primary',
            'rounded-2xl rounded-tr-sm',
            'border border-[var(--accent-cyan)]/20',
          )}
        >
          {content}
        </div>
      </div>
    );
  }

  if (role === 'tool') {
    return (
      <div className="flex justify-start">
        <div
          className={cn(
            'max-w-[85%] px-4 py-2.5 text-sm',
            'bg-ds-surface-subtle text-ds-text-secondary',
            'rounded-2xl rounded-tl-sm',
            'border border-ds-border-subtle',
          )}
        >
          <span className="text-[10px] uppercase tracking-wider text-ds-text-muted font-medium">
            Outil
          </span>
          <pre className="mt-1 text-xs font-mono text-ds-text-secondary whitespace-pre-wrap">
            {content}
          </pre>
        </div>
      </div>
    );
  }

  // Assistant
  return (
    <div className="flex justify-start">
      <div
        className={cn(
          'max-w-[80%] px-4 py-2.5 text-sm whitespace-pre-wrap',
          'bg-ds-surface-default text-ds-text-primary',
          'rounded-2xl rounded-tl-sm',
          'border border-ds-border-subtle',
        )}
      >
        {content || (streaming ? <TypingIndicator /> : <span className="text-ds-text-muted">…</span>)}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="w-1.5 h-1.5 bg-ds-text-muted rounded-full animate-pulse" />
      <span className="w-1.5 h-1.5 bg-ds-text-muted rounded-full animate-pulse" style={{ animationDelay: '120ms' }} />
      <span className="w-1.5 h-1.5 bg-ds-text-muted rounded-full animate-pulse" style={{ animationDelay: '240ms' }} />
    </span>
  );
}
