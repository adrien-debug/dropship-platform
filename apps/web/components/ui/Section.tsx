import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

type Tone = 'light' | 'dark' | 'muted';

interface Props {
  children: ReactNode;
  tone?: Tone;
  /** Constrain inner content width. Default 7xl, narrow=3xl for prose, wide=full. */
  width?: 'narrow' | 'default' | 'wide';
  /** Vertical padding. Default = 'lg' (24/28). */
  padding?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  innerClassName?: string;
  id?: string;
}

const TONE_CLASSES: Record<Tone, string> = {
  light: 'bg-white text-zinc-900',
  muted: 'bg-zinc-50 text-zinc-900',
  dark: 'bg-zinc-950 text-white',
};

const PADDING_CLASSES = {
  sm: 'py-12 sm:py-14',
  md: 'py-16 sm:py-20',
  lg: 'py-20 sm:py-24 lg:py-28',
  xl: 'py-24 sm:py-32 lg:py-36',
} as const;

const WIDTH_CLASSES = {
  narrow: 'max-w-3xl',
  default: 'max-w-7xl',
  wide: 'max-w-none',
} as const;

/**
 * Page-level horizontal band. Provides consistent vertical rhythm, max-width,
 * and tone (light/muted/dark). Every store section should be wrapped in one
 * — never use an ad-hoc <section className="py-..."> at the page level.
 */
export function Section({
  children,
  tone = 'light',
  width = 'default',
  padding = 'lg',
  className,
  innerClassName,
  id,
}: Props) {
  return (
    <section id={id} className={cn(TONE_CLASSES[tone], className)}>
      <div className={cn('mx-auto px-6 sm:px-8 lg:px-12', WIDTH_CLASSES[width], PADDING_CLASSES[padding], innerClassName)}>
        {children}
      </div>
    </section>
  );
}
