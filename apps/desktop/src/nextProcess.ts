/**
 * Embedded Next.js dev-server lifecycle.
 *
 * In dev (config.isDev === true) the Electron main process owns the Next.js
 * dev server: it spawns `npm run dev` as a child, waits for port 4302 to
 * accept connections, then signals readiness. On app quit we send SIGTERM
 * (then SIGKILL on a 3s timeout) so we never leak a dangling Next.js.
 *
 * Production builds skip this entirely — they hit the Vercel deployment.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';

let child: ChildProcess | null = null;
let stopping = false;

const NEXT_PORT = 4302;
const NEXT_PROBE_URL = `http://localhost:${NEXT_PORT}`;

/**
 * Probe the Next.js dev server. Returns true on any HTTP response (even
 * 401/404) — the goal is to detect "a server is listening", not whether
 * a specific route exists.
 */
function probeNext(timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(NEXT_PROBE_URL, { timeout: timeoutMs }, (res) => {
      res.resume();
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * Locate apps/web relative to the desktop folder. Walks up a couple of
 * candidates to support both `apps/desktop/dist/` (dev) and packaged
 * Resources/app layouts. Returns null if we cant find it — caller should
 * surface a clear error to the user.
 */
function findWebDir(): string | null {
  const candidates = [
    path.resolve(__dirname, '..', '..', 'web'),
    path.resolve(__dirname, '..', '..', '..', 'web'),
    path.resolve(__dirname, '..', '..', '..', '..', 'apps', 'web'),
    path.resolve(process.cwd(), '..', 'web'),
    path.resolve(process.cwd(), 'apps', 'web'),
  ];
  for (const candidate of candidates) {
    if (existsSync(path.join(candidate, 'package.json'))) {
      return candidate;
    }
  }
  return null;
}

/**
 * Start the embedded Next.js dev server and resolve once it answers on
 * port 4302. If a server is already running (e.g. the user already had
 * `npm run dev` open in a terminal), we adopt it without spawning a
 * duplicate. Rejects on timeout (default 60s) or spawn failure so the
 * Electron main process can show a clear error window.
 */
export async function ensureNextRunning(opts: { timeoutMs?: number; onProgress?: (msg: string) => void } = {}): Promise<void> {
  const { timeoutMs = 60_000, onProgress } = opts;

  // Already running? Adopt it — never spawn a second one.
  if (await probeNext(1500)) {
    onProgress?.('Next.js déjà actif sur 4302');
    return;
  }

  const webDir = findWebDir();
  if (!webDir) {
    throw new Error('Cannot locate apps/web directory — Next.js cannot start.');
  }

  onProgress?.(`Démarrage de Next.js depuis ${webDir}…`);

  child = spawn('npm', ['run', 'dev'], {
    cwd: webDir,
    env: { ...process.env, FORCE_COLOR: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });

  child.on('error', (err) => {
    console.error('[nextProcess] spawn error:', err);
  });

  child.stdout?.on('data', (data: Buffer) => {
    const line = data.toString().trim();
    if (line) console.log('[next]', line);
  });

  child.stderr?.on('data', (data: Buffer) => {
    const line = data.toString().trim();
    if (line) console.error('[next]', line);
  });

  child.on('exit', (code, signal) => {
    if (!stopping) {
      console.error(`[nextProcess] Next.js exited unexpectedly (code=${code}, signal=${signal})`);
    }
    child = null;
  });

  // Poll port 4302 until ready or timeout
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await probeNext(1000)) {
      onProgress?.('Next.js prêt');
      return;
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  // Timeout — kill the half-started child so we dont leak
  await stopNext();
  throw new Error(`Next.js failed to come up on port ${NEXT_PORT} within ${timeoutMs / 1000}s`);
}

/**
 * Stop the embedded Next.js child. SIGTERM first, SIGKILL after 3s if it
 * hasnt exited. Safe to call multiple times — no-op if no child.
 */
export async function stopNext(): Promise<void> {
  if (!child || child.killed) return;
  stopping = true;
  const proc = child;

  return new Promise((resolve) => {
    const done = () => {
      child = null;
      stopping = false;
      resolve();
    };
    proc.once('exit', done);
    try {
      proc.kill('SIGTERM');
    } catch (err) {
      console.error('[nextProcess] SIGTERM failed:', err);
    }
    setTimeout(() => {
      if (proc.exitCode === null && !proc.killed) {
        try {
          proc.kill('SIGKILL');
        } catch {
          // already dead
        }
      }
      done();
    }, 3000);
  });
}
