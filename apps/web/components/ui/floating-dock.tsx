'use client';

import { cn } from '@/lib/utils/cn';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode } from 'react';

export interface DockItem {
  title: string;
  icon: ReactNode;
  href: string;
}

export function FloatingDock({
  items,
  className,
}: {
  items: DockItem[];
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-1', className)}>
      {items.map((item) => (
        <DockTile key={item.title} {...item} />
      ))}
    </div>
  );
}

/**
 * Square tile with icon on top + label below. Always visible (no hover
 * tooltip), so the dock reads as a real navigation bar instead of a
 * mystery row of icons. The active route gets a subtle highlight so the
 * user always knows where they are.
 */
function DockTile({ title, icon, href }: DockItem) {
  const pathname = usePathname();
  const isActive =
    href === '/admin' ? pathname === '/admin' : pathname?.startsWith(href);

  return (
    <Link
      href={href}
      aria-label={title}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'group relative flex flex-col items-center justify-center gap-1 px-3 py-1.5 rounded-md min-w-[64px] transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-1 focus-visible:ring-offset-black',
        isActive
          ? 'bg-white/[0.10] text-white'
          : 'text-white/60 hover:text-white hover:bg-white/[0.06]',
      )}
    >
      <span className="flex items-center justify-center shrink-0">{icon}</span>
      <span
        className={cn(
          'text-[10px] leading-none tracking-[0.02em] whitespace-nowrap transition-colors',
          isActive ? 'font-semibold' : 'font-medium',
        )}
      >
        {title}
      </span>
      {/* Active dot indicator under the tile */}
      {isActive && (
        <span
          aria-hidden
          className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white"
        />
      )}
    </Link>
  );
}
