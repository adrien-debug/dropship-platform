import type { ReactNode, ElementType } from 'react';
import { cn } from './cn';

type HeadingSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'hero';

const HEADING_SIZE: Record<HeadingSize, string> = {
  sm: 'text-2xl sm:text-3xl',
  md: 'text-3xl sm:text-4xl',
  lg: 'text-4xl sm:text-5xl',
  xl: 'text-4xl sm:text-5xl lg:text-6xl',
  '2xl': 'text-5xl sm:text-6xl lg:text-7xl',
  hero: 'text-5xl sm:text-6xl lg:text-7xl xl:text-8xl',
};

interface HeadingProps {
  as?: ElementType;
  children: ReactNode;
  size?: HeadingSize;
  className?: string;
  id?: string;
}

/**
 * The single way to render a display-style heading. Always serif (Fraunces),
 * tight tracking, snug leading. Pick a size; let the component handle responsive
 * scaling.
 */
export function Heading({ as = 'h2', children, size = 'lg', className, id }: HeadingProps) {
  // TS gets confused by polymorphic ElementType + strict children inference;
  // a runtime-stable cast is the cleanest escape hatch.
  const Tag = as as 'h2';
  return (
    <Tag id={id} className={cn('font-serif tracking-tight leading-[1.05]', HEADING_SIZE[size], className)}>
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
    <p className={cn('text-lg sm:text-xl leading-relaxed', colorClass, className)}>{children}</p>
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
    <p className={cn('text-[10px] uppercase tracking-[0.3em] font-medium', colorClass, className)}>
      {children}
    </p>
  );
}
