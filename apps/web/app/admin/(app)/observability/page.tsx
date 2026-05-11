import Link from 'next/link';
import { getDb, getDbRead } from '@/lib/db';
import { PageHeader, StatCard, StatusPill } from '../../_components/AdminUI';

export const dynamic = 'force-dynamic';

interface StepSummary {
  step: string;
  call_count: number;
  total_cost: number;
  avg_latency_ms: number;
  p95_latency_ms: number;
  error_count: number;
}

interface RecentError {
  id: string;
  store_id: string | null;
  step: string;
  model: string;
  error_json: { message?: string } | null;
  created_at: string;
}

interface TopStore {
  store_id: string;
  store_name: string | null;
  store_slug: string | null;
  call_count: number;
  total_cost: number;
}

interface OverallTotals {
  call_count: number;
  total_cost: number;
  total_input_tokens: number;
  total_output_tokens: number;
  error_count: number;
}

async function fetchTotals(): Promise<OverallTotals> {
  const db = getDbRead();
  const { rows } = await db.query<OverallTotals>(
    `SELECT
        COUNT(*)::int AS call_count,
        COALESCE(SUM(cost_eur), 0)::float AS total_cost,
        COALESCE(SUM(input_tokens), 0)::int AS total_input_tokens,
        COALESCE(SUM(output_tokens), 0)::int AS total_output_tokens,
        COUNT(*) FILTER (WHERE error_json IS NOT NULL)::int AS error_count
      FROM dropship_ai_runs
      WHERE created_at > now() - interval '7 days'`,
  );
  return rows[0] ?? { call_count: 0, total_cost: 0, total_input_tokens: 0, total_output_tokens: 0, error_count: 0 };
}

async function fetchStepBreakdown(): Promise<StepSummary[]> {
  const db = getDbRead();
  const { rows } = await db.query<StepSummary>(
    `SELECT
        step,
        COUNT(*)::int AS call_count,
        COALESCE(SUM(cost_eur), 0)::float AS total_cost,
        COALESCE(AVG(latency_ms), 0)::int AS avg_latency_ms,
        COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms), 0)::int AS p95_latency_ms,
        COUNT(*) FILTER (WHERE error_json IS NOT NULL)::int AS error_count
      FROM dropship_ai_runs
      WHERE created_at > now() - interval '7 days'
      GROUP BY step
      ORDER BY total_cost DESC`,
  );
  return rows;
}

async function fetchTopStores(): Promise<TopStore[]> {
  const db = getDbRead();
  const { rows } = await db.query<TopStore>(
    `SELECT
        r.store_id,
        s.name AS store_name,
        s.slug AS store_slug,
        COUNT(*)::int AS call_count,
        COALESCE(SUM(r.cost_eur), 0)::float AS total_cost
      FROM dropship_ai_runs r
      LEFT JOIN dropship_stores s ON s.id = r.store_id
      WHERE r.created_at > now() - interval '7 days' AND r.store_id IS NOT NULL
      GROUP BY r.store_id, s.name, s.slug
      ORDER BY total_cost DESC
      LIMIT 10`,
  );
  return rows;
}

async function fetchRecentErrors(): Promise<RecentError[]> {
  const db = getDbRead();
  const { rows } = await db.query<RecentError>(
    `SELECT id, store_id, step, model, error_json, created_at
      FROM dropship_ai_runs
      WHERE error_json IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 10`,
  );
  return rows;
}

function fmtEur(n: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 3 }).format(n);
}

function fmtMs(n: number): string {
  if (n < 1000) return `${n} ms`;
  return `${(n / 1000).toFixed(1)} s`;
}

function fmtInt(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(n);
}

export default async function ObservabilityPage() {
  const [totals, steps, topStores, errors] = await Promise.all([
    fetchTotals(),
    fetchStepBreakdown(),
    fetchTopStores(),
    fetchRecentErrors(),
  ]);

  const errorRate = totals.call_count > 0 ? totals.error_count / totals.call_count : 0;

  return (
    <div className="space-y-10">
      <PageHeader
        kicker="Production · Agent IA · 7 derniers jours"
        title={
          <>
            <em className="italic text-zinc-500">Observabilité</em> agent
          </>
        }
        lede="Chaque appel Anthropic est tracé dans dropship_ai_runs avec tokens, latence, coût EUR et erreur. Source unique pour piloter la dépense IA quand on multipliera les stores."
      />

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Appels"
          value={fmtInt(totals.call_count)}
          hint="7 jours glissants"
        />
        <StatCard
          label="Coût total"
          value={fmtEur(totals.total_cost)}
          hint={`${fmtInt(totals.total_input_tokens)} in · ${fmtInt(totals.total_output_tokens)} out tokens`}
          tone={totals.total_cost > 5 ? 'amber' : 'neutral'}
        />
        <StatCard
          label="Erreurs"
          value={fmtInt(totals.error_count)}
          hint={`${(errorRate * 100).toFixed(1)} % du total`}
          tone={errorRate > 0.05 ? 'red' : errorRate > 0.02 ? 'amber' : 'emerald'}
        />
        <StatCard
          label="Stores trackés"
          value={fmtInt(topStores.length)}
          hint="Top 10 plus chers"
        />
      </section>

      {steps.length === 0 && (
        <div className="border border-dashed border-zinc-200 rounded-xl px-6 py-16 text-center bg-white">
          <p className="text-sm font-serif text-zinc-600">Aucun appel agent ces 7 derniers jours.</p>
          <p className="mt-1 text-xs text-zinc-400">Lance un store de test pour voir les premières lignes.</p>
        </div>
      )}

      {steps.length > 0 && (
        <section className="border border-zinc-200 rounded-xl overflow-hidden bg-white">
          <div className="px-5 py-4 border-b border-zinc-200/60 flex items-baseline gap-3">
            <h3 className="text-base font-serif">
              Par <em className="italic text-zinc-700">étape</em>
            </h3>
            <span className="text-xs uppercase tracking-wider text-zinc-400">· {steps.length} steps</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead className="bg-zinc-50/60 text-kicker uppercase tracking-header text-zinc-500">
                <tr>
                  <th className="text-left px-5 py-3 font-medium">Étape</th>
                  <th className="text-right px-5 py-3 font-medium">Appels</th>
                  <th className="text-right px-5 py-3 font-medium">Coût</th>
                  <th className="text-right px-5 py-3 font-medium">Latence moy.</th>
                  <th className="text-right px-5 py-3 font-medium">p95</th>
                  <th className="text-right px-5 py-3 font-medium">Erreurs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {steps.map((s) => {
                  const errRate = s.call_count > 0 ? s.error_count / s.call_count : 0;
                  return (
                    <tr key={s.step} className="hover:bg-zinc-50/60 transition-colors">
                      <td className="px-5 py-3 font-mono text-xs text-zinc-700">{s.step}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{fmtInt(s.call_count)}</td>
                      <td className="px-5 py-3 text-right tabular-nums font-serif">{fmtEur(s.total_cost)}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-zinc-600">{fmtMs(s.avg_latency_ms)}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-zinc-500">{fmtMs(s.p95_latency_ms)}</td>
                      <td className="px-5 py-3 text-right">
                        {s.error_count > 0 ? (
                          <StatusPill tone={errRate > 0.05 ? 'red' : 'amber'}>
                            {fmtInt(s.error_count)} ({(errRate * 100).toFixed(1)}%)
                          </StatusPill>
                        ) : (
                          <span className="text-xs text-zinc-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {topStores.length > 0 && (
        <section className="border border-zinc-200 rounded-xl overflow-hidden bg-white">
          <div className="px-5 py-4 border-b border-zinc-200/60 flex items-baseline gap-3">
            <h3 className="text-base font-serif">
              Top 10 par <em className="italic text-zinc-700">coût</em>
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead className="bg-zinc-50/60 text-kicker uppercase tracking-header text-zinc-500">
                <tr>
                  <th className="text-left px-5 py-3 font-medium">Store</th>
                  <th className="text-right px-5 py-3 font-medium">Appels</th>
                  <th className="text-right px-5 py-3 font-medium">Coût</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {topStores.map((s) => (
                  <tr key={s.store_id} className="hover:bg-zinc-50/60 transition-colors">
                    <td className="px-5 py-3">
                      {s.store_id ? (
                        <Link
                          href={`/admin/stores/${s.store_id}`}
                          className="font-medium text-zinc-900 hover:underline underline-offset-4 decoration-zinc-300 hover:decoration-zinc-700"
                        >
                          {s.store_name || s.store_slug || s.store_id.slice(0, 8)}
                        </Link>
                      ) : (
                        <span className="text-zinc-400">— (orphan)</span>
                      )}
                      {s.store_slug && (
                        <div className="text-kicker font-mono text-zinc-400 mt-0.5">/shop/{s.store_slug}</div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">{fmtInt(s.call_count)}</td>
                    <td className="px-5 py-3 text-right tabular-nums font-serif">{fmtEur(s.total_cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {errors.length > 0 && (
        <section className="border border-red-200 bg-red-50/30 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-red-200/60 bg-red-50/60">
            <h3 className="text-base font-serif text-red-900">
              Erreurs <em className="italic">récentes</em>
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead className="text-kicker uppercase tracking-header text-red-900/60 bg-red-50/40">
                <tr>
                  <th className="text-left px-5 py-3 font-medium">Quand</th>
                  <th className="text-left px-5 py-3 font-medium">Étape</th>
                  <th className="text-left px-5 py-3 font-medium">Store</th>
                  <th className="text-left px-5 py-3 font-medium">Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-200/40">
                {errors.map((e) => (
                  <tr key={e.id}>
                    <td className="px-5 py-3 text-xs text-zinc-500 tabular-nums">
                      {new Date(e.created_at).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-zinc-700">{e.step}</td>
                    <td className="px-5 py-3">
                      {e.store_id ? (
                        <Link href={`/admin/stores/${e.store_id}`} className="text-xs text-zinc-700 underline underline-offset-4 decoration-zinc-300">
                          {e.store_id.slice(0, 8)}
                        </Link>
                      ) : (
                        <span className="text-xs text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-red-700 line-clamp-2 max-w-md">
                      {e.error_json?.message ?? 'erreur sans message'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
