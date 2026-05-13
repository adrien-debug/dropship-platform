import type { ReactNode } from 'react';
import { Heading, Kicker, Lede } from './Typography';
import { cn } from './cn';

interface Props {
  kicker?: string;
  title: ReactNode;
  lede?: ReactNode;
  align?: 'left' | 'center';
  tone?: 'default' | 'inverse';
  className?: string;
  /** Visual level of the title heading. Defaults to h2 (section-level). */
  level?: 'h1' | 'h2' | 'h3';
}

/**
 * The standard header for a Section. Kicker / Heading / Lede in a single
 * vertical stack. Use it at the top of every Section so cadence and spacing
 * are identical across the page.
 */
export function SectionHeader({
  kicker,
  title,
  lede,
  align = 'center',
  tone = 'default',
  className,
  level = 'h2',
}: Props) {
  return (
    <div
      className={cn(
        align === 'center' ? 'text-center mx-auto max-w-3xl' : 'text-left max-w-3xl',
        className,
      )}
    >
      {kicker && (
        <div className="mb-4">
          <Kicker tone={tone}>{kicker}</Kicker>
        </div>
      )}
      <Heading level={level} className={tone === 'inverse' ? 'text-white' : 'text-zinc-900'}>
        {title}
      </Heading>
      {lede && (
        <div className="mt-5">
          <Lede tone={tone}>{lede}</Lede>
        </div>
      )}
    </div>
  );
}
