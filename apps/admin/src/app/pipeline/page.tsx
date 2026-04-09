'use client';

import { useCallback, useRef, useState } from 'react';

type Status = 'idle' | 'checking' | 'online' | 'offline';

interface ServiceState {
  id: string;
  label: string;
  category: string;
  status: Status;
  latency?: number;
  detail?: string;
}

interface Summary {
  online: number;
  offline: number;
  total: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  commerce: 'Commerce',
  ai: 'AI / LLM',
  infra: 'Infrastructure',
  deploy: 'Deploy',
  suppliers: 'Suppliers',
};

const CATEGORY_ORDER = ['commerce', 'ai', 'infra', 'deploy', 'suppliers'];

const INITIAL_SERVICES: ServiceState[] = [
  { id: 'medusa', label: 'Medusa', category: 'commerce', status: 'idle' },
  { id: 'supabase', label: 'Supabase', category: 'commerce', status: 'idle' },
  { id: 'vllm-gpu1', label: 'vLLM GPU1', category: 'ai', status: 'idle' },
  { id: 'vllm-gpu1-fast', label: 'vLLM GPU1 Fast', category: 'ai', status: 'idle' },
  { id: 'comfyui', label: 'ComfyUI', category: 'ai', status: 'idle' },
  { id: 'openclaw', label: 'OpenClaw API', category: 'ai', status: 'idle' },
  { id: 'gpu1-backend', label: 'GPU1 Backend', category: 'infra', status: 'idle' },
  { id: 'redis', label: 'Redis', category: 'infra', status: 'idle' },
  { id: 'postgres', label: 'PostgreSQL', category: 'infra', status: 'idle' },
  { id: 'gpu2-medusa-admin', label: 'Medusa Admin UI', category: 'deploy', status: 'idle' },
  { id: 'gpu2-ssh', label: 'GPU2 SSH', category: 'deploy', status: 'idle' },
  { id: 'cj-dropshipping', label: 'CJ Dropshipping', category: 'suppliers', status: 'idle' },
  { id: 'aliexpress', label: 'AliExpress', category: 'suppliers', status: 'idle' },
];

function Led({ status }: { status: Status }) {
  const base = 'inline-block h-3 w-3 rounded-full ring-2 shrink-0';
  switch (status) {
    case 'online':
      return <span className={`${base} bg-emerald-400 ring-emerald-400/30`} />;
    case 'offline':
      return <span className={`${base} bg-red-400 ring-red-400/30`} />;
    case 'checking':
      return <span className={`${base} animate-pulse bg-amber-400 ring-amber-400/30`} />;
    default:
      return <span className={`${base} bg-gray-300 ring-gray-300/20`} />;
  }
}

export default function PipelineHealthPage() {
  const [services, setServices] = useState<ServiceState[]>(INITIAL_SERVICES);
  const [running, setRunning] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [lastPing, setLastPing] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const ping = useCallback(async () => {
    if (running) {
      abortRef.current?.abort();
      return;
    }

    setRunning(true);
    setSummary(null);
    setServices(INITIAL_SERVICES);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/pipeline/health', {
        method: 'POST',
        signal: controller.signal,
      });

      const reader = res.body?.getReader();
      if (!reader) return;

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
          try {
            const data = JSON.parse(line.slice(6));

            if (data.done) {
              setSummary(data.summary);
              setLastPing(new Date().toLocaleTimeString('fr-FR'));
              continue;
            }

            setServices(prev =>
              prev.map(s =>
                s.id === data.id
                  ? { ...s, status: data.status, latency: data.latency, detail: data.detail }
                  : s,
              ),
            );
          } catch {}
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      console.error('[pipeline-health]', err);
    } finally {
      setRunning(false);
    }
  }, [running]);

  const grouped = CATEGORY_ORDER
    .map(cat => ({ category: cat, items: services.filter(s => s.category === cat) }))
    .filter(g => g.items.length > 0);

  const allOnline = summary && summary.online === summary.total;
  const hasOffline = summary && summary.offline > 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pipeline Health</h1>
          <p className="mt-1 text-sm text-gray-500">
            {lastPing ? `Dernier ping : ${lastPing}` : 'Aucun ping effectue'}
          </p>
        </div>
        <button
          onClick={ping}
          className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition ${
            running
              ? 'bg-amber-500 hover:bg-amber-600'
              : 'bg-gray-900 hover:bg-gray-800'
          }`}
        >
          {running ? (
            <>
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Stop
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Ping All
            </>
          )}
        </button>
      </div>

      {/* Summary bar */}
      {summary && (
        <div
          className={`flex items-center gap-3 rounded-xl border px-5 py-3 text-sm font-medium ${
            allOnline
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {allOnline ? (
            <svg className="h-5 w-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg className="h-5 w-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          )}
          {allOnline
            ? `Tous les services sont en ligne (${summary.total}/${summary.total})`
            : `${summary.offline} service${summary.offline > 1 ? 's' : ''} offline — ${summary.online}/${summary.total} en ligne`}
          {allOnline && (
            <span className="ml-auto text-xs font-normal text-emerald-600">
              Pipeline ready
            </span>
          )}
          {hasOffline && (
            <span className="ml-auto text-xs font-normal text-red-600">
              Pipeline non disponible
            </span>
          )}
        </div>
      )}

      {/* Service grid by category */}
      {grouped.map(group => (
        <div key={group.category}>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
            {CATEGORY_LABELS[group.category] ?? group.category}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.items.map(svc => (
              <div
                key={svc.id}
                className={`flex items-center gap-3 rounded-xl border bg-white px-4 py-3 shadow-sm transition ${
                  svc.status === 'online'
                    ? 'border-emerald-100'
                    : svc.status === 'offline'
                      ? 'border-red-100'
                      : 'border-gray-100'
                }`}
              >
                <Led status={svc.status} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">{svc.label}</p>
                  {svc.detail && (
                    <p
                      className={`truncate text-xs ${
                        svc.status === 'online' ? 'text-emerald-600' : svc.status === 'offline' ? 'text-red-500' : 'text-gray-400'
                      }`}
                    >
                      {svc.detail}
                    </p>
                  )}
                </div>
                {svc.latency !== undefined && svc.status !== 'idle' && svc.status !== 'checking' && (
                  <span
                    className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium ${
                      svc.latency < 500
                        ? 'bg-emerald-50 text-emerald-700'
                        : svc.latency < 2000
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-red-50 text-red-700'
                    }`}
                  >
                    {svc.latency}ms
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Empty state */}
      {!summary && !running && (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white px-6 py-16 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
            <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-900">Aucun diagnostic lance</p>
          <p className="mt-1 text-sm text-gray-500">
            Clique sur <strong>Ping All</strong> pour verifier tous les services de la pipeline.
          </p>
        </div>
      )}
    </div>
  );
}
