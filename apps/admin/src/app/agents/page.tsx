'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const PRESETS = [
  { label: 'Rechercher des produits', prompt: 'Recherche des produits tendance dans la catégorie "sacs" avec CJ et Medusa' },
  { label: 'Créer un shop', prompt: 'Crée un nouveau shop e-commerce de montres de luxe avec le design system swiss sur le port 3101' },
  { label: 'Status services', prompt: 'Donne-moi le statut de tous les services (GPU, Medusa, OpenClaw, Supabase)' },
  { label: 'Plan marketing', prompt: 'Propose un plan marketing pour lancer un site de vêtements streetwear' },
];

export default function AgentsPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState<'fast' | 'main'>('fast');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = { role: 'user', content: text.trim() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/agents/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updated.map(m => ({ role: m.role, content: m.content })),
          model,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        setMessages(prev => [...prev, { role: 'assistant', content: `Erreur: ${err.error || err.message || res.statusText}` }]);
        return;
      }

      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content ?? 'Pas de réponse';
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Erreur réseau: ${err instanceof Error ? err.message : 'unknown'}` }]);
    } finally {
      setLoading(false);
    }
  }, [messages, loading, model]);

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h2 className="text-2xl font-bold">Agent IA</h2>
          <p className="text-sm text-gray-500">Créer des shops, rechercher des produits, lancer des campagnes</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={model}
            onChange={e => setModel(e.target.value as 'fast' | 'main')}
            className="rounded-lg border px-3 py-1.5 text-sm"
          >
            <option value="fast">Qwen 7B (rapide)</option>
            <option value="main">Qwen 32B (puissant)</option>
          </select>
          <button
            onClick={() => setMessages([])}
            className="rounded-lg border px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            Effacer
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-6">
            <div className="text-center">
              <div className="text-4xl">🤖</div>
              <h3 className="mt-2 text-lg font-semibold">Agent Dropship</h3>
              <p className="text-sm text-gray-500">Que veux-tu faire ?</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {PRESETS.map(p => (
                <button
                  key={p.label}
                  onClick={() => send(p.prompt)}
                  className="rounded-xl border bg-white px-4 py-3 text-left text-sm shadow-sm transition hover:bg-gray-50 hover:shadow"
                >
                  <span className="font-medium">{p.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm ${
                  m.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border shadow-sm text-gray-800'
                }`}>
                  <pre className="whitespace-pre-wrap font-sans">{m.content}</pre>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl border bg-white px-4 py-3 shadow-sm">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '0ms' }} />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '150ms' }} />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>
        )}
      </div>

      <form
        onSubmit={e => { e.preventDefault(); send(input); }}
        className="flex gap-3 border-t pt-4"
      >
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Tape ton message..."
          className="flex-1 rounded-xl border bg-white px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          Envoyer
        </button>
      </form>
    </div>
  );
}
