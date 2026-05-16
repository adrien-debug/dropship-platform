import Anthropic from '@anthropic-ai/sdk';
import { getDb } from '@/lib/db';
import { runContext } from './run-context';

/**
 * Anthropic SDK wrapper that records every Claude call into
 * `dropship_ai_runs`. Wraps `messages.create()` so the call sites in the
 * agent pipeline don't have to thread logging code through every step.
 *
 * Logging is fire-and-forget — a DB hiccup must never break a store
 * creation. The cost computation is per-model, expressed in EUR using a
 * fixed USD→EUR ratio (rough enough at this volume; the day a precise
 * accounting matters, swap for a live FX feed).
 *
 * Public surface:
 *   - `trackedMessage(meta, params)` is a drop-in replacement for
 *     `anthropic.messages.create(params)`.
 *   - `getAnthropicClient()` returns the shared SDK instance (legacy
 *     escape hatch — prefer `trackedMessage` so the run lands in the
 *     ledger).
 */

// USD per 1M tokens for each model we may call. Source: Anthropic
// pricing page snapshot 2026. Add new model IDs as we adopt them.
const PRICING: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5-20251001': { input: 0.8, output: 4.0 },
  'claude-sonnet-4-6': { input: 3.0, output: 15.0 },
  'claude-opus-4-7': { input: 15.0, output: 75.0 },
};

// Conservative USD→EUR. Override at runtime via env if needed.
const USD_TO_EUR = Number(process.env.USD_TO_EUR ?? '0.92');

let cachedClient: Anthropic | null = null;
function getAnthropicClient(): Anthropic {
  if (!cachedClient) {
    cachedClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return cachedClient;
}

export interface RunMeta {
  /** UUID of the store this call is part of, when known. Null for
   *  exploratory calls (eg. niche validator that runs before a store
   *  exists). */
  storeId?: string | null;
  /** Free-form label used in the ledger and the dashboard: 'generate',
   *  'enrich', 'vision-score', 'prompt-build', etc. */
  step: string;
}

/**
 * Compute the EUR cost of a single call from the response usage block.
 * Models we don't know about return 0 — the ledger still records token
 * counts, so the cost backfill is a single UPDATE if pricing changes.
 */
export function computeCostEur(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICING[model];
  if (!p) return 0;
  const usd = (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output;
  return Number((usd * USD_TO_EUR).toFixed(6));
}

interface InsertArgs {
  storeId: string | null;
  step: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  costEur: number;
  errorJson: string | null;
}

async function insertRun(args: InsertArgs): Promise<void> {
  try {
    const db = getDb();
    await db.query(
      `INSERT INTO dropship_ai_runs
         (store_id, step, model, input_tokens, output_tokens, latency_ms, cost_eur, error_json)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        args.storeId,
        args.step,
        args.model,
        args.inputTokens,
        args.outputTokens,
        args.latencyMs,
        args.costEur,
        args.errorJson,
      ],
    );
  } catch (e) {
    // Audit failure must never propagate. Log to stderr for Sentry pickup.
    console.error('[anthropic-tracked] insertRun failed', e);
  }
}

// ── Retry + timeout layer ───────────────────────────────────────────────

const MAX_RETRIES = 3;
const TIMEOUT_MS = 60_000;

function isRetryableError(e: unknown): boolean {
  if (e instanceof Anthropic.APIError) {
    const status = e.status;
    if (status === 429) return true;
    if (status != null && status >= 500) return true;
    return false;
  }
  if (e instanceof Error && /network|timeout|abort|fetch/i.test(e.message)) return true;
  return false;
}

async function callWithRetry(
  params: Anthropic.Messages.MessageCreateParamsNonStreaming,
): Promise<Anthropic.Messages.Message> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await getAnthropicClient().messages.create(params, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (e) {
      lastError = e;
      if (!isRetryableError(e) || attempt === MAX_RETRIES - 1) throw e;
      const delay = 1000 * 2 ** attempt;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}

/**
 * Wrap `anthropic.messages.create()` and log usage on completion. The
 * wrapped call returns the same shape as the SDK. Errors are re-thrown
 * unchanged after being recorded.
 */
export async function trackedMessage(
  meta: RunMeta,
  params: Anthropic.Messages.MessageCreateParamsNonStreaming,
): Promise<Anthropic.Messages.Message> {
  const startedAt = Date.now();
  const model = typeof params.model === 'string' ? params.model : 'unknown';
  let response: Anthropic.Messages.Message | null = null;
  let errorJson: string | null = null;
  try {
    response = await callWithRetry(params);
    return response;
  } catch (e) {
    errorJson = JSON.stringify({
      message: e instanceof Error ? e.message : String(e),
      name: e instanceof Error ? e.name : null,
      stack: e instanceof Error ? e.stack?.split('\n').slice(0, 6).join('\n') ?? null : null,
    });
    throw e;
  } finally {
    const latencyMs = Date.now() - startedAt;
    const inputTokens = response?.usage?.input_tokens ?? 0;
    const outputTokens = response?.usage?.output_tokens ?? 0;
    const costEur = computeCostEur(model, inputTokens, outputTokens);
    // Fire-and-forget: do not await, do not block the agent on the audit
    // write. The promise rejection is swallowed inside insertRun.
    const ambientStoreId = runContext.getStore()?.storeId ?? null;
    void insertRun({
      storeId: meta.storeId ?? ambientStoreId,
      step: meta.step,
      model,
      inputTokens,
      outputTokens,
      latencyMs,
      costEur,
      errorJson,
    });
  }
}
