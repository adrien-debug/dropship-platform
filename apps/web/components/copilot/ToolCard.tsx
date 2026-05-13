'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils/cn';
import {
  Folder,
  FileText,
  Check,
  Pause,
  Rocket,
} from 'lucide-react';

interface ToolCardProps {
  name: string;
  input: unknown;
  output: unknown;
  isError?: boolean;
  content?: string;
}

/**
 * ToolCard — collapsible card for tool execution results.
 *
 * Renders specialised output for known tools:
 *   - read_file: code preview
 *   - write_file / apply_patch: file path + bytes
 *   - run_bash: command + stdout/stderr
 *   - git_commit: commit sha + message
 *   - git_push: branch info
 *   - git_status / git_diff: diff output
 *   - search_code: matches list
 *   - list_files: file tree
 */
export function ToolCard({ name, input, output, isError, content }: ToolCardProps) {
  const [open, setOpen] = useState(true);
  const hasOutput = output !== null && output !== undefined;
  const statusColor = isError
    ? 'bg-[var(--danger)]'
    : hasOutput
      ? 'bg-[var(--success)]'
      : 'bg-[var(--warning)]';

  return (
    <div
      className={cn(
        'rounded-xl border text-sm overflow-hidden',
        isError ? 'border-[var(--danger-muted)]' : 'border-ds-border-subtle',
      )}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-2.5 flex items-center gap-2.5 text-left hover:bg-ds-surface-default transition-colors"
      >
        <span className={cn('inline-block w-1.5 h-1.5 rounded-full', statusColor)} />
        <code className="font-mono text-[11px] text-ds-text-secondary">{name}</code>
        {content && (
          <span className="ml-auto text-xs text-ds-text-muted line-clamp-1">{content}</span>
        )}
        <span className="text-xs text-ds-text-muted">{open ? '▾' : '▸'}</span>
      </button>

      {/* Body */}
      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-ds-border-subtle space-y-3">
          <SpecialisedRenderer name={name} input={input} output={output} isError={isError ?? false} />

          <details className="text-xs text-ds-text-muted">
            <summary className="cursor-pointer hover:text-ds-text-secondary transition-colors">
              Détails techniques
            </summary>
            <div className="mt-2 space-y-2">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-ds-text-muted font-medium">input</div>
                <pre className="mt-1 bg-ds-bg-base rounded-lg p-2.5 overflow-x-auto font-mono text-[11px] text-ds-text-secondary border border-ds-border-subtle">
                  {JSON.stringify(input ?? {}, null, 2)}
                </pre>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-ds-text-muted font-medium">output</div>
                <pre className="mt-1 bg-ds-bg-base rounded-lg p-2.5 overflow-x-auto font-mono text-[11px] text-ds-text-secondary border border-ds-border-subtle">
                  {JSON.stringify(output ?? {}, null, 2)}
                </pre>
              </div>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}

function SpecialisedRenderer({
  name,
  input,
  output,
  isError,
}: {
  name: string;
  input: unknown;
  output: unknown;
  isError: boolean;
}) {
  if (!output) return null;
  const out = output as Record<string, unknown>;
  const inp = (input ?? {}) as Record<string, unknown>;

  if (name === 'read_file') {
    const content = typeof out.content === 'string' ? out.content : '';
    const preview = content.split('\n').slice(0, 20).join('\n');
    return (
      <div className="text-xs space-y-1">
        <p className="font-mono text-ds-text-secondary">{String(inp.path ?? '')}</p>
        <pre className="bg-ds-bg-base text-ds-text-primary rounded-lg p-3 overflow-x-auto font-mono text-[11px] border border-ds-border-subtle">
          {preview}{content.split('\n').length > 20 ? '\n…' : ''}
        </pre>
      </div>
    );
  }

  if (name === 'write_file' || name === 'apply_patch') {
    return (
      <div className="text-xs">
        <p className="font-mono text-ds-text-secondary">{String(inp.path ?? '')}</p>
        <p className="mt-1 text-ds-text-muted">
          {name === 'apply_patch' ? 'Patch appliqué' : `Écriture (${out.bytes ?? '?'} octets)`}
        </p>
      </div>
    );
  }

  if (name === 'run_bash') {
    const stdout = typeof out.stdout === 'string' ? out.stdout : '';
    const stderr = typeof out.stderr === 'string' ? out.stderr : '';
    const exitCode = typeof out.exit_code === 'number' ? out.exit_code : '?';
    return (
      <div className="text-xs space-y-1">
        <p className="font-mono text-ds-text-secondary">$ {String(out.command ?? inp.command ?? '')}</p>
        {stdout && (
          <pre className="bg-ds-bg-base text-ds-text-primary rounded-lg p-3 overflow-x-auto font-mono text-[11px] border border-ds-border-subtle">{stdout}</pre>
        )}
        {stderr && (
          <pre className="bg-[var(--danger-muted)] text-[var(--danger)] rounded-lg p-3 overflow-x-auto font-mono text-[11px] border border-[var(--danger-muted)]">{stderr}</pre>
        )}
        <p className={cn('font-medium text-xs', exitCode === 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]')}>
          exit {exitCode}
        </p>
      </div>
    );
  }

  if (name === 'git_commit') {
    if (out.empty) return <p className="text-xs text-ds-text-muted">Rien à commiter.</p>;
    return (
      <div className="inline-flex items-center gap-2 text-xs bg-[var(--success-muted)] text-[var(--success)] px-2.5 py-1 rounded-full">
        <Check size={12} strokeWidth={2.5} aria-hidden />
        <span>commit</span>
        <code className="font-mono">{String(out.short_sha ?? '')}</code>
        <span>{String(out.message ?? '').slice(0, 60)}</span>
      </div>
    );
  }

  if (name === 'git_push') {
    if (out.confirm_required) {
      return (
        <p className="text-xs text-[var(--warning)] bg-[var(--warning-muted)] px-2.5 py-1 rounded inline-flex items-center gap-1.5">
          <Pause size={12} strokeWidth={2.5} aria-hidden />
          En attente de confirmation utilisateur.
        </p>
      );
    }
    return (
      <div className="inline-flex items-center gap-2 text-xs bg-[var(--info-muted)] text-[var(--info)] px-2.5 py-1 rounded-full">
        <Rocket size={12} strokeWidth={2} aria-hidden />
        pushed to {String(out.branch ?? 'origin')}
      </div>
    );
  }

  if (name === 'git_status' || name === 'git_diff') {
    const text = typeof out.porcelain === 'string' ? out.porcelain : typeof out.diff === 'string' ? out.diff : '';
    return (
      <pre className="bg-ds-bg-base text-ds-text-primary rounded-lg p-3 overflow-x-auto font-mono text-[11px] border border-ds-border-subtle max-h-72">{text || '(vide)'}</pre>
    );
  }

  if (name === 'search_code') {
    const matches = Array.isArray(out.matches) ? (out.matches as Array<{ file: string; line: number; content: string }>) : [];
    if (matches.length === 0) return <p className="text-xs text-ds-text-muted">Aucun match.</p>;
    return (
      <div className="text-xs space-y-0.5 font-mono">
        {matches.slice(0, 12).map((m, i) => (
          <div key={i} className="truncate">
            <span className="text-ds-text-muted">{m.file}:{m.line}</span>{' '}
            <span className="text-ds-text-secondary">{m.content.trim()}</span>
          </div>
        ))}
        {matches.length > 12 && <p className="text-ds-text-muted">…et {matches.length - 12} de plus</p>}
      </div>
    );
  }

  if (name === 'list_files') {
    const entries = Array.isArray(out.entries) ? (out.entries as Array<{ path: string; type: string }>) : [];
    return (
      <div className="text-xs font-mono space-y-0.5 max-h-48 overflow-y-auto">
        {entries.slice(0, 30).map((e, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="text-ds-text-muted inline-flex">
              {e.type === 'dir' ? <Folder size={12} strokeWidth={1.75} aria-hidden /> : <FileText size={12} strokeWidth={1.75} aria-hidden />}
            </span>
            <span className="text-ds-text-secondary">{e.path}</span>
          </div>
        ))}
        {entries.length > 30 && <p className="text-ds-text-muted">…et {entries.length - 30} de plus</p>}
      </div>
    );
  }

  if (isError && typeof out.error === 'string') {
    return <p className="text-xs text-[var(--danger)]">{out.error}</p>;
  }

  return null;
}
