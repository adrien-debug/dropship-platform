'use client';

/**
 * MerchantBottomBar — navigation principale admin.
 *
 * Utilise les classes CSS Cockpit : .ct-bottom-bar, .ct-bottom-bar-inner,
 * .ct-bottom-label, .ct-seg-track, .ct-seg-btn.
 *
 * Rendu uniquement sur les routes /admin/* (AppFrame le monte conditionnellement).
 * Ne touche pas au storefront (/shop/*, /cart, /checkout).
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavSegment {
  label: string;
  href: string;
  /** Si true → toujours actif sur ce préfixe exact (évite que / matche tout) */
  exact?: boolean;
}

const NAV: NavSegment[] = [
  { label: 'Dashboard', href: '/admin', exact: true },
  { label: 'Stores', href: '/admin/stores' },
  { label: 'Catalogue', href: '/admin/catalog' },
  { label: 'Commandes', href: '/admin/orders' },
  { label: 'Templates', href: '/admin/templates' },
  { label: 'Observabilité', href: '/admin/observability' },
  { label: 'Paramètres', href: '/admin/settings' },
];

export function MerchantBottomBar() {
  const pathname = usePathname();

  function isActive(seg: NavSegment): boolean {
    if (seg.exact) return pathname === seg.href;
    return pathname.startsWith(seg.href);
  }

  return (
    <div className="ct-bottom-bar">
      <div className="ct-bottom-bar-inner">
        {/* Wordmark / brand label */}
        <span className="ct-bottom-label">● Merchant</span>

        {/* Main nav segments */}
        <nav aria-label="Navigation admin" className="ct-seg-track">
          {NAV.map((seg) => (
            <Link
              key={seg.href}
              href={seg.href}
              className={`ct-seg-btn${isActive(seg) ? ' active' : ''}`}
            >
              {seg.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
