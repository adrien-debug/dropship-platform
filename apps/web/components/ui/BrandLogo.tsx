import { cn } from '@/lib/utils/cn';

interface Props {
  /** Brand name rendered as the wordmark. */
  name: string;
  /** Tint color for the mark's flow lines. Defaults to a soft currentColor. */
  accentColor?: string;
  /** `default` = dark on light, `inverse` = white on dark. */
  tone?: 'default' | 'inverse';
  /** Size preset. `header` for nav, `footer` for big sign-off, `inline` for small contexts. */
  size?: 'inline' | 'header' | 'footer';
  /** Hide the mark, render just the wordmark (rare; for very tight spaces). */
  wordmarkOnly?: boolean;
  className?: string;
}

const SIZE = {
  inline: { mark: 22, text: 'text-base', gap: 'gap-2' },
  header: { mark: 30, text: 'text-2xl', gap: 'gap-2.5' },
  footer: { mark: 48, text: 'text-3xl sm:text-4xl', gap: 'gap-4' },
} as const;

/**
 * The brand mark for any store on the platform. A small circular emblem
 * containing three flowing horizontal lines, paired with the store name set
 * in Fraunces. The emblem is intentionally abstract (reads as breeze, sound
 * wave, signal, momentum) so the same primitive works across niches without
 * being prescriptive.
 *
 * Use it wherever the store identity appears (header, footer, transactional
 * email header). Do NOT inline an ad-hoc `<span className="font-semibold">{name}</span>`
 * for branding — go through this component so swapping the platform-wide
 * mark is a single-file change.
 */
export function BrandLogo({
  name,
  accentColor,
  tone = 'inverse',
  size = 'header',
  wordmarkOnly = false,
  className,
}: Props) {
  const cfg = SIZE[size];
  const text = tone === 'inverse' ? 'text-white' : 'text-zinc-900';
  const ringColor = tone === 'inverse' ? 'rgba(255,255,255,0.85)' : 'rgba(15,23,42,0.85)';
  const flowColor = accentColor || (tone === 'inverse' ? 'rgba(255,255,255,0.55)' : 'rgba(15,23,42,0.55)');

  return (
    <span
      className={cn('inline-flex items-center', cfg.gap, text, className)}
      aria-label={name}
    >
      {!wordmarkOnly && (
        <span
          aria-hidden="true"
          className="relative inline-block shrink-0"
          style={{ width: cfg.mark, height: cfg.mark }}
        >
          <svg
            viewBox="0 0 32 32"
            width={cfg.mark}
            height={cfg.mark}
            fill="none"
            stroke={ringColor}
            strokeWidth="1"
            strokeLinecap="round"
          >
            <circle cx="16" cy="16" r="15" />
            {/* Three offset flow lines inside the ring. Each one curves
                slightly upward to suggest motion / lift / breeze. */}
            <path d="M 7 12.5 C 11 11.5, 21 11.5, 25 12.5" stroke={flowColor} strokeWidth="0.9" />
            <path d="M 7 16   C 11 15,   21 15,   25 16"   stroke={flowColor} strokeWidth="0.9" />
            <path d="M 7 19.5 C 11 18.5, 21 18.5, 25 19.5" stroke={flowColor} strokeWidth="0.9" />
          </svg>
        </span>
      )}
      <span
        className={cn(
          'font-semibold leading-none [letter-spacing:-0.02em]',
          cfg.text,
        )}
      >
        {name}
      </span>
    </span>
  );
}
