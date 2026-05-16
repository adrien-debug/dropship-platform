import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/setup-msw';
import {
  getDeploymentIds,
  isComfyConfigured,
  pickRoundRobin,
  runWorkflow,
  __resetRoundRobinForTests,
} from './comfy-client';

/**
 * P1.5 — ComfyUI multi-instance round-robin.
 *
 * These tests cover the three pieces that P1.5 introduced:
 *
 *   1. `getDeploymentIds` — the env-resolver that turns single/multi/legacy
 *      env vars into a clean deduplicated pool of deployment ids.
 *
 *   2. `pickRoundRobin` — pure rotation across a fixed pool, with the
 *      module-level counter rotating on each call (1-id pool short-circuits
 *      so dedup edge cases stay quiet).
 *
 *   3. `runWorkflow` end-to-end with an MSW handler matching the real
 *      ComfyDeploy queue + status URLs. We assert (a) three sequential
 *      calls fan out a,b,a across a two-id pool, and (b) an explicit
 *      override bypasses the rotation without advancing the counter.
 */

describe('getDeploymentIds', () => {
  beforeEach(() => {
    vi.stubEnv('COMFY_DEPLOYMENT_HERO', '');
    vi.stubEnv('COMFY_DEPLOYMENT_IDS', '');
    vi.stubEnv('COMFY_DEPLOYMENT_ID', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns [single] for the legacy COMFY_DEPLOYMENT_ID env (no other source)', () => {
    vi.stubEnv('COMFY_DEPLOYMENT_ID', 'dep_legacy');
    expect(getDeploymentIds()).toEqual(['dep_legacy']);
  });

  it('parses comma-separated COMFY_DEPLOYMENT_IDS, dedupes, trims, drops empties', () => {
    vi.stubEnv('COMFY_DEPLOYMENT_IDS', ' dep_a , dep_b ,, dep_a , dep_c ');
    expect(getDeploymentIds()).toEqual(['dep_a', 'dep_b', 'dep_c']);
  });

  it('returns [] when nothing is configured', () => {
    // All three stubs are empty strings from beforeEach.
    expect(getDeploymentIds()).toEqual([]);
  });

  it('prefers a per-asset env key over the global list and the legacy single', () => {
    vi.stubEnv('COMFY_DEPLOYMENT_HERO', 'hero_a,hero_b');
    vi.stubEnv('COMFY_DEPLOYMENT_IDS', 'global_a,global_b');
    vi.stubEnv('COMFY_DEPLOYMENT_ID', 'legacy');
    expect(getDeploymentIds('COMFY_DEPLOYMENT_HERO')).toEqual(['hero_a', 'hero_b']);
  });

  it('falls back from per-asset (empty) to COMFY_DEPLOYMENT_IDS', () => {
    vi.stubEnv('COMFY_DEPLOYMENT_HERO', '');
    vi.stubEnv('COMFY_DEPLOYMENT_IDS', 'global_a,global_b');
    expect(getDeploymentIds('COMFY_DEPLOYMENT_HERO')).toEqual(['global_a', 'global_b']);
  });
});

describe('isComfyConfigured', () => {
  beforeEach(() => {
    vi.stubEnv('COMFY_DEPLOY_API_KEY', '');
    vi.stubEnv('COMFYUI_URL', '');
    vi.stubEnv('COMFY_DEPLOYMENT_IDS', '');
    vi.stubEnv('COMFY_DEPLOYMENT_ID', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is false when neither backend is set', () => {
    expect(isComfyConfigured()).toBe(false);
  });

  it('is false on deploy backend when no deployment id is reachable', () => {
    vi.stubEnv('COMFY_DEPLOY_API_KEY', 'sk-comfy');
    expect(isComfyConfigured()).toBe(false);
  });

  it('is true on deploy backend with COMFY_DEPLOYMENT_IDS set', () => {
    vi.stubEnv('COMFY_DEPLOY_API_KEY', 'sk-comfy');
    vi.stubEnv('COMFY_DEPLOYMENT_IDS', 'dep_a,dep_b');
    expect(isComfyConfigured()).toBe(true);
  });

  it('is true on deploy backend with the legacy single id', () => {
    vi.stubEnv('COMFY_DEPLOY_API_KEY', 'sk-comfy');
    vi.stubEnv('COMFY_DEPLOYMENT_ID', 'dep_legacy');
    expect(isComfyConfigured()).toBe(true);
  });

  it('is true on local backend regardless of deployment ids', () => {
    vi.stubEnv('COMFYUI_URL', 'http://localhost:8188');
    expect(isComfyConfigured()).toBe(true);
  });
});

describe('pickRoundRobin', () => {
  beforeEach(() => {
    __resetRoundRobinForTests();
  });

  it('rotates across a multi-id pool deterministically', () => {
    const pool = ['dep_a', 'dep_b'];
    expect(pickRoundRobin(pool)).toBe('dep_a');
    expect(pickRoundRobin(pool)).toBe('dep_b');
    expect(pickRoundRobin(pool)).toBe('dep_a');
    expect(pickRoundRobin(pool)).toBe('dep_b');
  });

  it('short-circuits on a single-id pool (no counter side-effect)', () => {
    const solo = ['only_one'];
    expect(pickRoundRobin(solo)).toBe('only_one');
    expect(pickRoundRobin(solo)).toBe('only_one');
  });

  it('keeps independent counters per pool', () => {
    const poolA = ['a1', 'a2'];
    const poolB = ['b1', 'b2', 'b3'];
    expect(pickRoundRobin(poolA)).toBe('a1');
    expect(pickRoundRobin(poolB)).toBe('b1');
    expect(pickRoundRobin(poolA)).toBe('a2');
    expect(pickRoundRobin(poolB)).toBe('b2');
    expect(pickRoundRobin(poolA)).toBe('a1');
    expect(pickRoundRobin(poolB)).toBe('b3');
  });

  it('throws on an empty pool (caller bug)', () => {
    expect(() => pickRoundRobin([])).toThrow(/empty deployment pool/);
  });
});

/**
 * End-to-end runWorkflow via MSW. We mock both the queue POST and the
 * status GET so the polling loop completes on its first iteration.
 *
 * The queue handler records which deployment_id each call used. This is
 * how we verify the round-robin fanout — we don't peek at the counter,
 * we observe the wire.
 */
describe('runWorkflow round-robin', () => {
  let calledDeployments: string[] = [];

  // Patch setTimeout so the deployRun poll loop (3s base) resolves
  // immediately. Without this the suite would take ~30s on the four
  // tests below × multiple sequential runWorkflow calls.
  const realSetTimeout = globalThis.setTimeout;
  beforeEach(() => {
    __resetRoundRobinForTests();
    calledDeployments = [];
    vi.stubEnv('COMFY_DEPLOY_API_KEY', 'sk-comfy-test');
    vi.stubEnv('COMFYUI_URL', '');

    vi.spyOn(globalThis, 'setTimeout').mockImplementation(
      // Map every timer to a 0ms tick — we only care about ordering, not
      // wall-clock delays. Preserves the Timeout return type.
      ((fn: () => void) => realSetTimeout(fn, 0)) as typeof setTimeout,
    );

    server.use(
      http.post('https://api.comfydeploy.com/api/v2/run/deployment/queue', async ({ request }) => {
        const body = (await request.json()) as { deployment_id: string };
        calledDeployments.push(body.deployment_id);
        // Echo the deployment id back as the run id so the status handler
        // can route the response without keeping its own state machine.
        return HttpResponse.json({ run_id: `run_for_${body.deployment_id}` });
      }),
      http.get('https://api.comfydeploy.com/api/v2/run/:runId', ({ params }) => {
        const runId = String(params.runId);
        return HttpResponse.json({
          id: runId,
          status: 'success',
          // No outputs → empty images/videos in the result. We're only
          // asserting on the deployment selection, not the asset payload.
          outputs: [],
        });
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('rotates dep_a → dep_b → dep_a across 3 calls when the pool has 2 ids', async () => {
    const pool = ['dep_a', 'dep_b'];

    const r1 = await runWorkflow({ deploymentId: pool, inputs: { prompt: 'p1' } });
    const r2 = await runWorkflow({ deploymentId: pool, inputs: { prompt: 'p2' } });
    const r3 = await runWorkflow({ deploymentId: pool, inputs: { prompt: 'p3' } });

    expect(calledDeployments).toEqual(['dep_a', 'dep_b', 'dep_a']);
    expect(r1.deploymentId).toBe('dep_a');
    expect(r2.deploymentId).toBe('dep_b');
    expect(r3.deploymentId).toBe('dep_a');
  });

  it('accepts a comma-separated string as the pool (env passthrough case)', async () => {
    const poolStr = 'dep_x,dep_y,dep_z';

    await runWorkflow({ deploymentId: poolStr, inputs: { prompt: 'p1' } });
    await runWorkflow({ deploymentId: poolStr, inputs: { prompt: 'p2' } });
    await runWorkflow({ deploymentId: poolStr, inputs: { prompt: 'p3' } });
    await runWorkflow({ deploymentId: poolStr, inputs: { prompt: 'p4' } });

    expect(calledDeployments).toEqual(['dep_x', 'dep_y', 'dep_z', 'dep_x']);
  });

  it('honors deploymentIdOverride without advancing the round-robin counter', async () => {
    const pool = ['dep_a', 'dep_b'];

    // Override on the first call: should hit dep_pinned and NOT consume
    // the counter slot — next round-robin call should start at dep_a.
    const overridden = await runWorkflow({
      deploymentId: pool,
      deploymentIdOverride: 'dep_pinned',
      inputs: { prompt: 'video' },
    });
    expect(overridden.deploymentId).toBe('dep_pinned');

    // Subsequent regular calls behave as if the override never happened.
    const r2 = await runWorkflow({ deploymentId: pool, inputs: { prompt: 'p2' } });
    const r3 = await runWorkflow({ deploymentId: pool, inputs: { prompt: 'p3' } });

    expect(calledDeployments).toEqual(['dep_pinned', 'dep_a', 'dep_b']);
    expect(r2.deploymentId).toBe('dep_a');
    expect(r3.deploymentId).toBe('dep_b');
  });

  it('falls back to env-resolved pool when deploymentId is omitted', async () => {
    vi.stubEnv('COMFY_DEPLOYMENT_IDS', 'env_a,env_b');

    await runWorkflow({ inputs: { prompt: 'p1' } });
    await runWorkflow({ inputs: { prompt: 'p2' } });
    await runWorkflow({ inputs: { prompt: 'p3' } });

    expect(calledDeployments).toEqual(['env_a', 'env_b', 'env_a']);
  });
});
