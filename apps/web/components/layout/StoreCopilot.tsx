'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/client-fetch';
import { cn } from '@/lib/utils/cn';
import type { CopilotMode } from '@/lib/agent/copilot-router';
import { MessageBubble, ModeSelector, SessionSelector, ChatComposer, ToolCard } from '@/components/copilot';

interface SessionSummary {
  id: string;
  mode: CopilotMode;
  title: string | null;
  created_at: string;
  updated_at: string;
  preview: string | null;
  preview_role: 'user' | 'assistant' | null;
  message_count: number;
}

interface ProductRow {
  id: string;
  enriched_title: string;
  price_cents: number;
  image_url: string | null;
}

interface StoreCopilotData {
  storeId: string;
  storeSlug: string;
  storeName: string;
  storeNiche: string;
  logoEmoji: string;
  primaryColor: string;
  status: string;
  mode: string | null;
  sessions: SessionSummary[];
  products: ProductRow[];
}

interface Props {
  storeId: string;
  storeSlug: string;
  storeName: string;
}

/**
 * StoreCopilot — loads copilot data for a store and renders the CopilotHub.
 *
 * This is the bridge between the persistent ChatPanel and the existing
 * CopilotHub component. It fetches sessions and products client-side
 * so the chat can persist across navigation without server-reloading.
 */
export function StoreCopilot({ storeId, storeSlug: _storeSlug, storeName: _storeName }: Props) {
  const [data, setData] = useState<StoreCopilotData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch(`/api/agent/stores/${storeId}/copilot/bootstrap`, {
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as StoreCopilotData;
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erreur de chargement');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [storeId]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-ds-border-subtle border-t-[var(--accent-cyan)] rounded-full animate-spin" />
          <span className="text-sm text-ds-text-muted">Chargement du copilote…</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-sm text-[var(--danger)]">{error ?? 'Données indisponibles'}</p>
          <button
            onClick={() => window.location.reload()}
            className={cn(
              'text-xs px-3 py-1.5 rounded-lg',
              'bg-ds-surface-subtle text-ds-text-secondary border border-ds-border-subtle',
              'hover:border-ds-border-default hover:text-ds-text-primary',
              'transition-colors',
            )}
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <CopilotShell
      storeId={data.storeId}
      storeSlug={data.storeSlug}
      storeName={data.storeName}
      sessions={data.sessions}
      products={data.products}
    />
  );
}

/**
 * CopilotShell — simplified chat interface for the persistent panel.
 *
 * This is a streamlined version of CopilotHub adapted for the 3-panel layout.
 * It removes the outer chrome (header, breadcrumb) since those are now
 * handled by the AppShell.
 */
function CopilotShell({
  storeId,
  storeSlug: _storeSlug,
  storeName: _storeName,
  sessions,
  products: _products,
}: {
  storeId: string;
  storeSlug: string;
  storeName: string;
  sessions: SessionSummary[];
  products: ProductRow[];
}) {
  const [mode, setMode] = useState<CopilotMode>('curation');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Array<{
    id: string;
    role: 'user' | 'assistant' | 'tool';
    content: string;
    tool_name?: string | null;
    tool_input?: unknown;
    tool_output?: unknown;
    is_error?: boolean;
  }>>([]);
  const [streaming, setStreaming] = useState(false);

  // Filter sessions by mode
  const modeSessions = sessions.filter((s) => s.mode === mode);

  // Load messages when session changes
  useEffect(() => {
    if (!sessionId) {
      setMessages([]);
      return;
    }
    async function load() {
      try {
        const res = await apiFetch(`/api/agent/stores/${storeId}/copilot/sessions/${sessionId}`, {
          cache: 'no-store',
        });
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages ?? []);
        }
      } catch { /* ignore */ }
    }
    load();
  }, [sessionId, storeId]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || streaming) return;
    setStreaming(true);
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: 'user', content: text }]);

    try {
      const res = await apiFetch(`/api/agent/stores/${storeId}/copilot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sessionId ?? undefined, mode, message: text }),
      });
      if (!res.ok || !res.body) throw new Error('Stream error');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let assistantContent = '';
      const assistantId = `a-${Date.now()}`;

      setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n\n');
        buf = lines.pop() ?? '';

        for (const block of lines) {
          const data = block.replace(/^data: /, '').trim();
          if (!data) continue;
          try {
            const parsed = JSON.parse(data) as { type: string; data: unknown };
            if (parsed.type === 'session') {
              const sid = (parsed.data as { sessionId: string }).sessionId;
              setSessionId(sid);
            } else if (parsed.type === 'message' || parsed.type === 'thinking') {
              const t = (parsed.data as { text: string }).text || '';
              assistantContent += t;
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, content: assistantContent } : m))
              );
            } else if (parsed.type === 'tool_call') {
              const d = parsed.data as { id: string; name: string; input: unknown };
              setMessages((prev) => [
                ...prev,
                {
                  id: `tool-${d.id}`,
                  role: 'tool',
                  content: d.name,
                  tool_name: d.name,
                  tool_input: d.input,
                  tool_output: null,
                },
              ]);
            } else if (parsed.type === 'tool_result') {
              const d = parsed.data as { id: string; name: string; output: unknown; is_error?: boolean };
              setMessages((prev) =>
                prev.map((m) =>
                  m.tool_name === d.name && m.tool_output === null
                    ? { ...m, tool_output: d.output, is_error: d.is_error }
                    : m
                )
              );
            } else if (parsed.type === 'done') {
              const t = (parsed.data as { text: string }).text || '';
              assistantContent += t;
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, content: assistantContent } : m))
              );
            }
          } catch { /* ignore parse errors */ }
        }
      }
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { id: `err-${Date.now()}`, role: 'assistant', content: e instanceof Error ? e.message : 'Erreur' },
      ]);
    } finally {
      setStreaming(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Mode selector + session */}
      <div className="shrink-0 px-4 py-3 border-b border-ds-border-subtle">
        <div className="flex items-center gap-2">
          <ModeSelector activeMode={mode} onModeChange={setMode} />
          <div className="flex-1" />
          <SessionSelector
            sessions={modeSessions}
            activeSessionId={sessionId}
            onSessionChange={setSessionId}
            onNewSession={() => setSessionId(null)}
          />
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && !streaming && (
          <div className="text-center py-12">
            <p className="text-sm text-ds-text-muted">
              Mode <span className="text-ds-text-secondary font-medium">{mode}</span> actif.
            </p>
            <p className="text-xs text-ds-text-muted mt-1">
              Pose une question ou choisis une action suggérée.
            </p>
          </div>
        )}

        {messages.map((m) => {
          if (m.role === 'tool' && m.tool_name) {
            return (
              <ToolCard
                key={m.id}
                name={m.tool_name}
                input={m.tool_input}
                output={m.tool_output}
                isError={m.is_error}
                content={m.content}
              />
            );
          }
          return (
            <MessageBubble
              key={m.id}
              role={m.role}
              content={m.content}
              streaming={streaming && m.role === 'assistant' && !m.content}
            />
          );
        })}

        {streaming && messages[messages.length - 1]?.role === 'user' && (
          <MessageBubble role="assistant" content="" streaming />
        )}
      </div>

      {/* Composer */}
      <ChatComposer
        placeholder={`Demande quelque chose en mode ${mode}… (Cmd+Enter)`}
        disabled={streaming}
        onSend={sendMessage}
      />
    </div>
  );
}
