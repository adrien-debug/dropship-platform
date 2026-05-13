/**
 * Unit tests for rebuildMessages, stripToolUseId, stringifyToolOutput,
 * and isToolError from copilot-shared.ts.
 *
 * These utilities are shared by all five copilot modes — correctness here
 * prevents silent regressions in conversation replay across every mode.
 */

import { describe, expect, it } from 'vitest';
import {
  rebuildMessages,
  stripToolUseId,
  stringifyToolOutput,
  isToolError,
  type StoredMessage,
} from './copilot-shared';

// ── Helpers ───────────────────────────────────────────────────────────────

let seq = 0;
function row(
  role: 'user' | 'assistant' | 'tool',
  content: string,
  opts: Partial<StoredMessage> = {},
): StoredMessage {
  seq++;
  return {
    id: `row-${seq.toString(16).padStart(4, '0')}`,
    role,
    content,
    tool_name: null,
    tool_input: null,
    tool_output: null,
    created_at: new Date(seq * 1000).toISOString(),
    ...opts,
  };
}

// ── stripToolUseId ────────────────────────────────────────────────────────

describe('stripToolUseId', () => {
  it('removes __tool_use_id from an object', () => {
    const result = stripToolUseId({ __tool_use_id: 'tu_1', query: 'yoga' });
    expect(result).toEqual({ query: 'yoga' });
    expect(result).not.toHaveProperty('__tool_use_id');
  });

  it('returns an empty object for null input', () => {
    expect(stripToolUseId(null)).toEqual({});
  });

  it('returns input unchanged when no __tool_use_id', () => {
    const input = { a: 1, b: 'x' };
    expect(stripToolUseId(input)).toEqual(input);
  });
});

// ── stringifyToolOutput ───────────────────────────────────────────────────

describe('stringifyToolOutput', () => {
  it('returns empty string for null', () => {
    expect(stringifyToolOutput(null)).toBe('');
  });

  it('returns string as-is', () => {
    expect(stringifyToolOutput('hello')).toBe('hello');
  });

  it('JSON-stringifies objects', () => {
    const obj = { candidates: [{ id: 'ae1' }] };
    expect(stringifyToolOutput(obj)).toBe(JSON.stringify(obj));
  });
});

// ── isToolError ───────────────────────────────────────────────────────────

describe('isToolError', () => {
  it('returns true when output has a truthy error field', () => {
    expect(isToolError({ error: 'something went wrong' })).toBe(true);
  });

  it('returns false when error is empty string', () => {
    expect(isToolError({ error: '' })).toBe(false);
  });

  it('returns false for null', () => {
    expect(isToolError(null)).toBe(false);
  });

  it('returns false when no error field', () => {
    expect(isToolError({ ok: true })).toBe(false);
  });
});

// ── rebuildMessages ───────────────────────────────────────────────────────

describe('rebuildMessages', () => {
  it('empty history returns empty array', () => {
    expect(rebuildMessages([])).toEqual([]);
  });

  it('user-only message', () => {
    const msgs = rebuildMessages([row('user', 'salut')]);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toEqual({ role: 'user', content: 'salut' });
  });

  it('simple user → assistant sequence (no tool)', () => {
    const msgs = rebuildMessages([
      row('user', 'bonjour'),
      row('assistant', 'Bienvenue !'),
    ]);
    expect(msgs).toHaveLength(2);
    expect(msgs[0]).toEqual({ role: 'user', content: 'bonjour' });
    expect(msgs[1]).toMatchObject({ role: 'assistant' });
    const blocks = msgs[1]!.content as Array<{ type: string; text?: string }>;
    expect(blocks[0]).toEqual({ type: 'text', text: 'Bienvenue !' });
  });

  it('user → assistant + tool_use → tool_result sequence', () => {
    const toolUseId = 'toolu_abc123';
    const msgs = rebuildMessages([
      row('user', 'cherche tapis yoga'),
      row('assistant', 'Je cherche…'),
      row('tool', 'AliExpress: 3 produits', {
        tool_name: 'aliexpress_search',
        tool_input: { __tool_use_id: toolUseId, query: 'tapis yoga' },
        tool_output: { candidates: [{ id: 'ae1' }] },
      }),
    ]);

    // user → assistant (text + tool_use) → user (tool_result)
    expect(msgs).toHaveLength(3);
    expect(msgs[0]).toEqual({ role: 'user', content: 'cherche tapis yoga' });

    const assistantMsg = msgs[1]!;
    expect(assistantMsg.role).toBe('assistant');
    const aBlocks = assistantMsg.content as Array<{ type: string }>;
    expect(aBlocks.some((b) => b.type === 'text')).toBe(true);
    expect(aBlocks.some((b) => b.type === 'tool_use')).toBe(true);

    const toolResultMsg = msgs[2]!;
    expect(toolResultMsg.role).toBe('user');
    const trBlocks = toolResultMsg.content as Array<{ type: string; tool_use_id?: string; is_error?: boolean }>;
    expect(trBlocks[0]!.type).toBe('tool_result');
    expect(trBlocks[0]!.tool_use_id).toBe(toolUseId);
    expect(trBlocks[0]!.is_error).toBe(false);
  });

  it('tool_result with error output sets is_error=true', () => {
    const msgs = rebuildMessages([
      row('user', 'meta'),
      row('assistant', ''),
      row('tool', 'Erreur Zod', {
        tool_name: 'meta_ads_library',
        tool_input: { __tool_use_id: 'toolu_err', country: 'FR' },
        tool_output: { error: 'Required field niche is missing' },
      }),
    ]);
    const trBlocks = msgs[msgs.length - 1]!.content as Array<{ is_error?: boolean }>;
    expect(trBlocks[0]!.is_error).toBe(true);
  });

  it('multi-tool in the same turn groups correctly', () => {
    const msgs = rebuildMessages([
      row('user', 'analyse'),
      row('assistant', 'Je lance deux recherches.'),
      row('tool', 'Meta: saturation 42', {
        tool_name: 'meta_ads_library',
        tool_input: { __tool_use_id: 'toolu_meta', niche: 'yoga' },
        tool_output: { saturation: 42 },
      }),
      row('tool', 'AE: 3 produits', {
        tool_name: 'aliexpress_search',
        tool_input: { __tool_use_id: 'toolu_ae', query: 'yoga mat' },
        tool_output: { candidates: [] },
      }),
    ]);

    // Each tool row becomes its own user message with a tool_result block
    const toolResultMsgs = msgs.filter((m) => {
      if (typeof m.content === 'string') return false;
      return (m.content as Array<{ type: string }>).some((b) => b.type === 'tool_result');
    });
    expect(toolResultMsgs).toHaveLength(2);
  });

  it('long multi-turn history reconstructs all turns', () => {
    const history: StoredMessage[] = [
      row('user', 'turn 1'),
      row('assistant', 'réponse 1'),
      row('user', 'turn 2'),
      row('assistant', 'Je cherche.'),
      row('tool', 'résultat', {
        tool_name: 'web_search',
        tool_input: { __tool_use_id: 'toolu_t2', query: 'yoga' },
        tool_output: { results: [] },
      }),
      row('user', 'turn 3'),
      row('assistant', 'réponse finale'),
    ];
    const msgs = rebuildMessages(history);
    // All messages should be present and valid
    expect(msgs.length).toBeGreaterThanOrEqual(5);
    const roles = msgs.map((m) => m.role);
    // Must alternate user/assistant broadly (tool_results are user role)
    expect(roles[0]).toBe('user');
    expect(roles[roles.length - 1]).toBe('assistant');
  });

  it('tool row without __tool_use_id falls back to toolu_<row.id> and does not crash', () => {
    const msgs = rebuildMessages([
      row('user', 'meta'),
      row('assistant', ''),
      row('tool', 'résultat', {
        id: 'row-fallback',
        tool_name: 'meta_ads_library',
        tool_input: { niche: 'yoga' }, // no __tool_use_id
        tool_output: { saturation: 10 },
      }),
    ]);
    const trBlocks = msgs[msgs.length - 1]!.content as Array<{ tool_use_id?: string }>;
    expect(trBlocks[0]!.tool_use_id).toBe('toolu_row-fallback');
  });
});
