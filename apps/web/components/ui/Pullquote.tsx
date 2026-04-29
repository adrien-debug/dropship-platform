import type { ReactNode } from 'react';
import { cn } from './cn';

interface Props {
  children: ReactNode;
  attribution?: ReactNode;
  /** Accent bar color — defaults to current text color via border-current. */
  accentColor?: string;
  tone?: 'default' | 'inverse';
  className?: string;
}

/**
 * Editorial-grade pullquote. Use it once per long page to break up dense
 * sections with a large italic serif statement (DTC sites use this to set
 * tone — Apple, Bose, Allbirds). Don't use as a general "quote" component
 * — for testimonials prefer a `<figure>` with `<blockquote>`.
 */
export function Pullquote({
  children,
  attribution,
  accentColor,
  tone = 'default',
  className,
}: Props) {
  const textClass = tone === 'inverse' ? 'text-white' : 'text-zinc-900';
  const attribClass = tone === 'inverse' ? 'text-white/60' : 'text-zinc-500';
  return (
    <figure className={cn('relative max-w-4xl mx-auto', className)}>
      <span
        aria-hidden="true"
        className="absolute -left-3 sm:-left-6 top-2 bottom-2 w-px"
        style={{ backgroundColor: accentColor || 'currentColor', opacity: accentColor ? 1 : 0.25 }}
      />
      <blockquote
        className={cn(
          'font-serif italic tracking-tight leading-[1.15] text-3xl sm:text-4xl lg:text-5xl',
          textClass,
        )}
      >
        {children}
      </blockquote>
      {attribution && (
        <figcaption
          className={cn(
            'mt-6 text-kicker uppercase tracking-kicker font-medium',
            attribClass,
          )}
        >
          {attribution}
        </figcaption>
      )}
    </figure>
  );
}
