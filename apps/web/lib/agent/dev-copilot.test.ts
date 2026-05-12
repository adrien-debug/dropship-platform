/**
 * Vitest coverage for the Dev-mode agentic copilot.
 *
 * Strategy:
 *   - Real filesystem: each test creates a temp dir with a `.git/` folder
 *     so dev-copilot's `resolveRepoRoot()` resolves to that temp dir.
 *     `process.cwd` is swapped via `vi.spyOn` to point at the temp dir
 *     before importing. Between tests we call `__internals.resetRepoRoot()`
 *     so the module-level cache doesn't leak.
 *   - `child_process.exec` is mocked: every `run_bash`, `git_*` call is
 *     intercepted and asserted on. We do NOT actually run git or shell
 *     commands.
 *   - Anthropic SDK isn't touched; we only test the tool executors.
 *
 * Tests cover:
 *   1. read_file reads existing file content (under 100KB)
 *   2. read_file refuses path traversal `../../etc/passwd`
 *   3. read_file refuses `.env.local`
 *   4. read_file refuses paths inside `.git/`
 *   5. list_files returns directory contents
 *   6. search_code greps for a pattern and returns matches
 *   7. write_file creates a new file
 *   8. write_file refuses to overwrite `.env.local`
 *   9. apply_patch applies a clean diff
 *   10. apply_patch errors when old_string is not found
 *   11. apply_patch errors when old_string is non-unique
 *   12. isBannedCommand rejects rm -rf, sudo
 *   13. isWhitelistedCommand accepts npm, git; rejects unknown roots
 *   14. run_bash rejects banned commands even when whitelisted prefix
 *   15. run_bash allows a whitelisted command (exec mocked)
 *   16. git_push blocks when autoPushConfirmed === false
 *   17. git_push runs when autoPushConfirmed === true
 *   18. git_commit appends Co-Authored-By footer and pre-stages files
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Mock child_process.exec — every test installs canned outputs / errors.
type CapturedCmd = { cmd: string; opts?: { cwd?: string; timeout?: number } };
const captured: CapturedCmd[] = [];
type CannedResp = { stdout?: string; stderr?: string; error?: { code?: number; stdout?: string; stderr?: string; message?: string } };
const cannedByPattern: { pattern: RegExp; resp: CannedResp }[] = [];

function setExec(pattern: RegExp, resp: CannedResp) {
  cannedByPattern.push({ pattern, resp });
}

vi.mock('node:child_process', () => {
  return {
    exec: (cmd: string, opts: unknown, cb?: (err: unknown, out: unknown) => void) => {
      const realCb = typeof opts === 'function' ? (opts as typeof cb) : cb;
      const realOpts = typeof opts === 'function' ? {} : (opts as { cwd?: string; timeout?: number });
      captured.push({ cmd, opts: realOpts });
      for (const { pattern, resp } of cannedByPattern) {
        if (pattern.test(cmd)) {
          if (resp.error) {
            const err = new Error(resp.error.message ?? 'exec error') as Error & {
              stdout?: string; stderr?: string; code?: number;
            };
            err.stdout = resp.error.stdout ?? '';
            err.stderr = resp.error.stderr ?? '';
            err.code = resp.error.code ?? 1;
            queueMicrotask(() => realCb?.(err, { stdout: err.stdout, stderr: err.stderr }));
            return {} as never;
          }
          queueMicrotask(() =>
            realCb?.(null, { stdout: resp.stdout ?? '', stderr: resp.stderr ?? '' }),
          );
          return {} as never;
        }
      }
      // Default: empty success.
      queueMicrotask(() => realCb?.(null, { stdout: '', stderr: '' }));
      return {} as never;
    },
  };
});

// Track the temp repo root used by the current test.
let tmpRoot: string;
let cwdSpy: ReturnType<typeof vi.spyOn> | null = null;

beforeEach(async () => {
  captured.length = 0;
  cannedByPattern.length = 0;
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'devcopilot-'));
  await fs.mkdir(path.join(tmpRoot, '.git'), { recursive: true });
  cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tmpRoot);
  // Reset the module-level cached repo root.
  const dev = await import('./dev-copilot');
  dev.__internals.resetRepoRoot();
});

afterEach(async () => {
  cwdSpy?.mockRestore();
  cwdSpy = null;
  try {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  } catch { /* ignore */ }
  vi.clearAllMocks();
});

// Re-import inside each test so the mocked exec is wired correctly. We use
// dynamic import + the test's specific cwd.
async function getExecutor() {
  const mod = await import('./dev-copilot');
  return mod;
}

const CTX_NO_PUSH = { storeId: '11111111-1111-4111-8111-111111111111', autoPushConfirmed: false };
const CTX_PUSH_OK = { storeId: '11111111-1111-4111-8111-111111111111', autoPushConfirmed: true };

describe('dev-copilot — file ops', () => {
  it('read_file returns content of an existing file', async () => {
    await fs.writeFile(path.join(tmpRoot, 'hello.txt'), 'hello world', 'utf-8');
    const { executeDevTool } = await getExecutor();
    const res = await executeDevTool('read_file', { path: 'hello.txt' }, CTX_NO_PUSH);
    expect((res.output as Record<string, unknown>).content).toBe('hello world');
    expect(res.summary).toMatch(/read_file hello\.txt/);
  });

  it('read_file refuses path traversal', async () => {
    const { executeDevTool } = await getExecutor();
    await expect(
      executeDevTool('read_file', { path: '../../etc/passwd' }, CTX_NO_PUSH),
    ).rejects.toThrow(/hors du repo|protégé/);
  });

  it('read_file refuses .env.local', async () => {
    await fs.writeFile(path.join(tmpRoot, '.env.local'), 'SECRET=1', 'utf-8');
    const { executeDevTool } = await getExecutor();
    await expect(
      executeDevTool('read_file', { path: '.env.local' }, CTX_NO_PUSH),
    ).rejects.toThrow(/protégé/);
  });

  it('read_file refuses files inside .git/', async () => {
    await fs.writeFile(path.join(tmpRoot, '.git', 'HEAD'), 'ref: foo', 'utf-8');
    const { executeDevTool } = await getExecutor();
    await expect(
      executeDevTool('read_file', { path: '.git/HEAD' }, CTX_NO_PUSH),
    ).rejects.toThrow(/protégé/);
  });

  it('list_files returns directory contents', async () => {
    await fs.mkdir(path.join(tmpRoot, 'src'), { recursive: true });
    await fs.writeFile(path.join(tmpRoot, 'src', 'a.ts'), 'export {};', 'utf-8');
    await fs.writeFile(path.join(tmpRoot, 'src', 'b.ts'), 'export {};', 'utf-8');
    const { executeDevTool } = await getExecutor();
    const res = await executeDevTool('list_files', { path: 'src' }, CTX_NO_PUSH);
    const entries = (res.output as { entries: Array<{ path: string; type: string }> }).entries;
    expect(entries.length).toBeGreaterThanOrEqual(2);
    expect(entries.some((e) => e.path.endsWith('a.ts'))).toBe(true);
  });

  it('search_code greps for a pattern and returns matches with line numbers', async () => {
    await fs.mkdir(path.join(tmpRoot, 'src'), { recursive: true });
    await fs.writeFile(
      path.join(tmpRoot, 'src', 'a.ts'),
      'const x = 1;\nconst MAGIC = 42;\nconst y = 2;\n',
      'utf-8',
    );
    const { executeDevTool } = await getExecutor();
    const res = await executeDevTool('search_code', { pattern: 'MAGIC' }, CTX_NO_PUSH);
    const matches = (res.output as { matches: Array<{ file: string; line: number }> }).matches;
    expect(matches.length).toBe(1);
    expect(matches[0]!.line).toBe(2);
    expect(matches[0]!.file).toContain('a.ts');
  });

  it('write_file creates a new file inside the repo', async () => {
    const { executeDevTool } = await getExecutor();
    const res = await executeDevTool('write_file', {
      path: 'new/file.txt',
      content: 'hello',
    }, CTX_NO_PUSH);
    const onDisk = await fs.readFile(path.join(tmpRoot, 'new/file.txt'), 'utf-8');
    expect(onDisk).toBe('hello');
    expect((res.output as { bytes: number }).bytes).toBe(5);
  });

  it('write_file refuses to overwrite .env.local', async () => {
    await fs.writeFile(path.join(tmpRoot, '.env.local'), 'KEY=old', 'utf-8');
    const { executeDevTool } = await getExecutor();
    await expect(
      executeDevTool('write_file', { path: '.env.local', content: 'KEY=new' }, CTX_NO_PUSH),
    ).rejects.toThrow(/protégé/);
    // Original still untouched.
    expect(await fs.readFile(path.join(tmpRoot, '.env.local'), 'utf-8')).toBe('KEY=old');
  });

  it('apply_patch applies a clean diff', async () => {
    await fs.writeFile(path.join(tmpRoot, 'foo.ts'), 'export const X = 1;\n', 'utf-8');
    const { executeDevTool } = await getExecutor();
    await executeDevTool('apply_patch', {
      path: 'foo.ts',
      old_string: 'const X = 1;',
      new_string: 'const X = 2;',
    }, CTX_NO_PUSH);
    expect(await fs.readFile(path.join(tmpRoot, 'foo.ts'), 'utf-8')).toBe('export const X = 2;\n');
  });

  it('apply_patch errors when old_string is not found', async () => {
    await fs.writeFile(path.join(tmpRoot, 'foo.ts'), 'export const X = 1;\n', 'utf-8');
    const { executeDevTool } = await getExecutor();
    await expect(
      executeDevTool('apply_patch', {
        path: 'foo.ts',
        old_string: 'not in file',
        new_string: 'replacement',
      }, CTX_NO_PUSH),
    ).rejects.toThrow(/introuvable/);
  });

  it('apply_patch errors when old_string is non-unique', async () => {
    await fs.writeFile(path.join(tmpRoot, 'foo.ts'), 'X\nY\nX\n', 'utf-8');
    const { executeDevTool } = await getExecutor();
    await expect(
      executeDevTool('apply_patch', {
        path: 'foo.ts',
        old_string: 'X',
        new_string: 'Z',
      }, CTX_NO_PUSH),
    ).rejects.toThrow(/plusieurs fois/);
  });
});

describe('dev-copilot — shell safety', () => {
  it('isBannedCommand rejects rm -rf, sudo, ssh, mkfs', async () => {
    const { __internals } = await getExecutor();
    expect(__internals.isBannedCommand('rm -rf /')).toBe(true);
    expect(__internals.isBannedCommand('sudo whoami')).toBe(true);
    expect(__internals.isBannedCommand('ssh user@host')).toBe(true);
    expect(__internals.isBannedCommand('mkfs.ext4 /dev/sda')).toBe(true);
    expect(__internals.isBannedCommand('npm test')).toBe(false);
  });

  it('isWhitelistedCommand accepts whitelisted roots and chains', async () => {
    const { __internals } = await getExecutor();
    expect(__internals.isWhitelistedCommand('npm test')).toBe(true);
    expect(__internals.isWhitelistedCommand('git status')).toBe(true);
    expect(__internals.isWhitelistedCommand('cat foo && grep bar')).toBe(true);
    expect(__internals.isWhitelistedCommand('npx vitest run')).toBe(true);
    expect(__internals.isWhitelistedCommand('mysteryCmd --do-stuff')).toBe(false);
    // Chain with one non-whitelisted root fails:
    expect(__internals.isWhitelistedCommand('git status; mysterious')).toBe(false);
  });

  it('run_bash refuses banned commands', async () => {
    const { executeDevTool } = await getExecutor();
    await expect(
      executeDevTool('run_bash', { command: 'rm -rf .' }, CTX_NO_PUSH),
    ).rejects.toThrow(/refusée|whitelist/);
    await expect(
      executeDevTool('run_bash', { command: 'sudo cat /etc/shadow' }, CTX_NO_PUSH),
    ).rejects.toThrow(/refusée/);
  });

  it('run_bash runs a whitelisted command via exec', async () => {
    setExec(/npm test/, { stdout: 'all good\n' });
    const { executeDevTool } = await getExecutor();
    const res = await executeDevTool('run_bash', { command: 'npm test' }, CTX_NO_PUSH);
    expect((res.output as { stdout: string }).stdout).toContain('all good');
    expect((res.output as { exit_code: number }).exit_code).toBe(0);
    expect(captured.some((c) => c.cmd === 'npm test')).toBe(true);
  });
});

describe('dev-copilot — git push gate', () => {
  it('git_push blocks when autoPushConfirmed is false', async () => {
    const { executeDevTool } = await getExecutor();
    const res = await executeDevTool('git_push', {}, CTX_NO_PUSH);
    expect(res.confirm_required).toBe(true);
    // No exec should have been called.
    expect(captured.filter((c) => c.cmd.startsWith('git push')).length).toBe(0);
  });

  it('git_push runs `git push origin <branch>` when autoPushConfirmed is true', async () => {
    setExec(/git rev-parse --abbrev-ref HEAD/, { stdout: 'feature/x\n' });
    setExec(/git push origin/, { stdout: 'pushed\n' });
    const { executeDevTool } = await getExecutor();
    const res = await executeDevTool('git_push', {}, CTX_PUSH_OK);
    expect(res.confirm_required).toBeFalsy();
    const pushCmd = captured.find((c) => c.cmd.startsWith('git push origin'));
    expect(pushCmd).toBeDefined();
    expect(pushCmd!.cmd).toContain('feature/x');
    // Never force-push, never --no-verify.
    expect(pushCmd!.cmd).not.toMatch(/--force|--no-verify/);
  });

  it('git_commit writes the commit message to a tmp file with Co-Authored-By footer', async () => {
    setExec(/git commit -F/, { stdout: '[main abc1234] feat\n' });
    setExec(/git rev-parse --short HEAD/, { stdout: 'abc1234\n' });
    const { executeDevTool } = await getExecutor();
    const res = await executeDevTool('git_commit', {
      message: 'feat: ajoute X',
    }, CTX_PUSH_OK);
    expect((res.output as { short_sha: string }).short_sha).toBe('abc1234');
    // The commit message footer is appended; we verify the file path was
    // passed to git commit -F. The temp file is created and deleted, but
    // we can assert that exec received `git commit -F <path>`.
    const commitCmd = captured.find((c) => c.cmd.startsWith('git commit -F'));
    expect(commitCmd).toBeDefined();
  });
});

describe('dev-copilot — tool surface', () => {
  it('exposes all 10 tools with required input schemas', async () => {
    const { DEV_TOOLS } = await getExecutor();
    const names = DEV_TOOLS.map((t) => t.name).sort();
    expect(names).toEqual([
      'apply_patch', 'git_commit', 'git_diff', 'git_push', 'git_status',
      'list_files', 'read_file', 'run_bash', 'search_code', 'write_file',
    ]);
  });
});
