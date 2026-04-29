import { cn } from './cn';

interface Props {
  label: string;
  tone?: 'default' | 'inverse';
}

export function TrustItem({ label, tone = 'default' }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 text-xs uppercase tracking-cta font-medium',
        tone === 'inverse' ? 'text-white/85' : 'text-zinc-600',
      )}
    >
      <span
        className={cn('h-1 w-1 rounded-full', tone === 'inverse' ? 'bg-white/60' : 'bg-zinc-400')}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}
