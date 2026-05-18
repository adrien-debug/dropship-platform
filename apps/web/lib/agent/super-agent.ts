/**
 * Super Agent — universal omnipresent copilot.
 *
 * Goal: one agent that can do EVERYTHING on the platform:
 *   - read/write source code (dev-copilot tools)
 *   - query/mutate the database (run_sql, update_store, delete_store)
 *   - regenerate assets and diagnose backend wiring
 *   - call Medusa Admin API directly
 *   - trigger GitHub Actions workflows
 *   - commit, push and deploy
 *
 * It reuses existing tool executors (dev-copilot, asset-regenerator) and adds
 * platform-wide ones (sql, store CRUD, medusa, github). The loop is Kimi-powered
 * because the user explicitly asked for Kimi as the main brain.
 *
 * Safety model:
 *   - Read-only SQL by default; writes need confirmation
 *   - Hard-delete on stores needs confirmation (FK cascade is automatic)
 *   - Medusa write methods (POST/PUT/DELETE) need confirmation
 *   - git_push and deploy_vercel need confirmation
 *   - Path traversal blocked (inherited from dev-copilot)
 *   - .env* and .git/ writes blocked (inherited from dev-copilot)
 *   - Confirmation wildcard: `confirmations['*'] === true` clears every gate
 *     for the next turn (used by the UI's one-click "Confirmer" button).
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
import { isComfyConfigured, getDeploymentIds } from './comfy-client';
import { isFalConfigured } from './fal-client';
import { getMedusaBaseUrl, getMedusaAuthMode, medusa } from '@/lib/medusa';

// ── Public types ────────────────────────────────────────────────────────

export type SuperAgentEvent =
  | { type: 'session'; sessionId: string }
  | { type: 'thinking'; text: string }
  | { type: 'tool_call'; name: string; input: unknown }
  | { type: 'tool_result'; name: string; output: unknown; is_error: boolean }
  | { type: 'confirm_required'; tool: string; reason: string; confirmKey: string }
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
  /**
   * Persistent session id (dropship_copilot_sessions.id, mode='super'). The
   * API route is responsible for creating one on first call; reload turns
   * pass the same id back to chain context.
   */
  sessionId?: string;
}

// ── Persistence (reuses dropship_copilot_sessions/messages, mode='super') ─

interface StoredSuperMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  tool_name: string | null;
  tool_input: unknown;
  tool_output: unknown;
  created_at: string;
}

/**
 * Create a new persistent session for the Super Agent. Returns its id.
 * `storeId` may be null when the agent is invoked from a page without an
 * active store binding (e.g. /admin root).
 */
export async function createSuperAgentSession(
  storeId: string | null,
  title?: string | null,
): Promise<string> {
  const db = getDb();
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO dropship_copilot_sessions (store_id, mode, title)
     VALUES ($1, 'super', $2)
     RETURNING id`,
    [storeId, title?.slice(0, 80) ?? null],
  );
  return rows[0]!.id;
}

async function loadSuperHistory(sessionId: string): Promise<StoredSuperMessage[]> {
  const db = getDb();
  const { rows } = await db.query<StoredSuperMessage>(
    `SELECT id, role, content, tool_name, tool_input, tool_output, created_at
       FROM dropship_copilot_messages
       WHERE session_id = $1
       ORDER BY created_at ASC, id ASC`,
    [sessionId],
  );
  return rows;
}

async function persistSuperMessage(
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

async function maybeBackfillSuperTitle(
  sessionId: string,
  firstUserMessage: string,
): Promise<void> {
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

// ── Confirmation helper ────────────────────────────────────────────────

/**
 * Returns true when the operator has explicitly confirmed `key`, or when the
 * wildcard `'*'` flag has been set (one-click "Confirmer" button in the UI).
 */
function isConfirmed(confirmations: Record<string, boolean>, key: string): boolean {
  return confirmations[key] === true || confirmations['*'] === true;
}

// ── Editable column whitelist for update_store ─────────────────────────

const UPDATABLE_COLUMNS = [
  'name',
  'slug',
  'niche',
  'tagline',
  'description',
  'status',
  'mode',
  'template',
  'design_preset',
  'primary_color',
  'secondary_color',
  'accent_color',
  'logo_emoji',
  'landing_content',
  'palette',
  'custom_domain',
  'hero_image_url',
  'cutout_image_url',
  'lifestyle_images',
  'promo_video_url',
  'error_message',
  'assets_status',
  'assets_run_id',
  'product_count',
  'ga4_measurement_id',
  'meta_pixel_id',
  'tiktok_pixel_id',
  'clarity_id',
  'google_ads_customer_id',
  'google_ads_conversion_action',
  'google_merchant_id',
] as const;

// Columns expected to hold JSON; we cast them to ::jsonb in the UPDATE so the
// agent can pass a stringified payload without crafting a separate SQL query.
const JSON_COLUMNS = new Set(['landing_content', 'palette', 'lifestyle_images']);

// ── Tool definitions ───────────────────────────────────────────────────

const ASSET_KIND_TUPLE = [...ASSET_KINDS] as [AssetKind, ...AssetKind[]];
const UPDATABLE_TUPLE = [...UPDATABLE_COLUMNS] as [string, ...string[]];

const SUPER_TOOLS: Anthropic.Messages.Tool[] = [
  ...DEV_TOOLS,
  {
    name: 'run_sql',
    description:
      'Exécute une requête SQL sur la base Postgres. Par défaut lecture seule (SELECT). Pour INSERT/UPDATE/DELETE, l\'outil retourne une demande de confirmation que l\'opérateur doit approuver avant exécution. Si une lecture est refusée par le garde-fou lecture seule, relance en mode=write (confirmation opérateur requise).',
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
    name: 'list_tables',
    description: 'Liste les tables de la base avec leur nombre de lignes approximatif.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'update_store',
    description:
      'Met à jour une colonne de dropship_stores pour un store donné. Une seule colonne par appel pour la traçabilité. Les colonnes JSON (landing_content, palette, lifestyle_images) acceptent une valeur stringifiée.',
    input_schema: {
      type: 'object',
      properties: {
        store_id: { type: 'string', description: 'UUID du store.' },
        column: {
          type: 'string',
          enum: UPDATABLE_TUPLE,
          description: 'Colonne à modifier (whitelist).',
        },
        value: {
          type: 'string',
          description: 'Nouvelle valeur. Pour les colonnes JSON, fournir une string JSON valide. Pour effacer, passer la chaîne vide ou "null".',
        },
      },
      required: ['store_id', 'column', 'value'],
    },
  },
  {
    name: 'delete_store',
    description:
      'Supprime un store et toutes ses données dépendantes (produits, sessions copilote, asset runs, ad variants, etc. — cascade FK). Les commandes (order_forwards) et les runs AI sont préservés (ON DELETE SET NULL). Nécessite confirmation. Option `also_medusa` pour aussi supprimer le sales_channel + publishable key Medusa associés.',
    input_schema: {
      type: 'object',
      properties: {
        store_id: { type: 'string', description: 'UUID du store à supprimer.' },
        also_medusa: {
          type: 'boolean',
          description: 'Si true, supprime aussi le sales_channel Medusa lié (et l\'API key publique). Défaut: false.',
        },
      },
      required: ['store_id'],
    },
  },
  {
    name: 'delete_stores_bulk',
    description:
      'Supprime plusieurs stores d\'un coup (max 50). Cascade FK comme delete_store. Nécessite UNE confirmation pour tout le batch. Utile pour purger les doublons après un test de masse.',
    input_schema: {
      type: 'object',
      properties: {
        store_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Liste d\'UUIDs (1..50).',
        },
        also_medusa: { type: 'boolean', description: 'Idem delete_store.' },
      },
      required: ['store_ids'],
    },
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
    name: 'diagnose_assets',
    description:
      'Diagnostic du pipeline de génération d\'assets : quels backends sont configurés (ComfyUI Deploy, fal.ai, deployment IDs), et liste les 5 dernières erreurs `dropship_asset_runs.error_message`. À lancer en premier quand un `regenerate_asset` retourne `Forbidden` ou `timed out`.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'medusa_admin',
    description:
      'Appelle un endpoint de l\'API Medusa Admin (Medusa v2). Auth gérée automatiquement (API token ou JWT email/password selon les env vars). Méthodes en écriture (POST/PUT/DELETE) nécessitent confirmation.',
    input_schema: {
      type: 'object',
      properties: {
        method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE'] },
        path: {
          type: 'string',
          description: 'Chemin commençant par /admin/ (ex: /admin/sales-channels, /admin/products/prod_123).',
        },
        body: {
          type: 'object',
          description: 'Corps JSON pour POST/PUT (optionnel).',
        },
        query: {
          type: 'object',
          description: 'Paramètres query pour GET (optionnel).',
        },
      },
      required: ['method', 'path'],
    },
  },
  {
    name: 'trigger_workflow',
    description:
      'Déclenche un GitHub Actions workflow sur le repo Hearst/dropship-platform via repository_dispatch ou workflow_dispatch. Nécessite GITHUB_TOKEN avec scope `repo` (et `workflow`). Confirmation requise.',
    input_schema: {
      type: 'object',
      properties: {
        workflow: {
          type: 'string',
          description: 'Nom du fichier workflow (ex: medusa-warmup.yml, ae-token-refresh.yml).',
        },
        ref: { type: 'string', description: 'Branche / tag (défaut: main).' },
        inputs: {
          type: 'object',
          description: 'Inputs du workflow (optionnel, dépend du workflow).',
        },
      },
      required: ['workflow'],
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

interface ExecResult {
  output: unknown;
  summary: string;
  /** When set, the UI must surface a confirm button echoing this key back. */
  confirm_required?: boolean;
  confirm_key?: string;
}

// SQL keywords that indicate a data-modifying statement. REPLACE/DO/COPY/CALL
// are intentionally omitted: the first-keyword gate (SELECT/WITH only) already
// blocks them as statement starters, and inside a SELECT they produce
// false-positives (e.g. replace() is a valid Postgres read function).
const WRITE_KEYWORDS = [
  'INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'TRUNCATE', 'CREATE',
  'GRANT', 'REVOKE', 'MERGE', 'VACUUM', 'REINDEX',
] as const;

/**
 * Validates that a SQL query is strictly read-only (SELECT or WITH…SELECT).
 *
 * Returns null when the query is allowed, or an error message string when it
 * must be rejected. Designed as a pure function so it is easily unit-testable.
 *
 * Rules:
 * - Strip leading SQL block/line comments and whitespace before inspecting.
 * - First keyword must be SELECT or WITH.
 * - No data-modifying statement keywords (see WRITE_KEYWORDS) may appear at a
 *   word boundary anywhere in the query.
 * - At most one statement: rejects queries containing `;` followed by any
 *   non-whitespace (i.e. a trailing `;` alone is fine).
 * - WITH CTEs that contain a data-modifying sub-statement (e.g. WITH x AS
 *   (DELETE … RETURNING …)) are rejected by the keyword scan above.
 *
 * Keyword matching is word-boundary-based and case-insensitive to avoid false
 * positives on column names like `updated_at` or string literals. Being
 * slightly conservative (occasionally rejecting an exotic-but-valid read query)
 * is acceptable — the operator can always use mode=write with confirmation.
 */
export function assertReadOnlySql(query: string): string | null {
  // Iteratively strip leading whitespace and comments so we reach the first
  // real token regardless of comment nesting depth.
  let stripped = query;
  let prev = '';
  while (prev !== stripped) {
    prev = stripped;
    stripped = stripped.replace(/^\s+/, '');
    stripped = stripped.replace(/^--[^\n]*\n?/, '');
    stripped = stripped.replace(/^\/\*[\s\S]*?\*\//, '');
  }

  const firstWord = (stripped.match(/^([A-Za-z_]+)/) ?? [])[1]?.toUpperCase();
  if (firstWord !== 'SELECT' && firstWord !== 'WITH') {
    return `run_sql mode=read rejeté : le premier mot-clé doit être SELECT ou WITH (trouvé : "${firstWord ?? '(vide)'}"). Utilisez mode=write pour les requêtes de modification.`;
  }

  if (/;[ \t\r\n]*\S/.test(query)) {
    return 'run_sql mode=read rejeté : plusieurs instructions (;) détectées. Une seule requête SELECT est autorisée par appel.';
  }

  // \b word-boundary anchors ensure "updated_at" does not trigger "UPDATE".
  for (const kw of WRITE_KEYWORDS) {
    const re = new RegExp(`\\b${kw}\\b`, 'i');
    if (re.test(query)) {
      return `run_sql mode=read rejeté : mot-clé de modification "${kw}" détecté. Utilisez mode=write pour les requêtes de modification.`;
    }
  }

  return null;
}

export async function execRunSql(
  input: unknown,
  confirmations: Record<string, boolean>,
): Promise<ExecResult> {
  const schema = z.object({
    query: z.string().min(1),
    mode: z.enum(['read', 'write']),
    params: z.array(z.string()).optional(),
  });
  const { query, mode, params } = schema.parse(input);

  if (mode === 'read') {
    const err = assertReadOnlySql(query);
    if (err !== null) {
      throw new Error(err);
    }
  }

  if (mode === 'write') {
    const confirmKey = `sql:${query.slice(0, 40)}`;
    if (!isConfirmed(confirmations, confirmKey)) {
      return {
        output: { confirmKey, query: query.slice(0, 200) },
        summary: 'run_sql write — confirmation requise',
        confirm_required: true,
        confirm_key: confirmKey,
      };
    }
    console.info('[super-agent SQL write]', JSON.stringify({ query, params: params ?? [], timestamp: new Date().toISOString() }));
  }

  const db = getDb();
  const { rows } = await db.query(query, params ?? []);
  return {
    output: { rows, count: rows.length },
    summary: `run_sql ${mode} — ${rows.length} ligne(s)`,
  };
}

async function execUpdateStore(input: unknown): Promise<ExecResult> {
  const schema = z.object({
    store_id: z.string().uuid(),
    column: z.string(),
    value: z.string(),
  });
  const { store_id, column, value } = schema.parse(input);

  if (!(UPDATABLE_COLUMNS as readonly string[]).includes(column)) {
    throw new Error(`Colonne non autorisée: ${column}`);
  }

  const isJson = JSON_COLUMNS.has(column);
  const isNullable = value === '' || value === 'null';

  const db = getDb();
  if (isNullable) {
    await db.query(`UPDATE dropship_stores SET ${column} = NULL, updated_at = now() WHERE id = $1`, [
      store_id,
    ]);
  } else if (isJson) {
    // Validate JSON before sending — fail loudly rather than crashing Postgres.
    try {
      JSON.parse(value);
    } catch {
      throw new Error(`Colonne JSON ${column}: valeur non JSON valide.`);
    }
    await db.query(
      `UPDATE dropship_stores SET ${column} = $1::jsonb, updated_at = now() WHERE id = $2`,
      [value, store_id],
    );
  } else {
    await db.query(`UPDATE dropship_stores SET ${column} = $1, updated_at = now() WHERE id = $2`, [
      value,
      store_id,
    ]);
  }
  return { output: { store_id, column, value: isNullable ? null : value }, summary: `update_store ${column}` };
}

async function execListTables(): Promise<ExecResult> {
  const db = getDb();
  const { rows } = await db.query(`
    SELECT relname AS table, n_live_tup AS approx_rows
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
    ORDER BY n_live_tup DESC
  `);
  return { output: { tables: rows }, summary: `list_tables — ${rows.length} tables` };
}

async function execDeleteStore(
  input: unknown,
  confirmations: Record<string, boolean>,
): Promise<ExecResult> {
  const schema = z.object({
    store_id: z.string().uuid(),
    also_medusa: z.boolean().optional().default(false),
  });
  const { store_id, also_medusa } = schema.parse(input);

  const confirmKey = `delete_store:${store_id}`;
  if (!isConfirmed(confirmations, confirmKey)) {
    return {
      output: { store_id, also_medusa, confirmKey },
      summary: 'delete_store — confirmation requise',
      confirm_required: true,
      confirm_key: confirmKey,
    };
  }

  const db = getDb();
  // Capture Medusa refs BEFORE deletion in case we also need to clean Medusa.
  const { rows: pre } = await db.query<{
    medusa_sales_channel_id: string | null;
    medusa_publishable_key: string | null;
    name: string | null;
  }>(
    `SELECT medusa_sales_channel_id, medusa_publishable_key, name
       FROM dropship_stores WHERE id = $1`,
    [store_id],
  );
  if (pre.length === 0) {
    throw new Error(`Store ${store_id} introuvable`);
  }
  const ref = pre[0]!;

  await db.query(`DELETE FROM dropship_stores WHERE id = $1`, [store_id]);

  const medusaResult: { sales_channel?: string; api_key?: string; errors: string[] } = { errors: [] };
  if (also_medusa) {
    if (ref.medusa_sales_channel_id) {
      try {
        await callMedusaAdmin('DELETE', `/admin/sales-channels/${ref.medusa_sales_channel_id}`);
        medusaResult.sales_channel = ref.medusa_sales_channel_id;
      } catch (e) {
        medusaResult.errors.push(`sales_channel: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    // Note: Medusa v2 API keys are managed via /admin/api-keys/{id}; the
    // publishable key value isn't the id. We only have the value stored, so
    // we surface this limitation rather than guess.
    if (ref.medusa_publishable_key) {
      medusaResult.errors.push('publishable_key: id introuvable depuis la valeur seule (utilise medusa_admin GET /admin/api-keys puis DELETE par id).');
    }
  }

  return {
    output: { store_id, name: ref.name, deleted: true, medusa: also_medusa ? medusaResult : null },
    summary: `delete_store ${ref.name ?? store_id}${also_medusa ? ' (+ medusa)' : ''}`,
  };
}

async function execDeleteStoresBulk(
  input: unknown,
  confirmations: Record<string, boolean>,
): Promise<ExecResult> {
  const schema = z.object({
    store_ids: z.array(z.string().uuid()).min(1).max(50),
    also_medusa: z.boolean().optional().default(false),
  });
  const { store_ids, also_medusa } = schema.parse(input);

  // One confirm key per batch — hashed from the sorted ids so duplicate calls
  // share the same gate.
  const batchKey = store_ids.slice().sort().join(',').slice(0, 40);
  const confirmKey = `delete_stores_bulk:${batchKey}`;
  if (!isConfirmed(confirmations, confirmKey)) {
    return {
      output: { store_ids, also_medusa, confirmKey, count: store_ids.length },
      summary: `delete_stores_bulk (${store_ids.length}) — confirmation requise`,
      confirm_required: true,
      confirm_key: confirmKey,
    };
  }

  const db = getDb();
  const { rows: refs } = await db.query<{
    id: string;
    medusa_sales_channel_id: string | null;
    name: string | null;
  }>(
    `SELECT id, medusa_sales_channel_id, name
       FROM dropship_stores WHERE id = ANY($1::uuid[])`,
    [store_ids],
  );
  const { rowCount } = await db.query(
    `DELETE FROM dropship_stores WHERE id = ANY($1::uuid[])`,
    [store_ids],
  );

  const medusaErrors: string[] = [];
  let medusaDeleted = 0;
  if (also_medusa) {
    for (const r of refs) {
      if (!r.medusa_sales_channel_id) continue;
      try {
        await callMedusaAdmin('DELETE', `/admin/sales-channels/${r.medusa_sales_channel_id}`);
        medusaDeleted += 1;
      } catch (e) {
        medusaErrors.push(`${r.name ?? r.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  return {
    output: {
      requested: store_ids.length,
      deleted: rowCount,
      missing: store_ids.length - refs.length,
      medusa: also_medusa ? { deleted: medusaDeleted, errors: medusaErrors } : null,
    },
    summary: `delete_stores_bulk — ${rowCount}/${store_ids.length} supprimés`,
  };
}

async function execRegenerateAssetSuper(input: unknown): Promise<ExecResult> {
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

async function execDiagnoseAssets(): Promise<ExecResult> {
  const comfyConfigured = isComfyConfigured();
  const falConfigured = isFalConfigured();
  const deploymentIds = getDeploymentIds();
  const perAsset = {
    hero: process.env.COMFY_DEPLOYMENT_HERO ? 'set' : 'missing',
    cutout: process.env.COMFY_DEPLOYMENT_CUTOUT ? 'set' : 'missing',
    lifestyle: process.env.COMFY_DEPLOYMENT_LIFESTYLE ? 'set' : 'missing',
    video: process.env.COMFY_DEPLOYMENT_VIDEO ? 'set' : 'missing',
  };

  const db = getDb();
  const { rows: lastErrors } = await db.query<{
    id: string;
    store_id: string;
    asset_kind: string;
    error_message: string | null;
    created_at: string;
  }>(
    `SELECT id, store_id, asset_kind, error_message, created_at
       FROM dropship_asset_runs
      WHERE status = 'error'
      ORDER BY created_at DESC
      LIMIT 5`,
  );

  return {
    output: {
      backends: {
        comfy_configured: comfyConfigured,
        comfy_deploy_api_key: process.env.COMFY_DEPLOY_API_KEY ? 'set' : 'missing',
        comfy_url: process.env.COMFYUI_URL ? 'set' : 'missing',
        fal_configured: falConfigured,
        fal_key: process.env.FAL_KEY ? 'set' : 'missing',
      },
      comfy_deployments: { ids_resolved: deploymentIds, per_asset: perAsset },
      last_errors: lastErrors,
    },
    summary: `diagnose_assets — comfy=${comfyConfigured ? 'on' : 'off'}, fal=${falConfigured ? 'on' : 'off'}, errors=${lastErrors.length}`,
  };
}

/**
 * Generic Medusa Admin call. Picks auth mode based on env, runs the fetch,
 * surfaces any non-2xx as a thrown error with the response body.
 */
async function callMedusaAdmin(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
  query?: Record<string, unknown>,
): Promise<unknown> {
  const base = getMedusaBaseUrl();
  if (!base) throw new Error('MEDUSA_URL non configuré.');
  const authMode = getMedusaAuthMode();
  if (authMode === 'missing') {
    throw new Error('Medusa auth manquante (MEDUSA_ADMIN_API_TOKEN ou MEDUSA_ADMIN_EMAIL + MEDUSA_ADMIN_PASSWORD).');
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authMode === 'api_token') {
    headers['x-medusa-access-token'] = process.env.MEDUSA_ADMIN_API_TOKEN!.trim();
  } else {
    const jwt = await medusa.authenticateJwt();
    headers['Authorization'] = `Bearer ${jwt}`;
  }

  let url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  if (query && Object.keys(query).length > 0) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      params.set(k, typeof v === 'string' ? v : JSON.stringify(v));
    }
    url += `?${params.toString()}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  let parsed: unknown = text;
  try { parsed = JSON.parse(text); } catch { /* keep as text */ }
  if (!res.ok) {
    throw new Error(`Medusa ${method} ${path} → ${res.status}: ${text.slice(0, 280)}`);
  }
  return parsed;
}

async function execMedusaAdmin(
  input: unknown,
  confirmations: Record<string, boolean>,
): Promise<ExecResult> {
  const schema = z.object({
    method: z.enum(['GET', 'POST', 'PUT', 'DELETE']),
    path: z.string().min(1),
    body: z.unknown().optional(),
    query: z.record(z.unknown()).optional(),
  });
  const { method, path, body, query } = schema.parse(input);

  if (method !== 'GET') {
    const confirmKey = `medusa:${method}:${path.slice(0, 60)}`;
    if (!isConfirmed(confirmations, confirmKey)) {
      return {
        output: { confirmKey, method, path, body, query },
        summary: `medusa_admin ${method} ${path} — confirmation requise`,
        confirm_required: true,
        confirm_key: confirmKey,
      };
    }
  }

  const data = await callMedusaAdmin(method, path, body, query as Record<string, unknown> | undefined);
  return {
    output: data,
    summary: `medusa_admin ${method} ${path}`,
  };
}

async function execTriggerWorkflow(
  input: unknown,
  confirmations: Record<string, boolean>,
): Promise<ExecResult> {
  const schema = z.object({
    workflow: z.string().min(1),
    ref: z.string().optional().default('main'),
    inputs: z.record(z.unknown()).optional(),
  });
  const { workflow, ref, inputs } = schema.parse(input);

  const confirmKey = `trigger_workflow:${workflow}`;
  if (!isConfirmed(confirmations, confirmKey)) {
    return {
      output: { confirmKey, workflow, ref, inputs },
      summary: `trigger_workflow ${workflow} — confirmation requise`,
      confirm_required: true,
      confirm_key: confirmKey,
    };
  }

  const token = (process.env.GITHUB_TOKEN || process.env.GITHUB_PAT || '').trim();
  if (!token) {
    throw new Error('GITHUB_TOKEN (ou GITHUB_PAT) requis pour trigger_workflow.');
  }
  const repo = (process.env.GITHUB_REPO || 'Hearst/dropship-platform').trim();

  const url = `https://api.github.com/repos/${repo}/actions/workflows/${encodeURIComponent(workflow)}/dispatches`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ref, inputs: inputs ?? {} }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub dispatch ${workflow} → ${res.status}: ${text.slice(0, 280)}`);
  }
  return {
    output: { workflow, ref, inputs: inputs ?? {}, dispatched: true, repo },
    summary: `trigger_workflow ${workflow} (ref=${ref})`,
  };
}

async function execDeployVercel(
  input: unknown,
  confirmations: Record<string, boolean>,
): Promise<ExecResult> {
  const schema = z.object({ commit_message: z.string().min(3) });
  const { commit_message } = schema.parse(input);

  const confirmKey = 'deploy_vercel';
  if (!isConfirmed(confirmations, confirmKey)) {
    return {
      output: { reason: 'Déploiement production — confirmation requise' },
      summary: 'deploy_vercel — confirmation requise',
      confirm_required: true,
      confirm_key: confirmKey,
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

const DEV_TOOL_NAMES = new Set([
  'read_file', 'list_files', 'search_code', 'write_file', 'apply_patch',
  'run_bash', 'git_status', 'git_diff', 'git_commit', 'git_push',
]);

async function executeSuperTool(
  name: string,
  input: unknown,
  ctx: { storeId?: string; confirmations: Record<string, boolean> },
): Promise<ExecResult> {
  if (DEV_TOOL_NAMES.has(name)) {
    const result = await executeDevTool(name, input, {
      storeId: ctx.storeId ?? 'super-agent',
      autoPushConfirmed: isConfirmed(ctx.confirmations, 'git_push'),
    });
    return {
      output: result.output,
      summary: result.summary,
      confirm_required: result.confirm_required,
      confirm_key: result.confirm_required ? 'git_push' : undefined,
    };
  }

  switch (name) {
    case 'run_sql': return execRunSql(input, ctx.confirmations);
    case 'list_tables': return execListTables();
    case 'update_store': return execUpdateStore(input);
    case 'delete_store': return execDeleteStore(input, ctx.confirmations);
    case 'delete_stores_bulk': return execDeleteStoresBulk(input, ctx.confirmations);
    case 'regenerate_asset': return execRegenerateAssetSuper(input);
    case 'diagnose_assets': return execDiagnoseAssets();
    case 'medusa_admin': return execMedusaAdmin(input, ctx.confirmations);
    case 'trigger_workflow': return execTriggerWorkflow(input, ctx.confirmations);
    case 'deploy_vercel': return execDeployVercel(input, ctx.confirmations);
  }

  throw new Error(`Outil inconnu: ${name}`);
}

// ── System prompt ──────────────────────────────────────────────────────

function buildSuperSystemPrompt(page: string, storeId?: string): string {
  return [
    'Tu es le Super Agent de la plateforme Hearst Dropship.',
    'Tu as un accès TOTAL : lire/modifier le code, exécuter du SQL (read + write), supprimer ou modifier des stores, appeler l\'API Medusa Admin, déclencher des workflows GitHub, régénérer des assets, committer, pousser et déployer.',
    '',
    `Contexte actuel: page="${page}", store_id="${storeId || 'aucun'}"`,
    '',
    'Outils sensibles et confirmations:',
    '- run_sql mode=write : confirmation utilisateur obligatoire (clé `sql:<début_query>`).',
    '- delete_store / delete_stores_bulk : confirmation obligatoire (clé `delete_store:<id>` ou `delete_stores_bulk:<hash>`).',
    '- medusa_admin POST/PUT/DELETE : confirmation obligatoire.',
    '- trigger_workflow : confirmation obligatoire.',
    '- git_push : confirmation obligatoire (clé `git_push`).',
    '- deploy_vercel : confirmation obligatoire (clé `deploy_vercel`).',
    '- Le bouton "Confirmer" de l\'UI envoie soit la clé précise reçue, soit le wildcard `*` (le wildcard libère tout pour le tour suivant).',
    '',
    'Méthode de travail:',
    '- Toujours comprendre avant de modifier : read_file, list_files, run_sql read, list_tables, diagnose_assets.',
    '- Pour les bugs d\'assets (`Forbidden`, `timed out`), lance diagnose_assets EN PREMIER.',
    '- Préférer apply_patch à write_file pour les modifications ciblées.',
    '- Ne JAMAIS toucher à .env*, .git/, node_modules, .next/.',
    '- Commit en français, message clair, 1-2 phrases. Pas de tiret cadratin. Pas de triade rythmique.',
    '- Maximum 15 boucles d\'outils par tour.',
    '- Quand un outil retourne `confirm_required`, surface clairement à l\'utilisateur ce que tu vas faire et attends sa validation. Ne re-tente pas l\'outil dans le même tour sans confirmation.',
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

  // Hydrate the conversation with prior user/assistant turns when resuming a
  // session. Tool messages are intentionally collapsed into a short marker —
  // their raw inputs/outputs stay in the DB for the UI history strip but
  // would otherwise blow up the token budget on every turn.
  if (options.sessionId) {
    try {
      const history = await loadSuperHistory(options.sessionId);
      for (const m of history) {
        if (m.role === 'user' || m.role === 'assistant') {
          if (m.content.trim().length > 0) {
            messages.push({ role: m.role, content: m.content });
          }
        } else if (m.role === 'tool' && m.tool_name) {
          messages.push({
            role: 'assistant',
            content: `[Outil précédent: ${m.tool_name}] ${m.content.slice(0, 200)}`,
          });
        }
      }
    } catch (e) {
      // Don't fail the turn just because history load broke — log and proceed
      // with the fresh user message only.
      console.error('[super-agent] loadHistory failed', e);
    }
  }

  messages.push({ role: 'user', content: userMessage });

  // Persist the user turn + backfill title if first message of the session.
  if (options.sessionId) {
    try {
      await persistSuperMessage(options.sessionId, { role: 'user', content: userMessage });
      await maybeBackfillSuperTitle(options.sessionId, userMessage);
    } catch (e) {
      console.error('[super-agent] persist user failed', e);
    }
  }

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
      const toolCallJson = JSON.stringify(response.tool_calls.map((tc) => ({
        id: tc.id,
        type: tc.type,
        function: { name: tc.function.name, arguments: tc.function.arguments },
      })));
      messages.push({ role: 'assistant', content: toolCallJson });

      const toolResults: Array<{ role: 'tool'; content: string; tool_call_id: string }> = [];
      for (const tc of response.tool_calls) {
        yield { type: 'tool_call', name: tc.function.name, input: tc.function.arguments };

        let toolOutput: unknown;
        let summary = '';
        let isError = false;
        let confirmRequired = false;
        let confirmKey: string | undefined;
        try {
          const parsedInput = JSON.parse(tc.function.arguments);
          const result = await executeSuperTool(tc.function.name, parsedInput, {
            storeId: options.storeId,
            confirmations,
          });
          toolOutput = result.output;
          summary = result.summary;
          confirmRequired = !!result.confirm_required;
          confirmKey = result.confirm_key;
        } catch (e) {
          isError = true;
          toolOutput = { error: e instanceof Error ? e.message : String(e) };
          summary = `Erreur: ${e instanceof Error ? e.message : String(e)}`;
        }

        yield { type: 'tool_result', name: tc.function.name, output: toolOutput, is_error: isError };

        if (confirmRequired) {
          yield {
            type: 'confirm_required',
            tool: tc.function.name,
            reason: summary,
            confirmKey: confirmKey ?? '*',
          };
        }

        // Persist the combined tool call+result as a single 'tool' row. The
        // raw input/output stay queryable for the UI history; `content` is
        // the human-readable summary the agent saw in its loop.
        if (options.sessionId) {
          try {
            let parsedInput: unknown;
            try { parsedInput = JSON.parse(tc.function.arguments); } catch { parsedInput = tc.function.arguments; }
            await persistSuperMessage(options.sessionId, {
              role: 'tool',
              content: summary || (isError ? 'error' : 'ok'),
              toolName: tc.function.name,
              toolInput: parsedInput,
              toolOutput,
            });
          } catch (e) {
            console.error('[super-agent] persist tool failed', e);
          }
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
      if (options.sessionId) {
        try {
          await persistSuperMessage(options.sessionId, { role: 'assistant', content: assistantText });
        } catch (e) {
          console.error('[super-agent] persist assistant failed', e);
        }
      }
    }

    yield { type: 'done' };
    return;
  }

  yield { type: 'message', text: 'Limite de boucles atteinte.' };
  yield { type: 'done' };
}
