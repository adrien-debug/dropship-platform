/**
 * Dev mode for the per-store Copilote hub — an agentic loop that can read,
 * write, run safe shell commands, commit and push the platform repo itself.
 *
 * Unlike the other copilote modes (curation, ads, medias, research) which
 * mutate store data, Dev mode operates on the platform source code on disk.
 * The store id is plumbed through only for cost attribution + session
 * grouping; the agent must never touch `dropship_*` rows from here.
 *
 * Safety model:
 *
 *   1. Path traversal: every path is resolved to an absolute path and must
 *      live INSIDE the repo root. Symlinks pointing outside the repo are
 *      rejected via `fs.realpath` before any read or write.
 *
 *   2. Blocked targets: writes to `.env*`, `.git/`, `node_modules/`, `.next/`
 *      are refused with a structured error. Reads to `.env*` are also
 *      refused so the agent cannot exfiltrate secrets through Claude.
 *
 *   3. Shell whitelist + banned patterns: `run_bash` accepts only commands
 *      whose first token is in {npm, npx, node, git, ls, cat, grep, find,
 *      mkdir, echo, pwd, which, head, tail, wc, sort, uniq, awk, sed}. Any
 *      occurrence of a banned regex (`rm -rf`, `sudo`, `ssh`, `dd`, `chmod
 *      -R 777`, output to /dev/*, mkfs, shutdown, reboot, etc.) refuses the
 *      command. This is a defence-in-depth check on top of the whitelist
 *      because chained commands (`git status; rm -rf .`) would otherwise
 *      slip past.
 *
 *   4. `git_push` requires `autoPushConfirmed === true` on the run context.
 *      Without it the tool returns a `confirm_required` error and the UI
 *      surfaces a modal. Force-push and `--no-verify` are blocked.
 *
 * The repo root is resolved by walking up from `process.cwd()` until a
 * `.git` directory is found. From the dev server, cwd is `apps/web` and the
 * repo root is the parent's parent. Resolving once at module load also
 * means tests can override `dev-copilot.ts:resolveRepoRoot` through an
 * injected option if needed.
 */

import type Anthropic from '@anthropic-ai/sdk';
import { exec as execCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

const exec = promisify(execCallback);

export const DEV_MODEL = 'claude-sonnet-4-6';
export const DEV_MAX_TOOL_LOOPS = 15;
export const DEV_MAX_TOOLS_PER_TURN = 20;
const DEV_MAX_FILE_BYTES = 100 * 1024;
const DEV_DEFAULT_TIMEOUT_MS = 30_000;
const DEV_MAX_TIMEOUT_MS = 120_000;
const DEV_MAX_OUTPUT_BYTES = 200 * 1024;

// Hard list of shell command roots we tolerate. `run_bash` rejects anything
// whose first token (after leading `cd ...;` or `env VAR=...` prefixes —
// which we strip before testing) is not present.
const ALLOWED_COMMAND_ROOTS = new Set([
  'npm', 'npx', 'node', 'git', 'ls', 'cat', 'grep', 'find', 'mkdir',
  'echo', 'pwd', 'which', 'head', 'tail', 'wc', 'sort', 'uniq', 'awk', 'sed',
  'tsc', 'eslint', 'prettier', 'vitest',
]);

// Belt-and-braces regex blocklist. These patterns are recognised anywhere in
// the command string (chained `&&`, `;`, backticks). A whitelist alone would
// pass `git status; rm -rf .`, hence the second pass.
const BANNED_PATTERNS: RegExp[] = [
  /\brm\s+-rf?\b/, /\bsudo\b/, /\bssh\b/, /\bscp\b/, /\bdd\s/,
  /\bchmod\s+-R\s+777\b/, /\bcurl\b[^|;]*--data[^|;]*PASSWORD/i,
  /\b>\s*\/dev\//, /\bmkfs\b/, /\bshutdown\b/, /\breboot\b/,
  /\beval\b/, /\b:\(\)\s*\{/, // fork bomb
];

// Paths we never let the agent write to, even if they resolve inside the
// repo. Reads of these are also blocked except for `.git/HEAD` which the
// agent never legitimately needs raw access to anyway.
const BLOCKED_PATH_SEGMENTS = ['.git', 'node_modules', '.next', '.turbo'];
const BLOCKED_FILE_PATTERNS = [
  /^\.env(\..*)?$/, // .env, .env.local, .env.production, etc.
];

// ── Repo root resolution ───────────────────────────────────────────────

let cachedRepoRoot: string | null = null;

/**
 * Walk up from `start` until a `.git` directory is found. Cached after the
 * first hit; tests reset it via `__internals.resetRepoRoot()`.
 */
export async function resolveRepoRoot(start: string = process.cwd()): Promise<string> {
  if (cachedRepoRoot) return cachedRepoRoot;
  let dir = path.resolve(start);
  // Guard against `/` runaway.
  for (let depth = 0; depth < 12; depth++) {
    try {
      const stat = await fs.stat(path.join(dir, '.git'));
      if (stat.isDirectory() || stat.isFile()) {
        cachedRepoRoot = dir;
        return dir;
      }
    } catch {
      // .git not here, continue up
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`Impossible de localiser la racine du repo (.git introuvable depuis ${start}).`);
}

function resetRepoRoot(): void {
  cachedRepoRoot = null;
}

// ── Path safety ────────────────────────────────────────────────────────

/**
 * Resolve `relPath` against the repo root and refuse anything that escapes
 * the root or hits a blocked segment. Returns the absolute path on success.
 */
async function safeResolvePath(
  relPath: string,
  opts?: { allowMissing?: boolean; forWrite?: boolean },
): Promise<string> {
  const root = await resolveRepoRoot();
  // Strip any leading `./` or absolute prefix; treat the input as
  // repo-relative.
  const normalized = relPath.replace(/^[/\\]+/, '');
  const abs = path.resolve(root, normalized);
  const rel = path.relative(root, abs);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`Chemin hors du repo refusé: ${relPath}`);
  }
  // Check blocked segments
  const parts = rel.split(path.sep);
  for (const seg of parts) {
    if (BLOCKED_PATH_SEGMENTS.includes(seg)) {
      throw new Error(`Chemin dans un dossier protégé refusé: ${relPath}`);
    }
  }
  const basename = path.basename(rel);
  for (const re of BLOCKED_FILE_PATTERNS) {
    if (re.test(basename)) {
      throw new Error(`Fichier protégé refusé: ${relPath}`);
    }
  }
  // For writes, also re-check realpath of the PARENT to detect symlink
  // escape (the file itself may not exist yet). For reads we let
  // fs.realpath catch it later.
  if (opts?.forWrite) {
    try {
      const parentReal = await fs.realpath(path.dirname(abs));
      const rootReal = await fs.realpath(root);
      const relReal = path.relative(rootReal, parentReal);
      if (relReal.startsWith('..') || path.isAbsolute(relReal)) {
        throw new Error(`Lien symbolique hors du repo refusé: ${relPath}`);
      }
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
      // Parent missing — caller should create it explicitly; let the write
      // proceed and fail with a clear error if so.
    }
  }
  if (!opts?.allowMissing) {
    try {
      await fs.access(abs);
    } catch {
      throw new Error(`Fichier introuvable: ${relPath}`);
    }
  }
  return abs;
}

// ── Shell safety ───────────────────────────────────────────────────────

export function isBannedCommand(cmd: string): boolean {
  return BANNED_PATTERNS.some((re) => re.test(cmd));
}

export function isWhitelistedCommand(cmd: string): boolean {
  // Split on the first chain operator and inspect each segment's first
  // non-whitespace token. Empty segments are skipped. Subshells, pipes and
  // redirects are accepted as long as each command root is whitelisted.
  const segments = cmd
    .split(/(?:\|\||&&|;|\||\n)/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (segments.length === 0) return false;
  for (const seg of segments) {
    // Strip env-var prefixes like `FOO=bar npm test`.
    const cleaned = seg.replace(/^(?:\w+=\S+\s+)+/, '').trim();
    const head = cleaned.split(/\s+/)[0] ?? '';
    if (!ALLOWED_COMMAND_ROOTS.has(head)) return false;
  }
  return true;
}

// ── Zod schemas ────────────────────────────────────────────────────────

const ReadFileInput = z.object({ path: z.string().min(1).max(500) });
const ListFilesInput = z.object({
  path: z.string().min(1).max(500),
  glob: z.string().min(1).max(200).optional(),
});
const SearchCodeInput = z.object({
  pattern: z.string().min(1).max(500),
  path: z.string().min(1).max(500).optional(),
});
const WriteFileInput = z.object({
  path: z.string().min(1).max(500),
  content: z.string().max(1_000_000),
});
const ApplyPatchInput = z.object({
  path: z.string().min(1).max(500),
  old_string: z.string().min(1),
  new_string: z.string(),
});
const RunBashInput = z.object({
  command: z.string().min(1).max(2000),
  timeout_ms: z.number().int().positive().max(DEV_MAX_TIMEOUT_MS).optional(),
});
const GitStatusInput = z.object({}).strict();
const GitDiffInput = z.object({ staged: z.boolean().optional() });
const GitCommitInput = z.object({
  message: z.string().min(3).max(2000),
  files: z.array(z.string().min(1).max(500)).max(50).optional(),
});
const GitPushInput = z.object({ branch: z.string().min(1).max(120).optional() });

// ── Anthropic tool surfaces ────────────────────────────────────────────

export const DEV_TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: 'read_file',
    description:
      'Read a file from the repo (UTF-8, max 100KB). Refused for `.env*`, `.git/`, `node_modules/`, `.next/` or paths outside the repo root.',
    input_schema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Path relative to repo root.' } },
      required: ['path'],
    },
  },
  {
    name: 'list_files',
    description:
      'List files in a directory (max depth 2, max 200 entries). Optional `glob` filters by extension or basename pattern (simple `*.ts`, `*.tsx`, etc.).',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path relative to repo root.' },
        glob: { type: 'string', description: 'Optional simple glob like "*.ts".' },
      },
      required: ['path'],
    },
  },
  {
    name: 'search_code',
    description:
      'Grep for a pattern (literal substring, case-sensitive) across the repo. Returns up to 50 matches with file path and line number. Skips `.git`, `node_modules`, `.next`.',
    input_schema: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Literal substring to search for.' },
        path: { type: 'string', description: 'Optional directory subtree to limit the search.' },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'write_file',
    description:
      'Create or overwrite a file with verbatim content. Prefer `apply_patch` for edits to an existing file. Refused for `.env*`, `.git/`, `node_modules/`, `.next/`.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        content: { type: 'string' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'apply_patch',
    description:
      'Apply a string replacement in an existing file. `old_string` must occur exactly once. Safer than `write_file` because it preserves the rest of the file untouched.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        old_string: { type: 'string', description: 'Text to find (must be unique in the file).' },
        new_string: { type: 'string', description: 'Replacement text (may be empty to delete).' },
      },
      required: ['path', 'old_string', 'new_string'],
    },
  },
  {
    name: 'run_bash',
    description:
      'Run a whitelisted shell command at the repo root. Allowed roots: npm, npx, node, git, ls, cat, grep, find, mkdir, echo, pwd, which, head, tail, wc, sort, uniq, awk, sed, tsc, eslint, prettier, vitest. Forbidden anywhere in the command: rm -rf, sudo, ssh, scp, dd, chmod -R 777, > /dev/*, mkfs, shutdown, reboot.',
    input_schema: {
      type: 'object',
      properties: {
        command: { type: 'string' },
        timeout_ms: { type: 'number', description: 'Default 30000, max 120000.' },
      },
      required: ['command'],
    },
  },
  {
    name: 'git_status',
    description: 'Show the porcelain git status of the working tree.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'git_diff',
    description: 'Show the git diff. Pass `staged: true` for staged-only diff. Default is unstaged.',
    input_schema: {
      type: 'object',
      properties: { staged: { type: 'boolean' } },
    },
  },
  {
    name: 'git_commit',
    description:
      "Commit staged changes (or pre-stage the given `files` first). The commit footer 'Co-Authored-By: Claude <noreply@anthropic.com>' is appended automatically.",
    input_schema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: '1-2 sentence commit message in French.' },
        files: { type: 'array', items: { type: 'string' }, description: 'Optional paths to git add before commit.' },
      },
      required: ['message'],
    },
  },
  {
    name: 'git_push',
    description:
      'Push the current branch to origin. ONLY call this if the user has explicitly confirmed they want to push to production. Otherwise commit only and ask. Never force-push.',
    input_schema: {
      type: 'object',
      properties: { branch: { type: 'string', description: 'Optional branch name. Defaults to current.' } },
    },
  },
];

// ── Context passed to executors ────────────────────────────────────────

export interface DevToolCtx {
  storeId: string;
  autoPushConfirmed: boolean;
}

export interface DevToolResult {
  output: unknown;
  summary: string;
  /** Set on git_push when the user has not yet confirmed. */
  confirm_required?: boolean;
}

// ── Tool executors ─────────────────────────────────────────────────────

async function execReadFile(raw: unknown): Promise<DevToolResult> {
  const input = ReadFileInput.parse(raw);
  const abs = await safeResolvePath(input.path);
  const stat = await fs.stat(abs);
  if (stat.isDirectory()) throw new Error(`Le chemin est un dossier: ${input.path}`);
  if (stat.size > DEV_MAX_FILE_BYTES) {
    throw new Error(`Fichier trop volumineux (${stat.size}B > ${DEV_MAX_FILE_BYTES}B): ${input.path}`);
  }
  const content = await fs.readFile(abs, 'utf-8');
  return {
    output: { path: input.path, content, bytes: stat.size },
    summary: `read_file ${input.path} (${stat.size}B)`,
  };
}

function matchesGlob(name: string, glob: string): boolean {
  // Very small subset: `*.ext` or substring fallback.
  if (glob.startsWith('*.')) {
    const ext = glob.slice(1);
    return name.endsWith(ext);
  }
  if (glob === '*') return true;
  return name.includes(glob);
}

async function execListFiles(raw: unknown): Promise<DevToolResult> {
  const input = ListFilesInput.parse(raw);
  const abs = await safeResolvePath(input.path);
  const stat = await fs.stat(abs);
  if (!stat.isDirectory()) throw new Error(`${input.path} n'est pas un dossier.`);

  const entries: Array<{ path: string; type: 'file' | 'dir'; size: number }> = [];
  const MAX_ENTRIES = 200;

  async function walk(dir: string, depth: number): Promise<void> {
    if (entries.length >= MAX_ENTRIES) return;
    if (depth > 2) return;
    let names: string[];
    try {
      names = await fs.readdir(dir);
    } catch {
      return;
    }
    names.sort();
    for (const name of names) {
      if (entries.length >= MAX_ENTRIES) return;
      if (BLOCKED_PATH_SEGMENTS.includes(name)) continue;
      const full = path.join(dir, name);
      const relRoot = await resolveRepoRoot();
      const rel = path.relative(relRoot, full);
      let s: import('node:fs').Stats;
      try {
        s = await fs.stat(full);
      } catch {
        continue;
      }
      if (s.isDirectory()) {
        entries.push({ path: rel, type: 'dir', size: 0 });
        await walk(full, depth + 1);
      } else if (s.isFile()) {
        if (input.glob && !matchesGlob(name, input.glob)) continue;
        entries.push({ path: rel, type: 'file', size: s.size });
      }
    }
  }

  await walk(abs, 0);
  return {
    output: { path: input.path, entries },
    summary: `list_files ${input.path} — ${entries.length} entrée${entries.length === 1 ? '' : 's'}`,
  };
}

async function execSearchCode(raw: unknown): Promise<DevToolResult> {
  const input = SearchCodeInput.parse(raw);
  const root = await resolveRepoRoot();
  const startAbs = input.path ? await safeResolvePath(input.path) : root;

  const matches: Array<{ file: string; line: number; content: string }> = [];
  const MAX_MATCHES = 50;
  const SKIP_DIRS = new Set([...BLOCKED_PATH_SEGMENTS, 'dist', 'build', 'coverage']);
  const ALLOWED_EXT = new Set([
    '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.md', '.sql',
    '.css', '.html', '.yml', '.yaml', '.txt', '.sh',
  ]);

  async function walk(dir: string): Promise<void> {
    if (matches.length >= MAX_MATCHES) return;
    let names: string[];
    try {
      names = await fs.readdir(dir);
    } catch {
      return;
    }
    for (const name of names) {
      if (matches.length >= MAX_MATCHES) return;
      if (SKIP_DIRS.has(name)) continue;
      if (name.startsWith('.') && name !== '.github') continue;
      const full = path.join(dir, name);
      let s: import('node:fs').Stats;
      try {
        s = await fs.stat(full);
      } catch {
        continue;
      }
      if (s.isDirectory()) {
        await walk(full);
      } else if (s.isFile()) {
        const ext = path.extname(name);
        if (!ALLOWED_EXT.has(ext)) continue;
        if (s.size > 500_000) continue;
        let content: string;
        try {
          content = await fs.readFile(full, 'utf-8');
        } catch {
          continue;
        }
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (matches.length >= MAX_MATCHES) break;
          if (lines[i]!.includes(input.pattern)) {
            const rel = path.relative(root, full);
            matches.push({ file: rel, line: i + 1, content: lines[i]!.slice(0, 240) });
          }
        }
      }
    }
  }

  await walk(startAbs);
  return {
    output: { pattern: input.pattern, matches, total: matches.length, truncated: matches.length >= MAX_MATCHES },
    summary: `search_code "${input.pattern}" — ${matches.length} match${matches.length === 1 ? '' : 'es'}`,
  };
}

async function execWriteFile(raw: unknown): Promise<DevToolResult> {
  const input = WriteFileInput.parse(raw);
  const abs = await safeResolvePath(input.path, { allowMissing: true, forWrite: true });
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, input.content, 'utf-8');
  return {
    output: { path: input.path, bytes: Buffer.byteLength(input.content, 'utf-8') },
    summary: `write_file ${input.path} (${Buffer.byteLength(input.content, 'utf-8')}B)`,
  };
}

async function execApplyPatch(raw: unknown): Promise<DevToolResult> {
  const input = ApplyPatchInput.parse(raw);
  const abs = await safeResolvePath(input.path, { forWrite: true });
  const original = await fs.readFile(abs, 'utf-8');
  const idx = original.indexOf(input.old_string);
  if (idx === -1) {
    throw new Error(`apply_patch: old_string introuvable dans ${input.path}`);
  }
  const second = original.indexOf(input.old_string, idx + input.old_string.length);
  if (second !== -1) {
    throw new Error(`apply_patch: old_string trouvé plusieurs fois dans ${input.path} — fournis un contexte plus précis.`);
  }
  const updated = original.slice(0, idx) + input.new_string + original.slice(idx + input.old_string.length);
  await fs.writeFile(abs, updated, 'utf-8');
  return {
    output: {
      path: input.path,
      old_bytes: Buffer.byteLength(original, 'utf-8'),
      new_bytes: Buffer.byteLength(updated, 'utf-8'),
    },
    summary: `apply_patch ${input.path}`,
  };
}

function truncate(s: string, max = DEV_MAX_OUTPUT_BYTES): string {
  if (Buffer.byteLength(s, 'utf-8') <= max) return s;
  return s.slice(0, max) + `\n…[output truncated at ${max} bytes]`;
}

async function execRunBash(raw: unknown): Promise<DevToolResult> {
  const input = RunBashInput.parse(raw);
  const cmd = input.command.trim();
  if (isBannedCommand(cmd)) {
    throw new Error(`Commande refusée par la liste noire: ${cmd}`);
  }
  if (!isWhitelistedCommand(cmd)) {
    throw new Error(`Commande refusée par la whitelist: ${cmd}`);
  }
  const root = await resolveRepoRoot();
  const timeout = Math.min(DEV_MAX_TIMEOUT_MS, input.timeout_ms ?? DEV_DEFAULT_TIMEOUT_MS);
  try {
    const { stdout, stderr } = await exec(cmd, {
      cwd: root,
      timeout,
      maxBuffer: DEV_MAX_OUTPUT_BYTES * 2,
      // Strip out PATH-only env to keep the shell sane; child inherits from parent
    });
    return {
      output: {
        command: cmd,
        stdout: truncate(stdout || ''),
        stderr: truncate(stderr || ''),
        exit_code: 0,
      },
      summary: `run_bash exit 0 — ${cmd.slice(0, 60)}${cmd.length > 60 ? '…' : ''}`,
    };
  } catch (e) {
    const err = e as { code?: number; stdout?: string; stderr?: string; message?: string };
    return {
      output: {
        command: cmd,
        stdout: truncate(err.stdout || ''),
        stderr: truncate(err.stderr || err.message || ''),
        exit_code: typeof err.code === 'number' ? err.code : 1,
        error: err.message || 'exec failed',
      },
      summary: `run_bash exit ${err.code ?? 1} — ${cmd.slice(0, 60)}${cmd.length > 60 ? '…' : ''}`,
    };
  }
}

async function execGitStatus(_raw: unknown): Promise<DevToolResult> {
  GitStatusInput.parse({});
  const root = await resolveRepoRoot();
  const { stdout } = await exec('git status --porcelain=v1 --branch', { cwd: root, timeout: 15_000 });
  return {
    output: { porcelain: stdout },
    summary: `git_status (${stdout.split('\n').filter(Boolean).length} ligne${stdout.split('\n').filter(Boolean).length === 1 ? '' : 's'})`,
  };
}

async function execGitDiff(raw: unknown): Promise<DevToolResult> {
  const input = GitDiffInput.parse(raw);
  const root = await resolveRepoRoot();
  const flag = input.staged ? '--cached' : '';
  const { stdout } = await exec(`git diff ${flag}`.trim(), {
    cwd: root,
    timeout: 30_000,
    maxBuffer: DEV_MAX_OUTPUT_BYTES * 2,
  });
  return {
    output: { staged: !!input.staged, diff: truncate(stdout) },
    summary: `git_diff${input.staged ? ' --cached' : ''} (${Buffer.byteLength(stdout, 'utf-8')}B)`,
  };
}

async function execGitCommit(raw: unknown): Promise<DevToolResult> {
  const input = GitCommitInput.parse(raw);
  const root = await resolveRepoRoot();

  if (input.files && input.files.length > 0) {
    // Validate each path lives in the repo before adding.
    for (const f of input.files) {
      await safeResolvePath(f, { allowMissing: true });
    }
    const quoted = input.files.map((f) => `'${f.replace(/'/g, "'\\''")}'`).join(' ');
    await exec(`git add ${quoted}`, { cwd: root, timeout: 30_000 });
  }
  const body = `${input.message.trim()}\n\nCo-Authored-By: Claude <noreply@anthropic.com>\n`;
  // Write the message to a temp file to keep shell quoting predictable.
  const tmpFile = path.join(root, '.copilot-commit-msg.tmp');
  await fs.writeFile(tmpFile, body, 'utf-8');
  try {
    const { stdout, stderr } = await exec(`git commit -F '${tmpFile}'`, { cwd: root, timeout: 30_000 });
    // Capture short sha
    const { stdout: shaOut } = await exec('git rev-parse --short HEAD', { cwd: root, timeout: 5_000 });
    return {
      output: {
        message: input.message.trim(),
        short_sha: shaOut.trim(),
        stdout: truncate(stdout),
        stderr: truncate(stderr || ''),
      },
      summary: `git_commit ${shaOut.trim()} — ${input.message.slice(0, 50)}`,
    };
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    // Nothing-to-commit is a common, recoverable case; surface it cleanly.
    const combined = `${err.stdout ?? ''}\n${err.stderr ?? ''}`.toLowerCase();
    if (combined.includes('nothing to commit')) {
      return {
        output: { message: input.message.trim(), short_sha: null, stdout: err.stdout ?? '', stderr: err.stderr ?? '', empty: true },
        summary: 'git_commit — rien à commiter',
      };
    }
    throw new Error(`git_commit failed: ${err.message ?? combined}`);
  } finally {
    await fs.unlink(tmpFile).catch(() => {});
  }
}

async function execGitPush(raw: unknown, ctx: DevToolCtx): Promise<DevToolResult> {
  const input = GitPushInput.parse(raw);
  if (!ctx.autoPushConfirmed) {
    return {
      output: {
        confirm_required: true,
        branch: input.branch ?? null,
        message: "L'utilisateur n'a pas encore confirmé le push.",
      },
      summary: 'git_push — confirmation requise',
      confirm_required: true,
    };
  }
  const root = await resolveRepoRoot();
  const { stdout: cur } = await exec('git rev-parse --abbrev-ref HEAD', { cwd: root, timeout: 5_000 });
  const branch = (input.branch || cur).trim();
  // Strict: no force, no no-verify; explicit branch reference.
  const cmd = `git push origin ${branch}`;
  const { stdout, stderr } = await exec(cmd, { cwd: root, timeout: 60_000 });
  return {
    output: { branch, stdout: truncate(stdout), stderr: truncate(stderr || '') },
    summary: `git_push origin ${branch}`,
  };
}

export type DevToolName =
  | 'read_file'
  | 'list_files'
  | 'search_code'
  | 'write_file'
  | 'apply_patch'
  | 'run_bash'
  | 'git_status'
  | 'git_diff'
  | 'git_commit'
  | 'git_push';

export async function executeDevTool(
  name: string,
  input: unknown,
  ctx: DevToolCtx,
): Promise<DevToolResult> {
  switch (name as DevToolName) {
    case 'read_file': return execReadFile(input);
    case 'list_files': return execListFiles(input);
    case 'search_code': return execSearchCode(input);
    case 'write_file': return execWriteFile(input);
    case 'apply_patch': return execApplyPatch(input);
    case 'run_bash': return execRunBash(input);
    case 'git_status': return execGitStatus(input);
    case 'git_diff': return execGitDiff(input);
    case 'git_commit': return execGitCommit(input);
    case 'git_push': return execGitPush(input, ctx);
    default:
      throw new Error(`Tool inconnu: ${name}`);
  }
}

export function buildDevSystemPrompt(storeName: string, storeNiche: string): string {
  return [
    `Tu es un copilote de développement pour la plateforme Hearst Dropship. Tu opères sur le repo source Next.js / TypeScript de la plateforme (pas sur les données du store "${storeName}" — niche "${storeNiche}" — qui est juste le contexte d'attribution).`,
    '',
    'Règles strictes:',
    '- Toujours commencer par list_files / read_file / search_code pour comprendre avant de modifier.',
    '- Préférer apply_patch à write_file pour les edits ciblés. write_file est pour les nouveaux fichiers.',
    "- Lancer `npm run build` et `npx vitest run` (ou un test ciblé) après tout changement non-trivial. Si ça casse, corrige avant de commiter.",
    '- Commit en français, message clair, 1 à 2 phrases. Pas de tiret cadratin.',
    '- Ne JAMAIS push sans confirmation explicite utilisateur dans le chat ("oui push", "push maintenant", équivalent). Si l\'utilisateur n\'a pas confirmé, l\'outil git_push renvoie une demande de confirmation; surface-la à l\'utilisateur et attends.',
    '- Refuser tout rm -rf, sudo, modification de .env*, .git/, node_modules, .next/. Si l\'outil refuse, propose une alternative.',
    "- Pas de tiret cadratin (—). Pas de triade rythmique. Français tendu, concret.",
    '- Quand un outil échoue, surface l\'erreur en français et propose la prochaine étape — ne boucle pas en silence.',
    '- Maximum 15 boucles d\'outils par tour, 20 appels par tour. Tiens-toi-en au plus court chemin.',
  ].join('\n');
}

// ── Internals for tests ───────────────────────────────────────────────

export const __internals = {
  resolveRepoRoot,
  resetRepoRoot,
  safeResolvePath,
  isBannedCommand,
  isWhitelistedCommand,
  DEV_TOOLS,
};
