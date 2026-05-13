'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils/cn';

interface ChatComposerProps {
  placeholder?: string;
  disabled?: boolean;
  onSend: (message: string) => void;
}

/**
 * ChatComposer — input + send button for the copilot.
 */
export function ChatComposer({ placeholder, disabled, onSend }: ChatComposerProps) {
  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || disabled) return;
    onSend(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (input.trim() && !disabled) {
        onSend(input.trim());
        setInput('');
      }
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        'shrink-0 px-4 py-3',
        'border-t border-ds-border-subtle',
        'bg-ds-bg-elevated/80 backdrop-blur-sm',
      )}
    >
      <div className="flex gap-2 items-end">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? "Envoyer un message…"}
          rows={1}
          disabled={disabled}
          className={cn(
            'flex-1 resize-none text-sm px-3 py-2 rounded-lg',
            'bg-ds-bg-input text-ds-text-primary placeholder:text-ds-text-muted',
            'border border-ds-border-subtle',
            'focus:outline-none focus:border-[var(--border-accent)] focus:shadow-glow',
            'disabled:opacity-50',
            'transition-all duration-200',
          )}
        />
        <button
          type="submit"
          disabled={disabled || !input.trim()}
          className={cn(
            'text-sm px-4 py-2 rounded-lg shrink-0',
            'bg-[var(--accent-cyan)] text-ds-bg-base font-medium',
            'hover:bg-[var(--accent-blue)]',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            'transition-colors duration-200',
          )}
        >
          {disabled ? '…' : 'Envoyer'}
        </button>
      </div>
    </form>
  );
}
