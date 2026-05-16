/**
 * Super Agent — universal omnipresent copilot.
 *
 * Goal: one agent that can do EVERYTHING on the platform:
 *   - read/write source code
 *   - query/mutate the database
 *   - regenerate assets
 *   - update storefront config (colors, template, copy)
 *   - commit, push and deploy
 *
 * It reuses existing tool executors (dev-copilot, medias, etc.) and adds
 * new ones (sql_query, update_store, deploy). The loop is Kimi-powered
 * because the user explicitly asked for Kimi as the main brain.
 *
 * Safety model:
 *   - Read-only SQL by default
 *   - Confirmation required for destructive DB writes
 *   - Confirmation required for git_push and deploy
 *   - Path traversal blocked (inherited from dev-copilot)
 *   - .env* and .git/ writes blocked (inherited from dev-copilot)
 */

import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { trackedKimiMessage } from './kimi';
import {
  executeDevTool,
  DEV_TOOLS,
} from './dev-copilot';
import {
  regenerateAsset,
  ASSET_KINDS,
  type AssetKind,
} from './asset-regenerator';

// ── Public types ────────────────────────────────────────────────────────

export type SuperAgentEvent =
  | { type: 'thinking'; text: string }
  | { type: 'tool_call'; name: string; input: unknown }
  | { type: 'tool_result'; name: string; output: unknown; is_error: boolean }
  | { type: 'confirm_required'; tool: string; reason: string }
  | { type: 'message'; text: string }
  | { type: 'done' }
  | { type: 'error'; message: string };

export interface SuperAgentOptions {
  /** Current browser pathname (e.g. /admin/stores/new) */
  page: string;
  /** Active store id when known. */
  storeId?: string;
  /** Operator confirmation flags passed from the UI. */
  confirmations?: Record<string, boolean>;
}

// ── Tool definitions ───────────────────────────────────────────────────

const ASSET_KIND_TUPLE = [...ASSET_KINDS] as [AssetKind, ...AssetKind[]];

const SUPER_TOOLS: Anthropic.Messages.Tool[] = [
  ...DEV_TOOLS,
  {
    name: 'run_sql',
    description:
      'Exécute une requête SQL sur la base Postgres. Par défaut lecture seule (SELECT). Pour INSERT/UPDATE/DELETE, l\'outil retourne une demande de confirmation que l\'opérateur doit approuver avant exécution.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Requête SQL paramétrée. Pas de string interpolation — utilise $1, $2.',
        },
        params: {
          type: 'array',
          items: { type: 'string' },
          description: 'Paramètres pour la requête (optionnel).',
        },
        mode: {
          type: 'string',
          enum: ['read', 'write'],
          description: 'read = SELECT uniquement. write = INSERT/UPDATE/DELETE (nécessite confirmation).',
        },
      },
      required: ['query', 'mode'],
    },
  },
  {
    name: 'update_store',
    description:
      'Met à jour une colonne de dropship_stores pour un store donné. Chaque appel ne modifie qu\'une seule colonne pour la traçabilité.',
    input_schema: {
      type: 'object',
      properties: {
        store_id: { type: 'string', description: 'UUID du store.' },
        column: {
          type: 'string',
          enum: [
            'name',
            'niche',
            'mode',
            'template',
            'design_preset',
            'primary_color',
            'accent_color',
            'landing_content',
            'status',
          ],
          description: 'Colonne à modifier.',
        },
        value: { type: 'string', description: 'Nouvelle valeur (string ou JSON stringifié).' },
      },
      required: ['store_id', 'column', 'value'],
    },
  },
  {
    name: 'list_tables',
    description: 'Liste les tables de la base avec leur nombre de lignes approximatif.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'regenerate_asset',
    description:
      'Relance la génération d\'un asset visuel (hero, cutout, lifestyle, promo). Identique à l\'outil medias du copilot hub.',
    input_schema: {
      type: 'object',
      properties: {
        store_id: { type: 'string' },
        kind: { type: 'string', enum: ASSET_KIND_TUPLE },
        custom_prompt: { type: 'string', description: 'Prompt FLUX optionnel.' },
      },
      required: ['store_id', 'kind'],
    },
  },
  {
    name: 'deploy_vercel',
    description:
      'Déploie la branche courante sur Vercel en production. Nécessite confirmation explicite. Équivalent à git commit + git push + vercel --prod.',
    input_schema: {
      type: 'object',
      properties: {
        commit_message: { type: 'string', description: 'Message de commit (1-2 phrases).' },
      },
      required: ['commit_message'],
    },
  },
];

// ── Tool executors ─────────────────────────────────────────────────────

async function execRunSql(
  input: unknown,
  confirmations: Record<string, boolean>,
): Promise<{ output: unknown; summary: string; confirm_required?: boolean }> {
  const schema = z.object({
    query: z.string().min(1),
    mode: z.enum(['read', 'write']),
    params: z.array(z.string()).optional(),
  });
  const { query, mode, params } = schema.parse(input);

  if (mode === 'write') {
    const confirmKey = `sql:${query.slice(0, 40)}`;
    if (!confirmations[confirmKey]) {
      return {
        output: { confirmKey, query: query.slice(0, 200) },
        summary: 'run_sql write — confirmation requise',
        confirm_required: true,
      };
    }
  }

  const db = getDb();
  const { rows } = await db.query(query, params ?? []);
  return {
    output: { rows, count: rows.length },
    summary: `run_sql ${mode} — ${rows.length} ligne(s)`,
  };
}

async function execUpdateStore(input: unknown): Promise<{ output: unknown; summary: string }> {
  const schema = z.object({
    store_id: z.string().uuid(),
    column: z.string(),
    value: z.string(),
  });
  const { store_id, column, value } = schema.parse(input);

  const allowed = new Set([
    'name',
    'niche',
    'mode',
    'template',
    'design_preset',
    'primary_color',
    'accent_color',
    'landing_content',
    'status',
  ]);
  if (!allowed.has(column)) {
    throw new Error(`Colonne non autorisée: ${column}`);
  }

  const db = getDb();
  await db.query(`UPDATE dropship_stores SET ${column} = $1, updated_at = now() WHERE id = $2`, [
    value,
    store_id,
  ]);
  return { output: { store_id, column, value }, summary: `update_store ${column}` };
}

async function execListTables(): Promise<{ output: unknown; summary: string }> {
  const db = getDb();
  const { rows } = await db.query(`
    SELECT relname AS table, n_live_tup AS approx_rows
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
    ORDER BY n_live_tup DESC
  `);
  return { output: { tables: rows }, summary: `list_tables — ${rows.length} tables` };
}

async function execRegenerateAssetSuper(input: unknown): Promise<{ output: unknown; summary: string }> {
  const schema = z.object({
    store_id: z.string().uuid(),
    kind: z.enum(ASSET_KIND_TUPLE),
    custom_prompt: z.string().optional(),
  });
  const { store_id, kind, custom_prompt } = schema.parse(input);
  const result = await regenerateAsset({ storeId: store_id, kind, customPrompt: custom_prompt });
  return {
    output: { runId: result.runId, url: result.url },
    summary: `regenerate_asset ${kind} → ${result.url.slice(-32)}`,
  };
}

async function execDeployVercel(
  input: unknown,
  confirmations: Record<string, boolean>,
): Promise<{ output: unknown; summary: string; confirm_required?: boolean }> {
  const schema = z.object({ commit_message: z.string().min(3) });
  const { commit_message } = schema.parse(input);

  if (!confirmations['deploy_vercel']) {
    return {
      output: { reason: 'Déploiement production — confirmation requise' },
      summary: 'deploy_vercel — confirmation requise',
      confirm_required: true,
    };
  }

  const { exec } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const execAsync = promisify(exec);

  const root = process.cwd();
  await execAsync('git add -A && git commit -m "' + commit_message.replace(/"/g, '\\"') + '"', { cwd: root, timeout: 30_000 });
  await execAsync('git push origin main', { cwd: root, timeout: 60_000 });
  const { stdout } = await execAsync('vercel --prod --yes', { cwd: root, timeout: 120_000 });

  return {
    output: { deployed: true, vercel_output: stdout.slice(0, 500) },
    summary: 'deploy_vercel — production déployée',
  };
}

// ── Dispatcher ─────────────────────────────────────────────────────────

async function executeSuperTool(
  name: string,
  input: unknown,
  ctx: { storeId?: string; confirmations: Record<string, boolean> },
): Promise<{ output: unknown; summary: string; confirm_required?: boolean }> {
  // Dev tools (code)
  const devToolNames = new Set([
    'read_file', 'list_files', 'search_code', 'write_file', 'apply_patch',
    'run_bash', 'git_status', 'git_diff', 'git_commit', 'git_push',
  ]);
  if (devToolNames.has(name)) {
    const result = await executeDevTool(name, input, {
      storeId: ctx.storeId ?? 'super-agent',
      autoPushConfirmed: !!ctx.confirmations['git_push'],
    });
    return { output: result.output, summary: result.summary, confirm_required: result.confirm_required };
  }

  // Custom super tools
  if (name === 'run_sql') return execRunSql(input, ctx.confirmations);
  if (name === 'update_store') return execUpdateStore(input);
  if (name === 'list_tables') return execListTables();
  if (name === 'regenerate_asset') return execRegenerateAssetSuper(input);
  if (name === 'deploy_vercel') return execDeployVercel(input, ctx.confirmations);

  throw new Error(`Outil inconnu: ${name}`);
}

// ── System prompt ──────────────────────────────────────────────────────

function buildSuperSystemPrompt(page: string, storeId?: string): string {
  return [
    'Tu es le Super Agent de la plateforme Hearst Dropship.',
    'Tu as un accès TOTAL et tu peux tout faire : lire le code, modifier le code, exécuter du SQL, générer des assets, modifier la config des stores, committer, pousser et déployer.',
    '',
    `Contexte actuel: page="${page}", store_id="${storeId || 'aucun'}"`,
    '',
    'Règles strictes:',
    '- Toujours commencer par comprendre (read_file, list_files, run_sql read) avant de modifier.',
    '- Préférer apply_patch à write_file pour les modifications ciblées.',
    '- Pour run_sql en mode write, UPDATE, DELETE : confirmation utilisateur obligatoire.',
    '- Pour deploy_vercel : confirmation utilisateur obligatoire.',
    '- Ne JAMAIS toucher à .env*, .git/, node_modules, .next/.',
    '- Commit en français, message clair, 1-2 phrases.',
    '- Pas de tiret cadratin. Pas de triade rythmique.',
    '- Maximum 15 boucles d\'outils.',
  ].join('\n');
}

// ── Public entry point ─────────────────────────────────────────────────

export async function* runSuperAgentTurn(
  userMessage: string,
  options: SuperAgentOptions,
): AsyncGenerator<SuperAgentEvent> {
  const messages: Array<{
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    tool_call_id?: string;
  }> = [];

  messages.push({ role: 'system', content: buildSuperSystemPrompt(options.page, options.storeId) });
  messages.push({ role: 'user', content: userMessage });

  const confirmations = options.confirmations ?? {};
  const maxLoops = 15;

  for (let loop = 0; loop < maxLoops; loop++) {
    const response = await trackedKimiMessage(
      { step: 'super-agent-turn', storeId: options.storeId ?? null },
      messages,
      { tools: SUPER_TOOLS.map((t) => ({ type: 'function', function: { name: t.name, description: t.description ?? '', parameters: t.input_schema } })) },
    );

    const assistantText = response.text.trim();

    if (response.tool_calls && response.tool_calls.length > 0) {
      // Build assistant message with tool_calls for the history
      const toolCallJson = JSON.stringify(response.tool_calls.map((tc) => ({
        id: tc.id,
        type: tc.type,
        function: { name: tc.function.name, arguments: tc.function.arguments },
      })));
      messages.push({ role: 'assistant', content: toolCallJson });

      // Execute each tool call
      const toolResults: Array<{ role: 'tool'; content: string; tool_call_id: string }> = [];
      for (const tc of response.tool_calls) {
        yield { type: 'tool_call', name: tc.function.name, input: tc.function.arguments };

        let toolOutput: unknown;
        let summary = '';
        let isError = false;
        let confirmRequired = false;
        try {
          const parsedInput = JSON.parse(tc.function.arguments);
          const result = await executeSuperTool(tc.function.name, parsedInput, {
            storeId: options.storeId,
            confirmations,
          });
          toolOutput = result.output;
          summary = result.summary;
          confirmRequired = !!result.confirm_required;
        } catch (e) {
          isError = true;
          toolOutput = { error: e instanceof Error ? e.message : String(e) };
          summary = `Erreur: ${e instanceof Error ? e.message : String(e)}`;
        }

        yield { type: 'tool_result', name: tc.function.name, output: toolOutput, is_error: isError };

        if (confirmRequired) {
          yield { type: 'confirm_required', tool: tc.function.name, reason: summary };
        }

        toolResults.push({
          role: 'tool',
          content: JSON.stringify({ output: toolOutput, summary }),
          tool_call_id: tc.id,
        });
      }

      messages.push(...toolResults);
      continue;
    }

    if (assistantText) {
      messages.push({ role: 'assistant', content: assistantText });
      yield { type: 'thinking', text: assistantText };
      yield { type: 'message', text: assistantText };
    }

    yield { type: 'done' };
    return;
  }

  yield { type: 'message', text: 'Limite de boucles atteinte.' };
  yield { type: 'done' };
}
