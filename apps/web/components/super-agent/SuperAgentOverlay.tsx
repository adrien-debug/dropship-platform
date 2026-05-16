'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface SuperAgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool' | 'system';
  text?: string;
  toolName?: string;
  toolInput?: unknown;
  toolOutput?: unknown;
  isError?: boolean;
  confirmRequired?: boolean;
}

function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

export default function SuperAgentOverlay() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<SuperAgentMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [pendingConfirmations, setPendingConfirmations] = useState<Record<string, boolean>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Hotkey: Ctrl+Shift+K or Cmd+Shift+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && e.shiftKey && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

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
            page: window.location.pathname,
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

            try {
              const event = JSON.parse(json) as {
                type: string;
                text?: string;
                name?: string;
                input?: unknown;
                output?: unknown;
                is_error?: boolean;
                tool?: string;
                reason?: string;
                message?: string;
              };

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
                  {
                    id: generateId(),
                    role: 'tool',
                    toolName: event.name,
                    toolInput: event.input,
                  },
                ]);
              }

              if (event.type === 'tool_result') {
                setMessages((prev) => [
                  ...prev,
                  {
                    id: generateId(),
                    role: 'tool',
                    toolName: event.name,
                    toolOutput: event.output,
                    isError: event.is_error,
                  },
                ]);
              }

              if (event.type === 'confirm_required') {
                setMessages((prev) => [
                  ...prev,
                  {
                    id: generateId(),
                    role: 'system',
                    text: `Confirmation requise : ${event.reason}`,
                    confirmRequired: true,
                  },
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
            } catch {
              // ignore malformed JSON
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
    [pendingConfirmations],
  );

  if (!open) {
    return (
      <div className="fixed bottom-4 right-4 z-[9998]">
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-full shadow-lg hover:scale-105 transition-transform text-sm font-medium"
          title="Super Agent (Ctrl+Shift+K)"
        >
          <span>🤖</span>
          <span className="hidden sm:inline">Super Agent</span>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center pb-4 sm:pb-8 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-3xl mx-2 sm:mx-4 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 bg-gray-900 text-white shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">🤖</span>
            <span className="font-semibold text-sm sm:text-base">Super Agent</span>
            <span className="text-xs text-gray-400 ml-2 hidden sm:inline">Ctrl+Shift+K</span>
          </div>
          <div className="flex items-center gap-2">
            {streaming && (
              <span className="text-xs text-gray-400 animate-pulse">Réflexion...</span>
            )}
            <button
              onClick={() => {
                abortRef.current?.abort();
                setStreaming(false);
                setOpen(false);
              }}
              className="text-gray-400 hover:text-white transition-colors text-xl leading-none"
            >
              ×
            </button>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 min-h-0">
          {messages.length === 0 && (
            <div className="text-center text-gray-400 py-8">
              <p className="text-lg mb-1">👋 Je suis le Super Agent</p>
              <p className="text-sm">Je peux coder, modifier la base de données, générer des assets et déployer.</p>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] sm:max-w-[75%] px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : msg.role === 'system'
                      ? 'bg-amber-50 text-amber-800 border border-amber-200'
                      : msg.role === 'tool'
                        ? 'bg-gray-100 text-gray-700 font-mono text-xs'
                        : 'bg-gray-50 text-gray-800 border border-gray-200'
                }`}
              >
                {msg.role === 'tool' && msg.toolName && (
                  <div className="text-xs font-semibold text-gray-500 mb-1">
                    🔧 {msg.toolName}
                  </div>
                )}
                {msg.text && <div className="whitespace-pre-wrap">{msg.text}</div>}
                {!!msg.toolInput && (
                  <pre className="mt-1 text-[10px] bg-white/60 rounded p-1 overflow-x-auto">
                    {String(JSON.stringify(msg.toolInput as Record<string, unknown>, null, 2))}
                  </pre>
                )}
                {!!msg.toolOutput && (
                  <pre
                    className={`mt-1 text-[10px] rounded p-1 overflow-x-auto ${
                      msg.isError ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
                    }`}
                  >
                    {String(JSON.stringify(msg.toolOutput as Record<string, unknown>, null, 2))}
                  </pre>
                )}
                {msg.confirmRequired && (
                  <button
                    onClick={() => {
                      const newConfirm = { ...pendingConfirmations, ['*']: true };
                      setPendingConfirmations(newConfirm);
                      // Re-send last user message with confirmations
                      const lastUser = messages.filter((m) => m.role === 'user').pop();
                      if (lastUser?.text) {
                        sendMessage(`Confirme : ${lastUser.text}`, newConfirm);
                      }
                    }}
                    className="mt-2 px-3 py-1 bg-amber-500 text-white rounded text-xs font-medium hover:bg-amber-600 transition-colors"
                  >
                    ✅ Confirmer l&apos;action
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="p-3 sm:p-4 border-t border-gray-100 shrink-0">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(input);
                }
              }}
              placeholder="Dis-moi quoi faire..."
              disabled={streaming}
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={streaming || !input.trim()}
              className="px-4 py-2.5 bg-black text-white rounded-xl text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {streaming ? '...' : 'Envoyer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
