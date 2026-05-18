'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// ─────────────────────────────────────────────────────────────
// Shared types
// ─────────────────────────────────────────────────────────────

export interface SuperAgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool' | 'system';
  text?: string;
  toolName?: string;
  toolInput?: unknown;
  toolOutput?: unknown;
  isError?: boolean;
  confirmRequired?: boolean;
  /** Backend-emitted key the UI must echo back to clear the gate. */
  confirmKey?: string;
  /** Tool that triggered the confirm, shown on the button label. */
  confirmTool?: string;
}

export interface SessionListItem {
  id: string;
  store_id: string | null;
  store_name: string | null;
  title: string | null;
  created_at: string;
  updated_at: string;
  message_count: number;
  preview: string | null;
  preview_role: 'user' | 'assistant' | 'tool' | null;
}

// ─────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────

const SESSION_STORAGE_KEY = 'super-agent:session-id';

export function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

export function dbMessageToUI(row: {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  tool_name: string | null;
  tool_input: unknown;
  tool_output: unknown;
}): SuperAgentMessage {
  if (row.role === 'tool') {
    return {
      id: row.id,
      role: 'tool',
      toolName: row.tool_name ?? 'tool',
      toolInput: row.tool_input,
      toolOutput: row.tool_output,
      isError: !!(
        row.tool_output &&
        typeof row.tool_output === 'object' &&
        'error' in (row.tool_output as Record<string, unknown>)
      ),
    };
  }
  return { id: row.id, role: row.role, text: row.content };
}

export function safeParseSseEvent(raw: string): unknown | null {
  try {
    return JSON.parse(raw);
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[super-agent] SSE parse error', err, raw.slice(0, 200));
    }
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// useSuperAgentChat — all chat state & logic in one hook.
// Consumed by SuperAgentOverlay (floating) and SuperAgentPanel (rail).
// ─────────────────────────────────────────────────────────────

export interface UseSuperAgentChatOptions {
  /**
   * If true, attempt to restore the last session from localStorage on mount.
   * The overlay defers this until it is first opened; the rail does it immediately.
   */
  hydrateOnMount?: boolean;
}

export function useSuperAgentChat({ hydrateOnMount = true }: UseSuperAgentChatOptions = {}) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<SuperAgentMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [pendingConfirmations, setPendingConfirmations] = useState<Record<string, boolean>>({});
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState<SessionListItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [hydrating, setHydrating] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const hydrateFromSession = useCallback(async (id: string) => {
    setHydrating(true);
    try {
      const res = await fetch(`/api/agent/super/sessions/${id}`);
      if (res.status === 404) {
        localStorage.removeItem(SESSION_STORAGE_KEY);
        setSessionId(null);
        setMessages([]);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        messages: Array<{
          id: string;
          role: 'user' | 'assistant' | 'tool';
          content: string;
          tool_name: string | null;
          tool_input: unknown;
          tool_output: unknown;
        }>;
      };
      setMessages(data.messages.map(dbMessageToUI));
    } catch (err) {
      console.warn('[super-agent] hydrate session failed', err);
    } finally {
      setHydrating(false);
    }
  }, []);

  /** Attempt restore once. Called on mount or on first open (overlay). */
  const tryHydrate = useCallback(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    const stored = localStorage.getItem(SESSION_STORAGE_KEY);
    if (stored) {
      setSessionId(stored);
      hydrateFromSession(stored);
    }
  }, [hydrateFromSession]);

  // Auto-hydrate when hydrateOnMount = true (rail mode)
  useEffect(() => {
    if (hydrateOnMount) {
      tryHydrate();
    }
  }, [hydrateOnMount, tryHydrate]);

  const startNewSession = useCallback(() => {
    abortRef.current?.abort();
    localStorage.removeItem(SESSION_STORAGE_KEY);
    setSessionId(null);
    setMessages([]);
    setPendingConfirmations({});
    setInput('');
    setStreaming(false);
    setHistoryOpen(false);
  }, []);

  const openHistory = useCallback(async () => {
    const next = !historyOpen;
    setHistoryOpen(next);
    if (!next) return;
    setHistoryLoading(true);
    try {
      const res = await fetch('/api/agent/super/sessions?limit=30');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { sessions: SessionListItem[] };
      setHistoryItems(data.sessions);
    } catch (err) {
      console.warn('[super-agent] history load failed', err);
      setHistoryItems([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [historyOpen]);

  const resumeSession = useCallback(
    async (id: string) => {
      abortRef.current?.abort();
      setHistoryOpen(false);
      setPendingConfirmations({});
      localStorage.setItem(SESSION_STORAGE_KEY, id);
      setSessionId(id);
      setMessages([]);
      setStreaming(false);
      await hydrateFromSession(id);
    },
    [hydrateFromSession],
  );

  const deleteSession = useCallback(
    async (id: string) => {
      try {
        await fetch(`/api/agent/super/sessions/${id}`, { method: 'DELETE' });
      } catch { /* ignore */ }
      setHistoryItems((prev) => prev.filter((s) => s.id !== id));
      if (sessionId === id) startNewSession();
    },
    [sessionId, startNewSession],
  );

  const sendMessage = useCallback(
    async (text: string, confirmations?: Record<string, boolean>) => {
      if (!text.trim()) return;

      setMessages((prev) => [...prev, { id: generateId(), role: 'user', text: text.trim() }]);
      setInput('');
      setStreaming(true);

      const assistantId = generateId();
      setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', text: '' }]);

      abortRef.current = new AbortController();

      try {
        const res = await fetch('/api/agent/super', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text.trim(),
            page: typeof window !== 'undefined' ? window.location.pathname : '',
            sessionId: sessionId ?? undefined,
            confirmations: confirmations ?? pendingConfirmations,
          }),
          signal: abortRef.current.signal,
        });

        const reader = res.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const json = line.slice(6).trim();
            if (!json) continue;

            const parsed = safeParseSseEvent(json);
            if (!parsed) continue;
            const event = parsed as {
              type: string;
              text?: string;
              name?: string;
              input?: unknown;
              output?: unknown;
              is_error?: boolean;
              tool?: string;
              reason?: string;
              message?: string;
              confirmKey?: string;
              sessionId?: string;
            };

            if (event.type === 'session' && event.sessionId) {
              setSessionId(event.sessionId);
              try { localStorage.setItem(SESSION_STORAGE_KEY, event.sessionId); } catch { /* ignore */ }
            }
            if (event.type === 'thinking' && event.text) {
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last && last.role === 'assistant' && last.id === assistantId) {
                  return [...prev.slice(0, -1), { ...last, text: (last.text ?? '') + event.text! }];
                }
                return prev;
              });
            }
            if (event.type === 'tool_call') {
              setMessages((prev) => [
                ...prev,
                { id: generateId(), role: 'tool', toolName: event.name, toolInput: event.input },
              ]);
            }
            if (event.type === 'tool_result') {
              setMessages((prev) => [
                ...prev,
                { id: generateId(), role: 'tool', toolName: event.name, toolOutput: event.output, isError: event.is_error },
              ]);
            }
            if (event.type === 'confirm_required') {
              setMessages((prev) => [
                ...prev,
                { id: generateId(), role: 'system', text: `Confirmation requise : ${event.reason}`, confirmRequired: true, confirmKey: event.confirmKey, confirmTool: event.tool },
              ]);
            }
            if (event.type === 'error') {
              setMessages((prev) => [
                ...prev,
                { id: generateId(), role: 'system', text: `Erreur : ${event.message}` },
              ]);
            }
            if (event.type === 'done') {
              setStreaming(false);
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          setMessages((prev) => [
            ...prev,
            { id: generateId(), role: 'system', text: `Erreur réseau : ${err.message}` },
          ]);
        }
        setStreaming(false);
      }
    },
    [pendingConfirmations, sessionId],
  );

  const handleConfirm = useCallback(
    (msg: SuperAgentMessage) => {
      const key = msg.confirmKey ?? '*';
      const newConfirm = { ...pendingConfirmations, [key]: true };
      setPendingConfirmations(newConfirm);
      const lastUser = messages.filter((m) => m.role === 'user').pop();
      if (lastUser?.text) {
        sendMessage(lastUser.text, newConfirm);
      }
    },
    [messages, pendingConfirmations, sendMessage],
  );

  return {
    // State
    input, setInput,
    messages,
    streaming,
    sessionId,
    historyOpen,
    historyItems,
    historyLoading,
    hydrating,
    // Refs
    scrollRef,
    abortRef,
    // Actions
    tryHydrate,
    startNewSession,
    openHistory,
    resumeSession,
    deleteSession,
    sendMessage,
    handleConfirm,
  };
}
