'use client';
// WHY conditional: CockpitShell (admin chrome: RailLeft nav + RailRight SuperAgent + bordeaux bg)
// must only wrap /admin* routes. Storefront pages (/shop, /cart, /checkout, etc.) are
// independently themed and must NOT inherit the 3-column admin layout.
import { usePathname } from 'next/navigation';
import CockpitShell from '@/components/cockpit/CockpitShell';
import SuperAgentOverlayMobile from '@/components/super-agent/SuperAgentOverlayMobile';

export default function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith('/admin') ?? false;
  if (isAdmin) {
    return (
      <>
        {/* Wrap in a neutral dark container to prevent flash-of-white before
            CockpitShell (.ct-root) hydrates and paints its own background. */}
        <div style={{ minHeight: '100dvh', background: 'var(--ct-bg-deep)' }}>
          <CockpitShell>{children}</CockpitShell>
        </div>
        <SuperAgentOverlayMobile />
      </>
    );
  }
  return <>{children}</>;
}
