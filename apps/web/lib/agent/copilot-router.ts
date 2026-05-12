/**
 * Unified Copilote hub router — one chat surface, five modes.
 *
 * Why a router instead of five fully-separate UIs:
 *
 *   - The operator wants a single page they can context-switch in. Sliding
 *     between modes inside the same chat reduces tab spam and lets us
 *     share session storage.
 *   - All four existing copilotes (curation, ads, research, and now the new
 *     medias + dev) share the same tool_use loop topology. The differences
 *     are (a) which tools are exposed and (b) what each tool does.
 *
 * This router reuses the existing copilotes' tool definitions and executors
 * verbatim — they are imported from `__internals`. The loop logic itself is
 * inlined here so we can persist messages into the NEW unified table
 * `dropship_copilot_messages` rather than the three pre-existing tables
 * (dropship_curation_messages, dropship_research_messages). The legacy
 * tables stay untouched; the legacy /curate, /ads, /research pages continue
 * to use their own routes if anyone hits them.
 *
 * Medias mode is implemented INLINE here (no separate file) — it's a small
 * surface wrapping `asset-regenerator.ts`.
 *
 * Dev mode uses `dev-copilot.ts` for tools + executors but the loop and
 * persistence live here so the agent's commits + pushes still feed the
 * unified message log.
 */

import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { trackedMessage } from './anthropic';
import { runContext } from './run-context';
import { __internals as curationInternals } from './curation-copilot';
import { __internals as adsInternals } from './ads-copilot';
import { __internals as researchInternals } from './research-copilot';
import {
  DEV_TOOLS,
  DEV_MODEL,
  DEV_MAX_TOOL_LOOPS,
  DEV_MAX_TOOLS_PER_TURN,
  executeDevTool,
  buildDevSystemPrompt,
  type DevToolCtx,
} from './dev-copilot';
import {
  regenerateAsset,
  setRunAsCurrent,
  listRunsForStore,
  ASSET_KINDS,
  type AssetKind,
} from './asset-regenerator';

// ── Public types ────────────────────────────────────────────────────────

export type CopilotMode = 'research' | 'curation' | 'ads' | 'medias' | 'dev';

export const COPILOT_MODES: readonly CopilotMode[] = [
  'research', 'curation', 'ads', 'medias', 'dev',
] as const;

export interface CopilotStreamEvent {
  type:
    | 'thinking'
    | 'tool_call'
    | 'tool_result'
    | 'message'
    | 'done'
    | 'error'
    | 'confirm_required'
    | 'session';
  data: unknown;
}

export interface CopilotRunOptions {
  autoPushConfirmed?: boolean;
}

const HUB_MODEL = 'claude-sonnet-4-6';
const HUB_MAX_TOOL_LOOPS_DEFAULT = 8;
const HUB_MAX_TOOLS_PER_TURN_DEFAULT = 16;

// ── Internal types ──────────────────────────────────────────────────────

interface StoredMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  tool_name: string | null;
  tool_input: unknown;
  tool_output: unknown;
  created_at: string;
}

interface StoreCtx {
  id: string;
  slug: string;
  name: string;
  niche: string;
  mode: 'mono' | 'collection' | null;
  medusa_sales_channel_id: string | null;
  product_count: number;
}

// ── DB helpers (unified table) ──────────────────────────────────────────

async function loadStoreCtx(storeId: string): Promise<StoreCtx | null> {
  const db = getDb();
  const { rows } = await db.query<{
    id: string;
    slug: string;
    name: string;
    niche: string;
    mode: string | null;
    medusa_sales_channel_id: string | null;
    product_count: number | null;
  }>(
    `SELECT id, slug, name, niche, mode, medusa_sales_channel_id, product_count
       FROM dropship_stores WHERE id = $1 LIMIT 1`,
    [storeId],
  );
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    niche: r.niche,
    mode: r.mode === 'mono' || r.mode === 'collection' ? r.mode : null,
    medusa_sales_channel_id: r.medusa_sales_channel_id,
    product_count: r.product_count ?? 0,
  };
}

export async function createCopilotSession(
  storeId: string,
  mode: CopilotMode,
  title?: string | null,
): Promise<string> {
  const db = getDb();
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO dropship_copilot_sessions (store_id, mode, title)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [storeId, mode, title?.slice(0, 200) ?? null],
  );
  return rows[0]!.id;
}

async function loadHistory(sessionId: string): Promise<StoredMessage[]> {
  const db = getDb();
  const { rows } = await db.query<StoredMessage>(
    `SELECT id, role, content, tool_name, tool_input, tool_output, created_at
       FROM dropship_copilot_messages
       WHERE session_id = $1
       ORDER BY created_at ASC, id ASC`,
    [sessionId],
  );
  return rows;
}

async function insertMessage(
  sessionId: string,
  msg: {
    role: 'user' | 'assistant' | 'tool';
    content: string;
    toolName?: string | null;
    toolInput?: unknown;
    toolOutput?: unknown;
  },
): Promise<void> {
  const db = getDb();
  await db.query(
    `INSERT INTO dropship_copilot_messages
       (session_id, role, content, tool_name, tool_input, tool_output)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [
      sessionId,
      msg.role,
      msg.content,
      msg.toolName ?? null,
      msg.toolInput == null ? null : JSON.stringify(msg.toolInput),
      msg.toolOutput == null ? null : JSON.stringify(msg.toolOutput),
    ],
  );
  await db.query(
    `UPDATE dropship_copilot_sessions SET updated_at = now() WHERE id = $1`,
    [sessionId],
  );
}

async function maybeBackfillTitle(sessionId: string, firstUserMessage: string): Promise<void> {
  const db = getDb();
  const { rows } = await db.query<{ title: string | null }>(
    `SELECT title FROM dropship_copilot_sessions WHERE id = $1 LIMIT 1`,
    [sessionId],
  );
  if (rows[0]?.title) return;
  const title = firstUserMessage.replace(/\s+/g, ' ').trim().slice(0, 80);
  if (!title) return;
  await db.query(
    `UPDATE dropship_copilot_sessions SET title = $1 WHERE id = $2 AND title IS NULL`,
    [title, sessionId],
  );
}

// ── Anthropic message rebuild (shared shape) ────────────────────────────

function stripToolUseId(input: unknown): unknown {
  if (!input || typeof input !== 'object') return input ?? {};
  const clone = { ...(input as Record<string, unknown>) };
  delete clone.__tool_use_id;
  return clone;
}

function stringifyToolOutput(out: unknown): string {
  if (out == null) return '';
  if (typeof out === 'string') return out;
  try {
    return JSON.stringify(out);
  } catch {
    return String(out);
  }
}

function rebuildMessages(history: StoredMessage[]): Anthropic.Messages.MessageParam[] {
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
        row.tool_input && typeof row.tool_input === 'object' && '__tool_use_id' in row.tool_input
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

// ── Medias mode (inline, no separate file) ──────────────────────────────

const ASSET_KIND_TUPLE = [...ASSET_KINDS] as [AssetKind, ...AssetKind[]];

const RegenerateAssetInput = z.object({
  kind: z.enum(ASSET_KIND_TUPLE),
  custom_prompt: z.string().min(2).max(800).optional(),
});

const SetAsCurrentInput = z.object({
  run_id: z.string().uuid(),
  kind: z.enum(ASSET_KIND_TUPLE),
});

const ListAssetsInput = z.object({}).strict();

const MEDIAS_TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: 'list_assets',
    description:
      "Liste les runs d'assets du store (hero, cutout, lifestyle 1/2/3, promo vidéo) avec leur statut, leur URL et lequel est marqué `is_current`.",
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'regenerate_asset',
    description:
      'Relance la génération d\'un asset (hero, cutout, lifestyle-1/2/3, promo). Si `custom_prompt` est fourni il est utilisé verbatim; sinon Claude génère un prompt à partir de la niche + produit. Long (15-45s pour une image, plus pour la vidéo).',
    input_schema: {
      type: 'object',
      properties: {
        kind: {
          type: 'string',
          enum: ASSET_KIND_TUPLE,
          description: 'Type d\'asset à régénérer.',
        },
        custom_prompt: { type: 'string', description: 'Prompt FLUX verbatim (optionnel).' },
      },
      required: ['kind'],
    },
  },
  {
    name: 'set_as_current',
    description:
      'Marque un run précédent comme actif pour son type d\'asset. Re-pointe le storefront vers cette ancienne version sans régénérer.',
    input_schema: {
      type: 'object',
      properties: {
        run_id: { type: 'string', description: 'UUID dropship_asset_runs.id.' },
        kind: { type: 'string', enum: ASSET_KIND_TUPLE },
      },
      required: ['run_id', 'kind'],
    },
  },
];

interface MediasExecResult {
  output: unknown;
  summary: string;
}

async function execListAssets(storeId: string, raw: unknown): Promise<MediasExecResult> {
  ListAssetsInput.parse(raw);
  const grouped = await listRunsForStore(storeId, 10);
  // Flatten and serialise for the model.
  const flat: Array<Record<string, unknown>> = [];
  for (const [kind, runs] of Object.entries(grouped)) {
    for (const r of runs) {
      flat.push({
        kind,
        run_id: r.id,
        status: r.status,
        result_url: r.result_url,
        is_current: r.is_current,
        prompt: r.prompt,
        created_at: r.created_at,
        completed_at: r.completed_at,
        error: r.error_message,
      });
    }
  }
  return {
    output: { runs: flat, total: flat.length },
    summary: `list_assets — ${flat.length} run${flat.length === 1 ? '' : 's'}`,
  };
}

async function execRegenerateAsset(storeId: string, raw: unknown): Promise<MediasExecResult> {
  const input = RegenerateAssetInput.parse(raw);
  const result = await regenerateAsset({
    storeId,
    kind: input.kind,
    customPrompt: input.custom_prompt,
  });
  return {
    output: { run_id: result.runId, url: result.url, warnings: result.warnings, kind: input.kind },
    summary: `regenerate_asset ${input.kind} → ${result.url.slice(-32)}`,
  };
}

async function execSetAsCurrent(storeId: string, raw: unknown): Promise<MediasExecResult> {
  const input = SetAsCurrentInput.parse(raw);
  const { url } = await setRunAsCurrent({ storeId, runId: input.run_id, kind: input.kind });
  return {
    output: { run_id: input.run_id, kind: input.kind, url },
    summary: `set_as_current ${input.kind}`,
  };
}

function buildMediasSystemPrompt(storeName: string, storeNiche: string): string {
  return [
    `Tu es un art director assistant pour le store "${storeName}" (niche "${storeNiche}"). Tu pilotes la régénération des assets visuels (hero, cutout, lifestyle, promo vidéo).`,
    '',
    'Outils:',
    '- list_assets: voir l\'état actuel et l\'historique des runs.',
    '- regenerate_asset: relancer un slot. Long, prévenir l\'utilisateur.',
    '- set_as_current: revenir à un run précédent sans regénérer.',
    '',
    'Règles:',
    '- Français. Pas de tiret cadratin. Pas de triade rythmique.',
    '- Avant de régénérer, confirmer avec l\'utilisateur. La génération est coûteuse.',
    '- Toujours appeler list_assets en premier quand la conversation démarre.',
  ].join('\n');
}

// ── Tool / prompt / executor dispatcher per mode ────────────────────────

interface ModeBinding {
  tools: Anthropic.Messages.Tool[];
  buildSystem: (store: StoreCtx) => string;
  /** Execute tool — returns { output, summary } plus optional flags. */
  execute: (
    name: string,
    input: unknown,
    store: StoreCtx,
    options: CopilotRunOptions,
  ) => Promise<{ output: unknown; summary: string; confirm_required?: boolean }>;
  maxToolLoops: number;
  maxToolsPerTurn: number;
  model: string;
}

function bindings(): Record<CopilotMode, ModeBinding> {
  return {
    research: {
      tools: researchInternals.TOOLS,
      buildSystem: () => researchInternals.buildSystemPrompt(),
      execute: async (name, input) => {
        const r = await researchInternals.executeTool(name, input);
        return { output: r.output, summary: r.summary };
      },
      maxToolLoops: HUB_MAX_TOOL_LOOPS_DEFAULT,
      maxToolsPerTurn: HUB_MAX_TOOLS_PER_TURN_DEFAULT,
      model: HUB_MODEL,
    },
    curation: {
      tools: curationInternals.TOOLS,
      buildSystem: (s) =>
        curationInternals.buildSystemPrompt({
          id: s.id,
          name: s.name,
          niche: s.niche,
          mode: s.mode,
          medusa_sales_channel_id: s.medusa_sales_channel_id,
          product_count: s.product_count,
        }),
      execute: async (name, input, s) => {
        const r = await curationInternals.executeTool(name, input, {
          id: s.id,
          name: s.name,
          niche: s.niche,
          mode: s.mode,
          medusa_sales_channel_id: s.medusa_sales_channel_id,
          product_count: s.product_count,
        });
        return { output: r.output, summary: r.summary };
      },
      maxToolLoops: HUB_MAX_TOOL_LOOPS_DEFAULT,
      maxToolsPerTurn: HUB_MAX_TOOLS_PER_TURN_DEFAULT,
      model: HUB_MODEL,
    },
    ads: {
      tools: adsInternals.TOOLS,
      buildSystem: (s) =>
        adsInternals.buildSystemPrompt({
          id: s.id,
          slug: s.slug,
          name: s.name,
          niche: s.niche,
        }),
      execute: async (name, input, s) => {
        const r = await adsInternals.executeTool(name, input, {
          id: s.id,
          slug: s.slug,
          name: s.name,
          niche: s.niche,
        });
        return { output: r.output, summary: r.summary };
      },
      maxToolLoops: HUB_MAX_TOOL_LOOPS_DEFAULT,
      maxToolsPerTurn: HUB_MAX_TOOLS_PER_TURN_DEFAULT,
      model: HUB_MODEL,
    },
    medias: {
      tools: MEDIAS_TOOLS,
      buildSystem: (s) => buildMediasSystemPrompt(s.name, s.niche),
      execute: async (name, input, s) => {
        if (name === 'list_assets') return execListAssets(s.id, input);
        if (name === 'regenerate_asset') return execRegenerateAsset(s.id, input);
        if (name === 'set_as_current') return execSetAsCurrent(s.id, input);
        throw new Error(`Tool medias inconnu: ${name}`);
      },
      maxToolLoops: HUB_MAX_TOOL_LOOPS_DEFAULT,
      maxToolsPerTurn: HUB_MAX_TOOLS_PER_TURN_DEFAULT,
      model: HUB_MODEL,
    },
    dev: {
      tools: DEV_TOOLS,
      buildSystem: (s) => buildDevSystemPrompt(s.name, s.niche),
      execute: async (name, input, s, options) => {
        const ctx: DevToolCtx = {
          storeId: s.id,
          autoPushConfirmed: !!options.autoPushConfirmed,
        };
        const r = await executeDevTool(name, input, ctx);
        return { output: r.output, summary: r.summary, confirm_required: r.confirm_required };
      },
      maxToolLoops: DEV_MAX_TOOL_LOOPS,
      maxToolsPerTurn: DEV_MAX_TOOLS_PER_TURN,
      model: DEV_MODEL,
    },
  };
}

// ── Public entry point ────────────────────────────────────────────────

/**
 * Stream a single turn for the given mode. Persists every message to the
 * unified `dropship_copilot_messages` table. Yields:
 *
 *   - thinking         : live assistant prose during the loop
 *   - tool_call        : about-to-execute tool
 *   - tool_result      : tool output (or error)
 *   - confirm_required : dev mode `git_push` blocked, awaiting user OK
 *   - message          : final assistant text for this turn
 *   - done             : end of turn
 *   - error            : fatal error, generator stops
 *
 * For Dev mode, the loop limits (15 turns / 20 tools) are larger than the
 * other modes because code-edit chains naturally take more steps (read,
 * search, edit, run tests, fix, commit).
 */
export async function* runCopilotTurn(
  storeId: string,
  sessionId: string,
  mode: CopilotMode,
  userMessage: string,
  options: CopilotRunOptions = {},
): AsyncGenerator<CopilotStreamEvent> {
  const events: CopilotStreamEvent[] = [];
  let resolveNext: (() => void) | null = null;
  let runDone = false;

  const emit = (e: CopilotStreamEvent) => {
    events.push(e);
    if (resolveNext) {
      const r = resolveNext;
      resolveNext = null;
      r();
    }
  };

  const run = async () => {
    try {
      const store = await loadStoreCtx(storeId);
      if (!store) throw new Error(`Store ${storeId} introuvable.`);

      // Persist user message first so a crash mid-turn still leaves history.
      await insertMessage(sessionId, { role: 'user', content: userMessage });
      await maybeBackfillTitle(sessionId, userMessage);

      const history = await loadHistory(sessionId);
      const messages = rebuildMessages(history);

      const binding = bindings()[mode];
      if (!binding) throw new Error(`Mode inconnu: ${mode}`);

      await runContext.run({ storeId }, async () => {
        let loops = 0;
        let toolCallsThisTurn = 0;
        let finalAssistantText = '';

        while (loops < binding.maxToolLoops) {
          loops++;

          const response = await trackedMessage(
            { step: `copilot-${mode}-turn`, storeId },
            {
              model: binding.model,
              max_tokens: 4096,
              system: binding.buildSystem(store),
              tools: binding.tools,
              messages,
            },
          );

          const textBlocks = response.content.filter((b) => b.type === 'text') as Array<
            Extract<typeof response.content[number], { type: 'text' }>
          >;
          const toolUseBlocks = response.content.filter((b) => b.type === 'tool_use') as Array<
            Extract<typeof response.content[number], { type: 'tool_use' }>
          >;
          const assistantText = textBlocks.map((b) => b.text).join('\n').trim();

          if (assistantText) {
            emit({ type: 'thinking', data: { text: assistantText } });
            finalAssistantText = assistantText;
          }

          messages.push({
            role: 'assistant',
            content: response.content
              .filter((b) => b.type === 'text' || b.type === 'tool_use')
              .map((b) => {
                if (b.type === 'text') return { type: 'text', text: b.text };
                return { type: 'tool_use', id: b.id, name: b.name, input: b.input };
              }) as Anthropic.Messages.ContentBlockParam[],
          });

          if (response.stop_reason !== 'tool_use' || toolUseBlocks.length === 0) {
            await insertMessage(sessionId, { role: 'assistant', content: finalAssistantText });
            emit({ type: 'message', data: { text: finalAssistantText } });
            emit({ type: 'done', data: { text: finalAssistantText } });
            return;
          }

          if (assistantText) {
            await insertMessage(sessionId, { role: 'assistant', content: assistantText });
          }

          const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
          for (const block of toolUseBlocks) {
            if (toolCallsThisTurn >= binding.maxToolsPerTurn) {
              const msg = `Maximum d'appels d'outils par tour atteint (${binding.maxToolsPerTurn}).`;
              await insertMessage(sessionId, {
                role: 'tool',
                content: msg,
                toolName: block.name,
                toolInput: { __tool_use_id: block.id, ...(block.input as object) },
                toolOutput: { error: msg },
              });
              toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: msg,
                is_error: true,
              });
              continue;
            }
            toolCallsThisTurn++;

            emit({
              type: 'tool_call',
              data: { id: block.id, name: block.name, input: block.input },
            });

            let toolOutput: unknown;
            let summary = '';
            let isError = false;
            let confirmRequired = false;
            try {
              const result = await binding.execute(block.name, block.input, store, options);
              toolOutput = result.output;
              summary = result.summary;
              confirmRequired = !!result.confirm_required;
            } catch (e) {
              isError = true;
              const message = e instanceof Error ? e.message : String(e);
              const zodIssues =
                e instanceof z.ZodError
                  ? e.errors.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
                  : null;
              toolOutput = { error: message, ...(zodIssues ? { issues: zodIssues } : {}) };
              summary = `Erreur: ${message}`;
            }

            await insertMessage(sessionId, {
              role: 'tool',
              content: summary,
              toolName: block.name,
              toolInput: { __tool_use_id: block.id, ...(block.input as object) },
              toolOutput,
            });

            emit({
              type: 'tool_result',
              data: {
                id: block.id,
                name: block.name,
                output: toolOutput,
                summary,
                is_error: isError,
              },
            });

            if (confirmRequired) {
              emit({
                type: 'confirm_required',
                data: { tool: block.name, input: block.input, output: toolOutput },
              });
            }

            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: stringifyToolOutput(toolOutput),
              is_error: isError,
            });
          }

          messages.push({ role: 'user', content: toolResults });
        }

        const guardMsg = `Boucle d'outils maximale atteinte (${binding.maxToolLoops}).`;
        await insertMessage(sessionId, { role: 'assistant', content: guardMsg });
        emit({ type: 'message', data: { text: guardMsg } });
        emit({ type: 'done', data: { text: guardMsg } });
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      emit({ type: 'error', data: { message } });
    } finally {
      runDone = true;
      if (resolveNext) {
        const r = resolveNext;
        resolveNext = null;
        r();
      }
    }
  };

  void run();

  while (true) {
    if (events.length > 0) {
      yield events.shift()!;
    } else if (runDone) {
      return;
    } else {
      await new Promise<void>((resolve) => {
        resolveNext = resolve;
      });
    }
  }
}

// ── Test surface ────────────────────────────────────────────────────────

export const __internals = {
  bindings,
  rebuildMessages,
  MEDIAS_TOOLS,
  loadStoreCtx,
};
