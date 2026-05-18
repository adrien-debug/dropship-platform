'use client';
// WHY conditional: CockpitShell (admin chrome: RailLeft nav + RailRight SuperAgent + bordeaux bg)
// must only wrap /admin* routes. Storefront pages (/shop, /cart, /checkout, etc.) are
// independently themed and must NOT inherit the 3-column admin layout.
import { usePathname } from 'next/navigation';
import { CockpitShell } from '@hearst/cockpit-shell';
import SuperAgentOverlayMobile from '@/components/super-agent/SuperAgentOverlayMobile';
import { createClientChatPersistence } from './cockpit-chat-persistence-client';

const MERCHANT_PRODUCTS = [
  { id: 'merchant' as const, name: 'Hearst Merchant', short: 'MR', color: '#F0567A' },
];

const chatConfig = { persistence: createClientChatPersistence() };

export default function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith('/admin') ?? false;
  if (isAdmin) {
    return (
      <>
        {/* Wrap in a neutral dark container to prevent flash-of-white before
            CockpitShell (.ct-root) hydrates and paints its own background. */}
        <div style={{ minHeight: '100dvh', background: 'var(--ct-bg-deep)' }}>
          <CockpitShell products={MERCHANT_PRODUCTS} appId="merchant" chatConfig={chatConfig}>
            {children}
          </CockpitShell>
        </div>
        <SuperAgentOverlayMobile />
      </>
    );
  }
  return <>{children}</>;
}
