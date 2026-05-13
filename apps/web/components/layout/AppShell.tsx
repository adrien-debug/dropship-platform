'use client';

import { type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';
import { NavigationProvider } from './NavigationContext';
import { Sidebar } from './Sidebar';
import { MainWorkspace } from './MainWorkspace';

interface AppShellProps {
  children: ReactNode;
}

/**
 * AppShell — root layout container.
 *
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │  Sidebar  │         MainWorkspace                           │
 *   │  (72px)   │  ┌─────────┬──────────┬─────────────────────┐  │
 *   │           │  │ LeftCtx │  Chat    │ RightCtx            │  │
 *   │           │  │(300px)  │ (flex-1) │ (360px)             │  │
 *   │           │  └─────────┴──────────┴─────────────────────┘  │
 *   └─────────────────────────────────────────────────────────────┘
 */
export function AppShell({ children }: AppShellProps) {
  return (
    <NavigationProvider>
      <div
        className={cn(
          'flex h-[100dvh] w-full overflow-hidden',
          'bg-ds-bg-base text-ds-text-primary',
          'selection:bg-[var(--accent-cyan)]/20 selection:text-[var(--text-primary)]',
        )}
      >
        <Sidebar />
        <MainWorkspace>{children}</MainWorkspace>
      </div>
    </NavigationProvider>
  );
}
