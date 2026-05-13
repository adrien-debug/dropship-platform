'use client';

import { cn } from '@/lib/utils/cn';
import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';

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
    <div className={cn('mx-auto hidden md:flex h-12 gap-5 items-center', className)}>
      {items.map((item) => (
        <IconContainer key={item.title} {...item} />
      ))}
    </div>
  );
}

function IconContainer({ title, icon, href }: DockItem) {
  const [hovered, setHovered] = useState(false);

  return (
    <Link href={href}>
      <motion.div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="flex flex-col items-center gap-1 relative"
      >
        <motion.div
          animate={{ y: hovered ? -7 : 0, scale: hovered ? 1.15 : 1, opacity: hovered ? 1 : 0.75 }}
          transition={{ type: 'spring', stiffness: 350, damping: 22 }}
          className="flex items-center justify-center text-white"
          style={{ filter: hovered ? 'drop-shadow(0 0 6px rgba(255,255,255,0.55))' : 'none' }}
        >
          {icon}
        </motion.div>
        <AnimatePresence>
          {hovered && (
            <motion.span
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="absolute -bottom-5 whitespace-nowrap text-[10px] font-medium text-white/90"
            >
              {title}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>
    </Link>
  );
}
