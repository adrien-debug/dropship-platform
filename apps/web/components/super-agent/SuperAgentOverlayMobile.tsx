'use client';

import { useEffect, useState } from 'react';
import SuperAgentOverlay from './SuperAgentOverlay';

/**
 * SuperAgentOverlayMobile — mounts the floating overlay ONLY on mobile/tablet
 * (viewport < 1024px). On desktop, the Super Agent lives in RailRight.
 * Uses matchMedia so SSR renders nothing (avoids hydration mismatch).
 */
export default function SuperAgentOverlayMobile() {
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  if (!isMobile) return null;
  return <SuperAgentOverlay />;
}
