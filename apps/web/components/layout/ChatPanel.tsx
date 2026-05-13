'use client';

import { type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';
import { useNavigation } from './NavigationContext';
import { LegacyContentWrapper } from './LegacyContentWrapper';
import { StoreCopilot } from './StoreCopilot';

interface ChatPanelProps {
  children: ReactNode;
}

/**
 * ChatPanel — central stable area.
 *
 * NEVER unmounts during navigation.
 *
 * Behavior:
 *   - When a store is active (store-copilot): shows the persistent copilot
 *     interface with mode pills, session selector, and chat feed.
 *   - Otherwise: shows legacy page content (children) with dark theme adaptation.
 *
 * The chat composer is always visible at the bottom when a chat surface is active.
 */
export function ChatPanel({ children }: ChatPanelProps) {
  const { chatSurface } = useNavigation();
  const hasChat = chatSurface.type !== 'none';

  return (
    <section className="flex flex-col flex-1 min-w-0 h-full bg-ds-bg-base">
      {/* Chat Header — always shows context, hidden on mobile when no chat */}
      <div className={hasChat ? 'block' : 'hidden lg:block'}>
        <ChatHeader chatSurface={chatSurface} />
      </div>

      {/* Main content area */}
      <div className="flex-1 min-h-0 overflow-hidden relative">
        <div key={chatSurface.type + (chatSurface.type === 'store-copilot' ? (chatSurface as { storeId?: string }).storeId ?? '' : '')} className="h-full panel-content-enter">
          {hasChat ? (
            <ChatSurface chatSurface={chatSurface} />
          ) : (
            <LegacyContentWrapper>{children}</LegacyContentWrapper>
          )}
        </div>
      </div>

      {/* Chat Composer — shown when chat is active */}
      {hasChat && <ChatComposer chatSurface={chatSurface} />}
    </section>
  );
}

// ── Sub-components ──

function ChatHeader({ chatSurface }: { chatSurface: { type: string } }) {
  const title =
    chatSurface.type === 'store-copilot'
      ? 'Copilote Store'
      : chatSurface.type === 'research-copilot'
        ? 'Recherche de Niche'
        : 'Agent IA';

  const subtitle =
    chatSurface.type === 'store-copilot'
      ? (chatSurface as { storeName?: string }).storeName ?? 'Store'
      : chatSurface.type === 'research-copilot'
        ? 'Pré-création'
        : 'En ligne';

  return (
    <div
      className={cn(
        'shrink-0 h-[48px] flex items-center justify-between px-5',
        'border-b border-ds-border-subtle',
        'bg-ds-bg-elevated/80 backdrop-blur-sm',
      )}
    >
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            'w-2 h-2 rounded-full',
            chatSurface.type !== 'none' ? 'bg-[var(--success)]' : 'bg-ds-text-muted',
          )}
          style={
            chatSurface.type !== 'none'
              ? { boxShadow: '0 0 8px rgba(34, 197, 94, 0.6)' }
              : undefined
          }
          aria-hidden
        />
        <span className="text-sm font-medium text-ds-text-primary">{title}</span>
        {chatSurface.type !== 'none' && (
          <span className="text-[11px] text-ds-text-muted">{subtitle}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'text-[11px] px-2 py-0.5 rounded-full border',
            chatSurface.type !== 'none'
              ? 'text-ds-text-muted bg-ds-surface-subtle border-ds-border-subtle'
              : 'text-ds-text-disabled bg-ds-surface-subtle/50 border-ds-border-subtle/50',
          )}
        >
          Claude 3.5
        </span>
      </div>
    </div>
  );
}

function ChatSurface({ chatSurface }: { chatSurface: { type: string; storeId?: string; storeSlug?: string; storeName?: string } }) {
  if (chatSurface.type === 'store-copilot' && chatSurface.storeId) {
    return (
      <StoreCopilot
        storeId={chatSurface.storeId}
        storeSlug={chatSurface.storeSlug ?? ''}
        storeName={chatSurface.storeName ?? 'Store'}
      />
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-3xl mx-auto">
          {chatSurface.type === 'research-copilot' && <ResearchCopilotPlaceholder />}
        </div>
      </div>
    </div>
  );
}


function ResearchCopilotPlaceholder() {
  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="w-7 h-7 rounded-full bg-[var(--accent-cyan)]/20 flex items-center justify-center shrink-0">
          <span className="text-[var(--accent-cyan)] text-xs font-bold">AI</span>
        </div>
        <div className="space-y-1">
          <p className="text-sm text-ds-text-primary">
            Je vais t&apos;aider à trouver la niche parfaite pour ton prochain store.
          </p>
          <p className="text-xs text-ds-text-muted">
            Décris-moi un marché qui t&apos;intéresse, ou laisse-moi explorer les tendances.
          </p>
        </div>
      </div>
    </div>
  );
}

function ChatComposer({ chatSurface }: { chatSurface: { type: string } }) {
  const placeholder =
    chatSurface.type === 'store-copilot'
      ? 'Poser une question sur ce store...'
      : chatSurface.type === 'research-copilot'
        ? 'Décrire une niche ou un marché...'
        : "Envoyer un message à l'agent...";

  return (
    <div
      className={cn(
        'shrink-0 p-3',
        'border-t border-ds-border-subtle',
        'bg-ds-bg-elevated/80 backdrop-blur-sm',
      )}
    >
      <div
        className={cn(
          'flex items-center gap-2 px-4 py-2.5 rounded-[14px]',
          'bg-ds-bg-input',
          'border border-ds-border-subtle',
          'focus-within:border-[var(--border-accent)] focus-within:shadow-glow',
          'transition-all duration-200',
        )}
      >
        <input
          type="text"
          placeholder={placeholder}
          className={cn(
            'flex-1 bg-transparent text-sm text-ds-text-primary placeholder:text-ds-text-muted',
            'outline-none',
          )}
        />
        <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] text-ds-text-muted bg-ds-surface-subtle border border-ds-border-subtle">
          ⌘ K
        </kbd>
      </div>
    </div>
  );
}
