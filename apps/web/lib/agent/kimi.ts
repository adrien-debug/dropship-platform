/**
 * Kimi K2.5 (Moonshot AI) wrapper for the store-creator pipeline.
 *
 * Why Kimi: the user explicitly asked to replace Claude Haiku 4.5 with
 * Kimi K2.5 for product generation / enrichment. The API is OpenAI-compatible
 * (https://api.moonshot.cn/v1) so we call it with raw fetch.
 *
 * Every call is logged to `dropship_ai_runs` with the same shape as
 * `trackedMessage` so the cost dashboard stays consistent.
 */

import { getDb } from '@/lib/db';
import { runContext } from './run-context';

const API_BASE = process.env.HYPER_API_BASE || 'https://api.hypercli.com/v1';
const MODEL = process.env.KIMI_MODEL || 'kimi-k2.5';
const TIMEOUT_MS = 60_000;
const MAX_RETRIES = 3;

function getApiKey(): string {
  const key = process.env.HYPER_API_KEY?.trim() || process.env.MOONSHOT_API_KEY?.trim();
  if (!key) throw new Error('HYPER_API_KEY (or MOONSHOT_API_KEY) is not set');
  return key;
}

function isRetryable(status: number, message: string): boolean {
  if (status === 429) return true;
  if (status >= 500) return true;
  if (/timeout|abort|fetch|network/i.test(message)) return true;
  return false;
}

interface KimiUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface KimiResponse {
  choices: Array<{
    message: {
      role: string;
      content: string;
      refusal?: string | null;
    };
    finish_reason: string;
    index: number;
  }>;
  usage?: KimiUsage;
  error?: { message: string; type: string };
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
    console.error('[kimi-tracked] insertRun failed', e);
  }
}

/**
 * Rough EUR cost for Kimi K2.5 (May 2026 pricing snapshot).
 * Source: Moonshot AI pricing page.
 * If pricing changes, backfill via UPDATE on dropship_ai_runs.
 */
function computeCostEur(inputTokens: number, outputTokens: number): number {
  // Kimi K2.5 : ~2 CNY / 1M input tokens, ~8 CNY / 1M output tokens
  // Rough EUR conversion: 1 CNY ≈ 0.128 EUR
  const inputCny = (inputTokens / 1_000_000) * 2;
  const outputCny = (outputTokens / 1_000_000) * 8;
  return Number(((inputCny + outputCny) * 0.128).toFixed(6));
}

export interface KimiMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
}

export interface KimiTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface KimiToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface KimiRunMeta {
  storeId?: string | null;
  step: string;
}

/**
 * Drop-in replacement for `trackedMessage` tailored to Kimi K2.5.
 * Supports optional function-calling via the OpenAI-compatible API.
 */
export async function trackedKimiMessage(
  meta: KimiRunMeta,
  messages: KimiMessage[],
  options?: { tools?: KimiTool[] },
): Promise<{ text: string; usage: KimiUsage; tool_calls?: KimiToolCall[] }> {
  const startedAt = Date.now();
  let responseText = '';
  let toolCalls: KimiToolCall[] | undefined;
  let usage: KimiUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
  let errorJson: string | null = null;

  try {
    const body: Record<string, unknown> = {
      model: MODEL,
      messages,
      max_tokens: 4096,
      temperature: 0.7,
    };
    if (options?.tools) {
      body.tools = options.tools;
      body.tool_choice = 'auto';
    }

    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const res = await fetch(`${API_BASE}/chat/completions`, {
          method: 'POST',
          signal: AbortSignal.timeout(TIMEOUT_MS),
          headers: {
            Authorization: `Bearer ${getApiKey()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        const data = (await res.json()) as KimiResponse & {
          choices?: Array<{
            message?: {
              role?: string;
              content?: string | null;
              tool_calls?: KimiToolCall[];
            };
          }>;
        };

        if (!res.ok || data.error) {
          const errMsg = data.error?.message || `Kimi HTTP ${res.status}`;
          if (!isRetryable(res.status, errMsg) || attempt === MAX_RETRIES - 1) {
            throw new Error(errMsg);
          }
          lastError = new Error(errMsg);
          await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
          continue;
        }

        const msg = data.choices?.[0]?.message;
        if (msg?.tool_calls && msg.tool_calls.length > 0) {
          toolCalls = msg.tool_calls;
        }
        responseText = msg?.content ?? '';
        usage = data.usage ?? usage;
        break;
      } catch (e) {
        lastError = e;
        if (e instanceof Error && e.name === 'AbortError') {
          lastError = new Error('Kimi timeout');
        }
        if (!isRetryable(0, e instanceof Error ? e.message : '') || attempt === MAX_RETRIES - 1) {
          throw lastError;
        }
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      }
    }

    return { text: responseText, usage, tool_calls: toolCalls };
  } catch (e) {
    errorJson = JSON.stringify({
      message: e instanceof Error ? e.message : String(e),
      name: e instanceof Error ? e.name : null,
    });
    throw e;
  } finally {
    const latencyMs = Date.now() - startedAt;
    const costEur = computeCostEur(usage.prompt_tokens, usage.completion_tokens);
    const ambientStoreId = runContext.getStore()?.storeId ?? null;
    void insertRun({
      storeId: meta.storeId ?? ambientStoreId,
      step: meta.step,
      model: MODEL,
      inputTokens: usage.prompt_tokens,
      outputTokens: usage.completion_tokens,
      latencyMs,
      costEur,
      errorJson,
    });
  }
}
