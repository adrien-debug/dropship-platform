import type { ReactNode } from 'react';
import { cn } from './cn';

interface Props {
  /**
   * Items to scroll. Will be duplicated internally so the loop is seamless —
   * pass them once.
   */
  items: ReactNode[];
  /** Animation duration in seconds for one full loop. Default 40s. */
  duration?: number;
  /** Pause animation on hover so users can read items. Default true. */
  pauseOnHover?: boolean;
  /** Optional fade-out mask on left/right edges. Default true. */
  fadeEdges?: boolean;
  className?: string;
  /** Vertical padding within each item slot (Tailwind class). */
  gap?: string;
}

/**
 * Horizontally-scrolling, infinitely-looping strip. Use sparingly: it works
 * for press-logo bars or single-line testimonial tickers — never as a
 * general layout primitive. Pure CSS animation, server-renderable.
 */
export function Marquee({
  items,
  duration = 40,
  pauseOnHover = true,
  fadeEdges = true,
  className,
  gap = 'mx-8 sm:mx-12',
}: Props) {
  // Duplicate the list so the keyframe loop is seamless: when the first copy
  // ends at -50% the second copy is already in place.
  const doubled = [...items, ...items];

  return (
    <div
      className={cn(
        'relative overflow-hidden',
        fadeEdges && '[mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]',
        className,
      )}
    >
      <style>{`
        @keyframes uiMarqueeScroll {
          from { transform: translate3d(0,0,0); }
          to   { transform: translate3d(-50%,0,0); }
        }
        .ui-marquee-track {
          animation: uiMarqueeScroll var(--ui-marquee-duration, 40s) linear infinite;
        }
        .ui-marquee-host:hover .ui-marquee-pause {
          animation-play-state: paused;
        }
      `}</style>
      <div className={cn('ui-marquee-host')}>
        <div
          className={cn(
            'ui-marquee-track flex w-max items-center',
            pauseOnHover && 'ui-marquee-pause',
          )}
          style={{ ['--ui-marquee-duration' as string]: `${duration}s` }}
        >
          {doubled.map((node, i) => (
            <span key={i} className={cn('shrink-0 inline-flex items-center', gap)}>
              {node}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
