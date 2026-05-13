'use client';

import { cn } from '@/lib/utils/cn';

interface Session {
  id: string;
  title: string | null;
  mode: string;
  updated_at: string;
  message_count: number;
}

interface SessionSelectorProps {
  sessions: Session[];
  activeSessionId: string | null;
  onSessionChange: (sessionId: string | null) => void;
  onNewSession: () => void;
}

/**
 * SessionSelector — dropdown + new session button.
 */
export function SessionSelector({
  sessions,
  activeSessionId,
  onSessionChange,
  onNewSession,
}: SessionSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <select
        value={activeSessionId ?? ''}
        onChange={(e) => onSessionChange(e.target.value || null)}
        className={cn(
          'text-xs rounded-lg px-2 py-1 max-w-[180px]',
          'bg-ds-bg-input border border-ds-border-subtle text-ds-text-secondary',
          'focus:outline-none focus:border-[var(--border-accent)]',
          'transition-colors',
        )}
      >
        {sessions.length === 0 && <option value="">Aucune session</option>}
        {sessions.map((s) => (
          <option key={s.id} value={s.id}>
            {s.title || new Date(s.updated_at).toLocaleDateString('fr-FR')} · {s.message_count} msg
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={onNewSession}
        className={cn(
          'text-[11px] px-2 py-1 rounded-lg',
          'bg-ds-surface-subtle text-ds-text-muted border border-ds-border-subtle',
          'hover:text-ds-text-primary hover:border-ds-border-default',
          'transition-colors',
        )}
      >
        + Nouvelle
      </button>
    </div>
  );
}
