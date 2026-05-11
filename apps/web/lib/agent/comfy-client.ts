/**
 * ComfyUI client. Two backends, one interface.
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
 * The asset-generator only ever calls runWorkflow() — backend choice is
 * invisible above this layer.
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
}

export type ComfyBackend = 'deploy' | 'local' | 'none';

export function detectBackend(): ComfyBackend {
  if (process.env.COMFY_DEPLOY_API_KEY) return 'deploy';
  if (process.env.COMFYUI_URL) return 'local';
  return 'none';
}

export function isComfyConfigured(): boolean {
  return detectBackend() !== 'none';
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
      return { images, videos, runId };
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
    return { images, videos, runId: promptId };
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
  /** Deploy backend: deployment_id from cloud.comfy.org. */
  deploymentId?: string;
  /** Local backend: full ComfyUI graph (prompt JSON). */
  graph?: object;
  /** Deploy backend: input slot map. */
  inputs?: WorkflowInputs;
}

export async function runWorkflow(opts: RunOptions): Promise<WorkflowResult> {
  const backend = detectBackend();
  if (backend === 'deploy') {
    if (!opts.deploymentId) throw new Error('deploymentId required for comfy-deploy backend');
    return deployRun(opts.deploymentId, opts.inputs || {});
  }
  if (backend === 'local') {
    if (!opts.graph) throw new Error('graph required for local comfy backend');
    return localRun(opts.graph);
  }
  throw new Error('No ComfyUI backend configured (set COMFY_DEPLOY_API_KEY or COMFYUI_URL)');
}
