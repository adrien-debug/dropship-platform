/**
 * ComfyUI client. Two backends, one interface, **N deployments per asset**.
 *
 *  - **comfy-deploy** (cloud.comfy.org): managed serverless, hits
 *    api.comfydeploy.com with an API key. Each workflow is a "deployment"
 *    with an ID. Inputs are passed as named slots that the workflow's
 *    ExternalImage / ExternalText nodes pick up.
 *
 *  - **local** (raw ComfyUI): hits /prompt and polls /history. Used when
 *    COMFYUI_URL points to a self-hosted instance (LAN, tunnel, GPU box).
 *
 * Pick by env: COMFY_BACKEND=deploy|local. Default: 'deploy' if
 * COMFY_DEPLOY_API_KEY is set, else 'local' if COMFYUI_URL is set, else
 * generation is skipped silently (the agent falls back to supplier images).
 *
 * ============================================================
 * P1.5 — Round-robin across multiple deployments
 * ============================================================
 *
 * Each `COMFY_DEPLOYMENT_*` env var (HERO, CUTOUT, LIFESTYLE, VIDEO) accepts
 * **either** a single ID **or** a comma-separated list of IDs:
 *
 *   COMFY_DEPLOYMENT_HERO=dep_a                  # legacy, single
 *   COMFY_DEPLOYMENT_HERO=dep_a,dep_b,dep_c      # round-robin across 3
 *
 * A module-level counter per deployment-list rotates picks across calls.
 * The N+1 call uses dep_a again. With N=2 deployments, three parallel
 * stores cost (1 + 1 + 1) ≈ 1× wall-clock instead of 3× — that's the whole
 * point of P1.5: stop the 3rd parallel store from waiting 15 min on the
 * single GPU queue and timing out the SSE.
 *
 * The counter lives in-process (Map<string, number>). On Vercel a cold
 * start resets it to 0. That is acceptable at our volume — what matters is
 * that *within a single Lambda exec* sequential requests fan out, not that
 * the global distribution is strictly even across all containers.
 *
 * ============================================================
 * Per-asset override (e.g. video pinned to one deployment)
 * ============================================================
 *
 * Pass `deploymentIdOverride` to bypass round-robin entirely. Useful when
 * one workflow needs a beefier GPU profile (typical for the 5-second promo
 * video) and we want to pin it to a single specific deployment regardless
 * of the rotation state. The override does *not* increment the counter.
 *
 * The asset-generator only ever calls runWorkflow() — backend choice and
 * deployment selection are invisible above this layer.
 */

export interface WorkflowInputs {
  /** Prompt slot name → value. The workflow defines which slots exist. */
  [key: string]: string | number | boolean;
}

export interface WorkflowResult {
  /** Base64-encoded image bytes if the workflow produced an image. */
  images: Buffer[];
  /** Base64-encoded MP4 if the workflow produced a video. */
  videos: Buffer[];
  /** Run identifier (provider-specific). */
  runId: string;
  /**
   * Deployment that actually ran this workflow. For the local backend this
   * is the literal string 'local'. Surfaced so callers can log to Sentry /
   * `dropship_ai_runs` and audit load distribution across deployments.
   */
  deploymentId: string;
}

export type ComfyBackend = 'deploy' | 'local' | 'none';

function detectBackend(): ComfyBackend {
  if (process.env.COMFY_DEPLOY_API_KEY) return 'deploy';
  if (process.env.COMFYUI_URL) return 'local';
  return 'none';
}

/**
 * Parse a comma-separated env var into a deduplicated, trimmed list of
 * deployment IDs. Empty entries are dropped. Returns [] when the var is
 * unset or whitespace-only.
 *
 * Used both inline and via {@link getDeploymentIds} which adds the
 * legacy single-id env fallback.
 */
function parseIdList(raw: string | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(',')) {
    const id = part.trim();
    if (!id) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Resolve the deployment ID pool for a given env key.
 *
 * Resolution order:
 *  1. `<envKey>` (e.g. `COMFY_DEPLOYMENT_HERO`) — may be a single id or a
 *     comma-separated list. This is the *primary* source; existing single-
 *     value configs keep working transparently.
 *  2. `COMFY_DEPLOYMENT_IDS` — global comma-separated list, used as a
 *     fallback when the per-asset key is empty. Lets you point every
 *     asset at the same pool without setting four env vars.
 *  3. `COMFY_DEPLOYMENT_ID` — legacy single-id global fallback. Kept for
 *     backwards compatibility with the pre-P1.5 env layout.
 *
 * Always returns a deduplicated array. Empty when nothing is configured.
 */
export function getDeploymentIds(envKey?: string): string[] {
  if (envKey) {
    const fromKey = parseIdList(process.env[envKey]);
    if (fromKey.length > 0) return fromKey;
  }
  const fromGlobalList = parseIdList(process.env.COMFY_DEPLOYMENT_IDS);
  if (fromGlobalList.length > 0) return fromGlobalList;
  const legacy = process.env.COMFY_DEPLOYMENT_ID?.trim();
  if (legacy) return [legacy];
  return [];
}

/**
 * `true` when at least one ComfyUI backend is reachable. For the deploy
 * backend that means both an API key *and* at least one deployment ID
 * (either per-asset, global list, or legacy single). For the local
 * backend, the URL alone is enough — the graph is constructed inline.
 */
export function isComfyConfigured(): boolean {
  const backend = detectBackend();
  if (backend === 'none') return false;
  if (backend === 'local') return true;
  // For 'deploy' we need at least one deployment id resolvable from any
  // source (per-asset, global list, legacy single).
  return getDeploymentIds().length > 0;
}

/**
 * Per-pool round-robin counters. Keyed by the joined pool string so two
 * env vars sharing the same id list don't desync. In-process only.
 */
const rrCounters: Map<string, number> = new Map();

/**
 * Pick the next deployment ID from a pool using round-robin. Increments
 * the per-pool counter so successive calls fan out. Pure function w.r.t.
 * `ids` — call ordering is the only side effect.
 *
 * Exported for the unit tests; not meant for direct use by callers.
 */
export function pickRoundRobin(ids: string[]): string {
  if (ids.length === 0) {
    throw new Error('pickRoundRobin: empty deployment pool');
  }
  if (ids.length === 1) return ids[0]!;
  const key = ids.join('|');
  const n = rrCounters.get(key) ?? 0;
  rrCounters.set(key, n + 1);
  return ids[n % ids.length]!;
}

/**
 * Test-only reset of the round-robin counter map. Lets unit tests start
 * from a deterministic state without juggling module-load order.
 */
export function __resetRoundRobinForTests(): void {
  rrCounters.clear();
}

/* ============================================================
 * Comfy Deploy (cloud.comfy.org)
 * ============================================================
 * Docs: https://docs.comfydeploy.com/api-reference/run/queue-run
 *
 * Each workflow you publish there gets a `deployment_id`. Inputs map to the
 * `External*` nodes inside that workflow. We POST to /v2/run/deployment/queue
 * then poll /v2/run/{run_id} until status is "success" or "failed".
 */

const DEPLOY_BASE = process.env.COMFY_DEPLOY_API_URL || 'https://api.comfydeploy.com/api';

interface DeployQueueResponse {
  run_id: string;
}
interface DeployRunStatus {
  id: string;
  status: 'not-started' | 'running' | 'uploading' | 'success' | 'failed' | 'cancelled' | 'timeout';
  outputs?: Array<{
    data?: { images?: Array<{ url: string }>; gifs?: Array<{ url: string }>; files?: Array<{ url: string }> };
  }>;
  error?: string;
}

async function deployRun(deploymentId: string, inputs: WorkflowInputs): Promise<WorkflowResult> {
  const apiKey = process.env.COMFY_DEPLOY_API_KEY;
  if (!apiKey) throw new Error('COMFY_DEPLOY_API_KEY missing');

  const queueRes = await fetch(`${DEPLOY_BASE}/v2/run/deployment/queue`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ deployment_id: deploymentId, inputs }),
  });
  if (!queueRes.ok) {
    throw new Error(`comfy-deploy queue failed: ${queueRes.status} ${await queueRes.text()}`);
  }
  const { run_id: runId } = (await queueRes.json()) as DeployQueueResponse;

  // Poll. Generations take 20-90s for images, 60-180s for videos.
  const start = Date.now();
  const TIMEOUT_MS = 5 * 60_000;
  const POLL_MS = 3_000;

  while (Date.now() - start < TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    const statusRes = await fetch(`${DEPLOY_BASE}/v2/run/${runId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!statusRes.ok) continue;
    const status = (await statusRes.json()) as DeployRunStatus;

    if (status.status === 'success') {
      const images: Buffer[] = [];
      const videos: Buffer[] = [];
      for (const out of status.outputs || []) {
        for (const img of out.data?.images || []) {
          const b = await fetchBinary(img.url);
          if (b) images.push(b);
        }
        for (const vid of out.data?.gifs || []) {
          const b = await fetchBinary(vid.url);
          if (b) videos.push(b);
        }
        for (const f of out.data?.files || []) {
          if (/\.(mp4|webm|mov)(\?|$)/i.test(f.url)) {
            const b = await fetchBinary(f.url);
            if (b) videos.push(b);
          }
        }
      }
      return { images, videos, runId, deploymentId };
    }
    if (status.status === 'failed' || status.status === 'cancelled' || status.status === 'timeout') {
      throw new Error(`comfy-deploy run ${status.status}: ${status.error || 'no detail'}`);
    }
  }
  throw new Error(`comfy-deploy run ${runId} timed out after ${TIMEOUT_MS / 1000}s`);
}

/* ============================================================
 * Local ComfyUI (/prompt + /history + /view)
 * ============================================================
 * Used when you point COMFYUI_URL at a raw ComfyUI server. Inputs is a full
 * graph (`prompt` JSON in ComfyUI parlance) — the asset-generator builds it
 * from a workflow template + the dynamic prompt/image_url.
 */

interface LocalQueueResponse {
  prompt_id: string;
}

async function localRun(graph: object): Promise<WorkflowResult> {
  const base = (process.env.COMFYUI_URL || '').replace(/\/$/, '');
  if (!base) throw new Error('COMFYUI_URL missing');

  const queueRes = await fetch(`${base}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: graph }),
  });
  if (!queueRes.ok) {
    throw new Error(`local comfy queue failed: ${queueRes.status} ${await queueRes.text()}`);
  }
  const { prompt_id: promptId } = (await queueRes.json()) as LocalQueueResponse;

  const start = Date.now();
  const TIMEOUT_MS = 5 * 60_000;
  const POLL_MS = 2_000;

  while (Date.now() - start < TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    const histRes = await fetch(`${base}/history/${promptId}`);
    if (!histRes.ok) continue;
    const hist = (await histRes.json()) as Record<string, {
      outputs?: Record<string, { images?: Array<{ filename: string; subfolder: string; type: string }>; gifs?: Array<{ filename: string; subfolder: string; type: string }> }>;
      status?: { status_str?: string; completed?: boolean };
    }>;
    const entry = hist[promptId];
    if (!entry || !entry.status?.completed) continue;

    if (entry.status.status_str !== 'success') {
      throw new Error(`local comfy run failed: ${entry.status.status_str}`);
    }

    const images: Buffer[] = [];
    const videos: Buffer[] = [];
    for (const node of Object.values(entry.outputs || {})) {
      for (const img of node.images || []) {
        const url = `${base}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder)}&type=${encodeURIComponent(img.type)}`;
        const b = await fetchBinary(url);
        if (b) images.push(b);
      }
      for (const gif of node.gifs || []) {
        const url = `${base}/view?filename=${encodeURIComponent(gif.filename)}&subfolder=${encodeURIComponent(gif.subfolder)}&type=${encodeURIComponent(gif.type)}`;
        const b = await fetchBinary(url);
        if (b) videos.push(b);
      }
    }
    return { images, videos, runId: promptId, deploymentId: 'local' };
  }
  throw new Error(`local comfy run ${promptId} timed out after ${TIMEOUT_MS / 1000}s`);
}

async function fetchBinary(url: string): Promise<Buffer | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return Buffer.from(await r.arrayBuffer());
  } catch {
    return null;
  }
}

/* ============================================================
 * Public surface
 * ============================================================ */

export interface RunOptions {
  /**
   * Deploy backend: deployment id(s). Accepts a single string (legacy, for
   * one-deployment configs) or an array (round-robin pool).
   *
   * When omitted, falls back to {@link getDeploymentIds} with no envKey,
   * which reads `COMFY_DEPLOYMENT_IDS` then legacy `COMFY_DEPLOYMENT_ID`.
   */
  deploymentId?: string | string[];
  /**
   * Bypass round-robin and force a specific deployment id. Use this for
   * the video workflow if you want it pinned to one specific GPU profile.
   * Does not advance the round-robin counter.
   */
  deploymentIdOverride?: string;
  /** Local backend: full ComfyUI graph (prompt JSON). */
  graph?: object;
  /** Deploy backend: input slot map. */
  inputs?: WorkflowInputs;
}

export async function runWorkflow(opts: RunOptions): Promise<WorkflowResult> {
  const backend = detectBackend();
  if (backend === 'deploy') {
    // Resolve the pool: explicit override > opts.deploymentId list > env.
    let chosen: string | null = null;
    if (opts.deploymentIdOverride) {
      chosen = opts.deploymentIdOverride.trim();
    } else if (Array.isArray(opts.deploymentId)) {
      const pool = parseIdList(opts.deploymentId.join(','));
      if (pool.length > 0) chosen = pickRoundRobin(pool);
    } else if (typeof opts.deploymentId === 'string') {
      // Single string may itself be comma-separated (env passthrough case).
      const pool = parseIdList(opts.deploymentId);
      if (pool.length > 0) chosen = pickRoundRobin(pool);
    } else {
      const pool = getDeploymentIds();
      if (pool.length > 0) chosen = pickRoundRobin(pool);
    }
    if (!chosen) throw new Error('deploymentId required for comfy-deploy backend');
    return deployRun(chosen, opts.inputs || {});
  }
  if (backend === 'local') {
    if (!opts.graph) throw new Error('graph required for local comfy backend');
    return localRun(opts.graph);
  }
  throw new Error('No ComfyUI backend configured (set COMFY_DEPLOY_API_KEY or COMFYUI_URL)');
}
