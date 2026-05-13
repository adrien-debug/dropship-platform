import type { ReactNode, ElementType } from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * Typographic scale — Satoshi Variable.
 *
 * The scale relies on weight + size + tracking, all driven from the same
 * variable family. Pick a level (h1/h2/h3/h4); the component handles size,
 * weight, tracking and leading. The `as` prop swaps the rendered element
 * for semantic accuracy (a hero might be `<h1>` but rendered like an h2).
 */

type HeadingLevel = 'h1' | 'h2' | 'h3' | 'h4';

const HEADING_STYLES: Record<HeadingLevel, string> = {
  // Display / hero — Satoshi at max weight, tight tracking, near-flush lines.
  h1: 'text-[clamp(2.75rem,7vw,6.5rem)] font-black tracking-[-0.045em] leading-[0.95]',
  // Section title — clear weight contrast vs body without competing with h1.
  h2: 'text-[clamp(2rem,4.5vw,4rem)] font-extrabold tracking-[-0.035em] leading-[1.02]',
  // Sub-section / card header.
  h3: 'text-[clamp(1.5rem,2.6vw,2.25rem)] font-bold tracking-[-0.025em] leading-[1.1]',
  // Block / list header.
  h4: 'text-[clamp(1.125rem,1.5vw,1.375rem)] font-semibold tracking-[-0.015em] leading-[1.25]',
};

interface HeadingProps {
  /** Override the rendered HTML element (semantic vs visual). */
  as?: ElementType;
  /** Visual level. Defaults to h2 (the most common "section title" use case). */
  level?: HeadingLevel;
  children: ReactNode;
  className?: string;
  id?: string;
}

/**
 * Single headline primitive. `level` controls the visual size, `as` controls
 * the rendered element (defaults to the same level). Use `as="h1" level="h2"`
 * when a page's main heading should look smaller than a hero.
 */
export function Heading({
  as,
  level = 'h2',
  children,
  className,
  id,
}: HeadingProps) {
  const Tag = (as ?? level) as 'h2';
  return (
    <Tag id={id} className={cn('font-sans text-zinc-900', HEADING_STYLES[level], className)}>
      {children}
    </Tag>
  );
}

interface LedeProps {
  children: ReactNode;
  className?: string;
  /** Tone overrides default zinc-600. */
  tone?: 'default' | 'inverse';
}

/**
 * Lead paragraph that sits under a Heading. Larger than body, slightly muted.
 */
export function Lede({ children, className, tone = 'default' }: LedeProps) {
  const colorClass = tone === 'inverse' ? 'text-white/80' : 'text-zinc-600';
  return (
    <p
      className={cn(
        'text-lg sm:text-xl leading-relaxed font-normal tracking-[-0.01em]',
        colorClass,
        className,
      )}
    >
      {children}
    </p>
  );
}

interface KickerProps {
  children: ReactNode;
  className?: string;
  tone?: 'default' | 'inverse';
}

/**
 * Tiny uppercase label that sits above a Heading. The "section badge".
 */
export function Kicker({ children, className, tone = 'default' }: KickerProps) {
  const colorClass = tone === 'inverse' ? 'text-white/60' : 'text-zinc-400';
  return (
    <p className={cn('text-kicker uppercase tracking-kicker font-medium', colorClass, className)}>
      {children}
    </p>
  );
}
