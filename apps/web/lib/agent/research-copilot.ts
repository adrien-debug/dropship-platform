/**
 * Pre-creation niche research copilot.
 *
 * Mirrors the architectural pattern of `curation-copilot.ts` but the tools
 * are oriented around discovery rather than mutation:
 *   - web_search       (Tavily)            : raw web results
 *   - ask_perplexity   (Perplexity Sonar)  : synthesised answers + citations
 *   - meta_ads_library (validateNiche)     : saturation + creatives + angles
 *   - aliexpress_search                    : supplier candidates
 *   - cj_search                            : EU-warehouse alternatives
 *   - shortlist_niche                      : final structured recommendation
 *
 * Conversations live in `dropship_research_sessions` / `_messages`. They are
 * NOT tied to a store — the whole point is to converge on a niche BEFORE
 * the operator creates the store.
 *
 * Cost attribution: each Claude call is wrapped in
 *   runContext.run({ storeId: null }, ...)
 * so the `dropship_ai_runs` row lands with a null store_id. The admin
 * cost dashboard already shows null-store rows under "exploratoire".
 *
 * Loop guarantees (same as curation-copilot):
 *   - max 6 Claude turns per user message (MAX_TOOL_LOOPS)
 *   - max 6 tool calls per user message (MAX_TOOLS_PER_TURN — enforced
 *     by the per-turn limit in the system prompt; we still set a hard
 *     numeric cap)
 *   - Zod-validated tool inputs; invalid inputs come back to Claude as a
 *     tool_result with `is_error: true` and a structured issues list, so
 *     it can retry rather than crash the loop.
 *
 * ──────────────────────────────────────────────────────────────────────
 * Implementation is split across `./research/*` for maintainability:
 *   - `./research/types`        : exported public types
 *   - `./research/tools`        : Zod input schemas + Anthropic tool defs
 *   - `./research/prompts`      : system prompt + temporal context
 *   - `./research/executors`    : per-tool executor functions
 *   - `./research/orchestrator` : main loop + DB helpers + public entries
 *
 * This file re-exports the same public surface as before the refactor —
 * external importers (admin routes, copilot-router, tests) should keep
 * importing from `@/lib/agent/research-copilot` unchanged.
 * ──────────────────────────────────────────────────────────────────────
 */

import { rebuildMessages } from './copilot-shared';
import { TOOLS } from './research/tools';
import { buildSystemPrompt } from './research/prompts';
import { executeTool } from './research/executors';
import {
  RESEARCH_MODEL,
  loadHistory,
  insertMessage,
} from './research/orchestrator';

export type { ResearchStreamEvent } from './research/types';
export { buildTemporalContext } from './research/prompts';
export {
  createResearchSession,
  runResearchTurn,
  RESEARCH_MODEL,
} from './research/orchestrator';

// Internal exports for testing.
export const __internals = {
  TOOLS,
  rebuildMessages,
  buildSystemPrompt,
  executeTool,
  loadHistory,
  insertMessage,
  RESEARCH_MODEL,
};
