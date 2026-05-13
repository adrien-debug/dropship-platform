/**
 * Shared copilot utilities — message rebuild, tool-use helpers, and common
 * types used by all five copilot modes (research, curation, ads, medias, dev).
 *
 * Extracted from the four individual copilot files to eliminate copy-paste
 * drift. Every mode stores history in its own table (research uses
 * dropship_research_messages, the per-store hub uses dropship_copilot_messages),
 * but the Anthropic message reconstruction logic is identical.
 */

import type Anthropic from '@anthropic-ai/sdk';

// ── Types ───────────────────────────────────────────────────────────────

export interface StoredMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  tool_name: string | null;
  tool_input: unknown;
  tool_output: unknown;
  created_at: string;
}

export interface StoreContext {
  id: string;
  slug: string;
  name: string;
  niche: string;
  mode: 'mono' | 'collection' | null;
  medusa_sales_channel_id: string | null;
  product_count: number;
}

export interface ToolExecutionResult {
  output: unknown;
  /** Compact human-readable summary shown in the chat tool card. */
  summary: string;
  /** True if the catalog changed (UI should re-fetch product list). */
  mutated?: boolean;
}

// ── Message rebuild (Anthropic format) ──────────────────────────────────

export function stripToolUseId(input: unknown): unknown {
  if (!input || typeof input !== 'object') return input ?? {};
  const clone = { ...(input as Record<string, unknown>) };
  delete clone.__tool_use_id;
  return clone;
}

export function stringifyToolOutput(out: unknown): string {
  if (out == null) return '';
  if (typeof out === 'string') return out;
  try {
    return JSON.stringify(out);
  } catch {
    return String(out);
  }
}

/**
 * Re-hydrate stored chat rows into Anthropic message blocks.
 *
 * Stored rows are flat (`user|assistant|tool`); the Anthropic schema groups
 * tool_use + tool_result into separate assistant/user turns. We reconstruct
 * that pairing by treating sequences of `tool` rows that immediately follow
 * an `assistant` row as the matching tool_result blocks.
 */
export function rebuildMessages(history: StoredMessage[]): Anthropic.Messages.MessageParam[] {
  const out: Anthropic.Messages.MessageParam[] = [];

  let pendingToolUses: Array<{ id: string; name: string; input: unknown }> = [];
  let pendingAssistantText = '';

  const flushAssistant = () => {
    const blocks: Anthropic.Messages.ContentBlockParam[] = [];
    if (pendingAssistantText.trim()) {
      blocks.push({ type: 'text', text: pendingAssistantText });
    }
    for (const tu of pendingToolUses) {
      blocks.push({ type: 'tool_use', id: tu.id, name: tu.name, input: tu.input ?? {} });
    }
    if (blocks.length) out.push({ role: 'assistant', content: blocks });
    pendingAssistantText = '';
    pendingToolUses = [];
  };

  for (const row of history) {
    if (row.role === 'user') {
      flushAssistant();
      out.push({ role: 'user', content: row.content });
    } else if (row.role === 'assistant') {
      flushAssistant();
      pendingAssistantText = row.content;
    } else if (row.role === 'tool') {
      const useId =
        row.tool_input &&
        typeof row.tool_input === 'object' &&
        '__tool_use_id' in row.tool_input
          ? String((row.tool_input as { __tool_use_id?: unknown }).__tool_use_id)
          : `toolu_${row.id}`;
      pendingToolUses.push({
        id: useId,
        name: row.tool_name ?? 'unknown',
        input: stripToolUseId(row.tool_input),
      });
      flushAssistant();
      out.push({
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: useId,
            content: stringifyToolOutput(row.tool_output),
            is_error: Boolean(
              row.tool_output &&
                typeof row.tool_output === 'object' &&
                'error' in (row.tool_output as Record<string, unknown>) &&
                (row.tool_output as { error?: unknown }).error,
            ),
          },
        ],
      });
    }
  }
  flushAssistant();
  return out;
}

/**
 * Build the is_error flag from a tool output value. Used by both the
 * rebuild path and the live loop when constructing tool_result blocks.
 */
export function isToolError(output: unknown): boolean {
  return Boolean(
    output &&
      typeof output === 'object' &&
      'error' in (output as Record<string, unknown>) &&
      (output as { error?: unknown }).error,
  );
}
