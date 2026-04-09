import { NextResponse } from 'next/server';
import { execSync } from 'child_process';
import { homedir } from 'os';

const GPU2_HOST = process.env['GPU2_HOST'] ?? '100.110.74.114';
const GPU2_USER = process.env['GPU2_USER'] ?? process.env['GPU_SSH_USER'] ?? 'comput3';

const EXEC_OPTS = {
  timeout: 15_000,
  encoding: 'utf-8' as const,
  shell: '/bin/zsh',
  env: {
    ...process.env,
    PATH: `${process.env.PATH}:/usr/local/bin:/opt/homebrew/bin:${homedir()}/.nvm/versions/node/v22.14.0/bin`,
  },
};

interface Slot {
  port: number;
  status: 'available' | 'in-use' | 'unknown';
  hasNodeModules: boolean;
}

export async function GET() {
  try {
    const output = execSync(
      `ssh ${GPU2_USER}@${GPU2_HOST} 'for d in /home/${GPU2_USER}/slots/slot-*; do [ -d "$d" ] || continue; PORT=$(cat "$d/.port" 2>/dev/null || echo 0); STATUS=$(cat "$d/.status" 2>/dev/null || echo unknown); NM=$([ -d "$d/node_modules" ] && echo true || echo false); echo "$PORT|$STATUS|$NM"; done'`,
      EXEC_OPTS,
    ).trim();

    if (!output) {
      return NextResponse.json({ slots: [], total: 0, available: 0 });
    }

    const slots: Slot[] = output.split('\n').filter(Boolean).map(line => {
      const parts = line.split('|');
      const [port, status, hasNm] = [parts[0] ?? '0', parts[1] ?? 'unknown', parts[2] ?? 'false'];
      return {
        port: parseInt(port) || 0,
        status: (status === 'available' ? 'available' : status === 'in-use' ? 'in-use' : 'unknown') as Slot['status'],
        hasNodeModules: hasNm === 'true',
      };
    });

    return NextResponse.json({
      slots,
      total: slots.length,
      available: slots.filter(s => s.status === 'available').length,
    });
  } catch (err) {
    console.error('[gpu/slots] Error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ slots: [], total: 0, available: 0, error: 'SSH failed' }, { status: 500 });
  }
}
