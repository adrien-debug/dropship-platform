'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface PipelineEvent {
  step: string;
  status: 'running' | 'done' | 'error' | 'skipped';
  detail?: unknown;
  progress?: number;
  timestamp: number;
}

const OPENCLAW_URL = process.env.NEXT_PUBLIC_OPENCLAW_URL || 'http://100.110.74.114:3849';

const PRESETS = [
  { label: 'Search products', prompt: 'Search trending products in the "bags" category from CJ and Medusa' },
  { label: 'Create a shop', prompt: 'Create a new luxury watches e-commerce shop with the swiss design system on port 3101' },
  { label: 'Service status', prompt: 'Give me the status of all services (GPU, Medusa, OpenClaw, Supabase)' },
  { label: 'Marketing plan', prompt: 'Propose a marketing plan to launch a streetwear clothing site' },
];

const STEP_LABELS: Record<string, string> = {
  pipeline_start: 'Starting',
  search_products: 'Searching products',
  enrich_products: 'AI enrichment',
  generate_content: 'Site content',
  create_shop: 'Creating shop',
  check_health: 'Health check',
  seo_audit: 'SEO audit',
  marketing_plans: 'Marketing plans',
  tool_search_products: 'Searching products',
  tool_enrich_products: 'AI enrichment',
  tool_generate_site_content: 'Site content',
  tool_create_shop: 'Creating shop',
  tool_check_health: 'Health check',
  tool_create_google_ads_campaign: 'Google Ads',
  tool_create_meta_ads_campaign: 'Meta Ads',
  tool_run_seo_audit: 'SEO audit',
  pipeline_complete: 'Complete',
};

function getStepLabel(step: string): string {
  return STEP_LABELS[step] ?? step.replace(/^(tool_|iteration_)/, '').replace(/_/g, ' ');
}

// ============ Pipeline A-Z Component ============

function PipelinePanel() {
  const [keywords, setKeywords] = useState(['', '']);
  const [market, setMarket] = useState<'FR' | 'EU' | 'US'>('US');
  const [positioning, setPositioning] = useState<'budget' | 'mid' | 'premium'>('mid');
  const [running, setRunning] = useState(false);
  const [events, setEvents] = useState<PipelineEvent[]>([]);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const eventsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  const launch = useCallback(async () => {
    const kws = keywords.filter(k => k.trim());
    if (kws.length === 0 || running) return;

    setRunning(true);
    setEvents([]);
    setResult(null);

    try {
      const res = await fetch(`${OPENCLAW_URL}/agent/pipeline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: kws, market, positioning }),
      });

      if (!res.ok || !res.body) {
        setEvents(prev => [...prev, { step: 'error', status: 'error', detail: `HTTP ${res.status}`, timestamp: Date.now() }]);
        setRunning(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            try {
              const event: PipelineEvent = JSON.parse(data);
              if (event.step === 'result') {
                setResult(event.detail as Record<string, unknown>);
              } else {
                setEvents(prev => [...prev, event]);
              }
            } catch { /* skip malformed */ }
          }
        }
      }
    } catch (err) {
      setEvents(prev => [...prev, {
        step: 'fatal', status: 'error',
        detail: err instanceof Error ? err.message : 'Connection failed',
        timestamp: Date.now(),
      }]);
    } finally {
      setRunning(false);
    }
  }, [keywords, market, positioning, running]);

  const latestProgress = [...events].reverse().find((e: PipelineEvent) => e.progress != null)?.progress ?? 0;
  const shopResult = (result as Record<string, unknown>)?.shop as Record<string, unknown> | undefined;

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold">Pipeline A-Z</h3>
        <p className="mb-4 text-sm text-gray-500">2 keywords = 1 live site with products, AI content, Stripe checkout and marketing plan</p>

        <div className="mb-4 grid grid-cols-2 gap-3">
          {keywords.map((kw, i) => (
            <input
              key={i}
              type="text"
              value={kw}
              onChange={e => setKeywords(prev => prev.map((v, j) => j === i ? e.target.value : v))}
              placeholder={`Keyword ${i + 1}`}
              className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={running}
            />
          ))}
        </div>

        <div className="mb-4 flex gap-3">
          <select value={market} onChange={e => setMarket(e.target.value as typeof market)}
            className="rounded-lg border px-3 py-2 text-sm" disabled={running}>
            <option value="US">USA</option>
            <option value="EU">Europe</option>
            <option value="FR">France</option>
          </select>
          <select value={positioning} onChange={e => setPositioning(e.target.value as typeof positioning)}
            className="rounded-lg border px-3 py-2 text-sm" disabled={running}>
            <option value="budget">Budget</option>
            <option value="mid">Mid-range</option>
            <option value="premium">Premium</option>
          </select>
          <button
            onClick={keywords.length < 3 ? () => setKeywords(prev => [...prev, '']) : undefined}
            className="rounded-lg border px-3 py-2 text-sm text-gray-500 hover:bg-gray-50"
            disabled={running || keywords.length >= 5}
          >
            + Keyword
          </button>
        </div>

        <button
          onClick={launch}
          disabled={running || keywords.filter(k => k.trim()).length === 0}
          className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-3 text-sm font-semibold text-white transition hover:from-blue-700 hover:to-purple-700 disabled:opacity-50"
        >
          {running ? 'Pipeline running...' : 'Launch Pipeline A-Z'}
        </button>
      </div>

      {(events.length > 0 || running) && (
        <div className="flex-1 overflow-y-auto rounded-xl border bg-white p-6 shadow-sm">
          {running && (
            <div className="mb-4">
              <div className="mb-1 flex justify-between text-xs text-gray-500">
                <span>Progress</span>
                <span>{latestProgress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
                  style={{ width: `${latestProgress}%` }} />
              </div>
            </div>
          )}

          <div className="space-y-2">
            {events
              .filter(e => !e.step.startsWith('iteration_') || e.status === 'error')
              .map((e, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <div className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                  e.status === 'done' ? 'bg-green-500'
                  : e.status === 'running' ? 'animate-pulse bg-blue-500'
                  : e.status === 'error' ? 'bg-red-500'
                  : 'bg-gray-300'
                }`} />
                <div className="flex-1">
                  <span className="font-medium">{getStepLabel(e.step)}</span>
                  {typeof e.detail === 'string' && e.detail && (
                    <p className="mt-0.5 text-xs text-gray-500">{(e.detail as string).slice(0, 200)}</p>
                  )}
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(e.timestamp).toLocaleTimeString('fr-FR')}
                </span>
              </div>
            ))}
            <div ref={eventsEndRef} />
          </div>

          {shopResult && (
            <div className="mt-6 rounded-lg border-2 border-green-200 bg-green-50 p-4">
              <h4 className="mb-2 font-semibold text-green-800">Site Deployed</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-gray-500">Name:</span> {String(shopResult.name)}</div>
                <div><span className="text-gray-500">Design:</span> {String(shopResult.design_system)}</div>
                <div><span className="text-gray-500">Products:</span> {String(shopResult.products_created)}</div>
                <div><span className="text-gray-500">Status:</span> {String(shopResult.status)}</div>
              </div>
              <a
                href={String(shopResult.url)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
              >
                View Site
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============ Chat Component (existing) ============

function ChatPanel() {
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
        body: JSON.stringify({ messages: updated.map(m => ({ role: m.role, content: m.content })), model }),
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
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center gap-3">
        <select value={model} onChange={e => setModel(e.target.value as 'fast' | 'main')} className="rounded-lg border px-3 py-1.5 text-sm">
          <option value="fast">Qwen 7B (fast)</option>
          <option value="main">Qwen 32B (powerful)</option>
        </select>
        <button onClick={() => setMessages([])} className="rounded-lg border px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">Clear</button>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <p className="text-sm text-gray-500">Free chat with AI agent</p>
            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map(p => (
                <button key={p.label} onClick={() => send(p.prompt)}
                  className="rounded-xl border bg-white px-3 py-2 text-left text-xs shadow-sm hover:bg-gray-50">
                  <span className="font-medium">{p.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                  m.role === 'user' ? 'bg-blue-600 text-white' : 'border bg-white text-gray-800 shadow-sm'
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

      <form onSubmit={e => { e.preventDefault(); send(input); }} className="flex gap-2 border-t pt-3">
        <input type="text" value={input} onChange={e => setInput(e.target.value)}
          placeholder="Type your message..." disabled={loading}
          className="flex-1 rounded-xl border bg-white px-4 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <button type="submit" disabled={loading || !input.trim()}
          className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          Send
        </button>
      </form>
    </div>
  );
}

// ============ Main Page ============

export default function AgentsPage() {
  const [tab, setTab] = useState<'pipeline' | 'chat'>('pipeline');

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h2 className="text-2xl font-bold">AI Agent</h2>
          <p className="text-sm text-gray-500">A-Z Pipeline or free chat</p>
        </div>
        <div className="flex rounded-lg border bg-gray-100 p-0.5">
          <button
            onClick={() => setTab('pipeline')}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${tab === 'pipeline' ? 'bg-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Pipeline A-Z
          </button>
          <button
            onClick={() => setTab('chat')}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${tab === 'chat' ? 'bg-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Chat
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden pt-4">
        {tab === 'pipeline' ? <PipelinePanel /> : <ChatPanel />}
      </div>
    </div>
  );
}
