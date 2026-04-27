'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from './cn';

interface Props {
  children: ReactNode;
  /**
   * Translation factor. Negative values move slower than scroll (background
   * effect), positive values move faster (foreground accent). 0 = static.
   * Typical range: -0.4 to 0.4.
   */
  speed?: number;
  className?: string;
  /** Disable on small screens where parallax can feel jittery. Default true. */
  disableOnMobile?: boolean;
}

/**
 * Scroll-coupled translateY wrapper. Use it to differentiate the motion of a
 * background image vs the foreground text in a hero, or to give a section a
 * subtle "rising" feel as the user scrolls past. Pure CSS transform via
 * requestAnimationFrame — no IntersectionObserver, no layout thrash.
 */
export function Parallax({ children, speed = -0.2, className, disableOnMobile = true }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (disableOnMobile && window.matchMedia('(max-width: 640px)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let raf = 0;
    let pending = false;

    const update = () => {
      pending = false;
      const rect = el.getBoundingClientRect();
      const viewportH = window.innerHeight;
      // Center-relative offset: 0 when element center is at viewport center.
      const centerOffset = rect.top + rect.height / 2 - viewportH / 2;
      const y = centerOffset * speed;
      el.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
    };

    const onScroll = () => {
      if (pending) return;
      pending = true;
      raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [speed, disableOnMobile]);

  return (
    <div ref={ref} className={cn('will-change-transform', className)}>
      {children}
    </div>
  );
}
