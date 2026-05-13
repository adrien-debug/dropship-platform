'use client';

import { type ReactNode } from 'react';
import { LeftContextPanel } from './LeftContextPanel';
import { ChatPanel } from './ChatPanel';
import { RightContextPanel } from './RightContextPanel';

interface MainWorkspaceProps {
  children: ReactNode;
}

/**
 * MainWorkspace — central area with responsive 3-panel layout.
 *
 * Desktop (xl+):  LeftPanel | ChatPanel | RightPanel
 * Tablet (lg-xl): LeftPanel | ChatPanel
 * Mobile (<lg):   ChatPanel only (full width)
 */
export function MainWorkspace({ children }: MainWorkspaceProps) {
  return (
    <main className="flex flex-1 min-w-0 h-full bg-ds-bg-base relative">
      {/* Left panel — hidden below xl */}
      <LeftContextPanel />

      {/* Center chat — always visible, full width on mobile */}
      <ChatPanel>{children}</ChatPanel>

      {/* Right panel — hidden below 2xl */}
      <RightContextPanel />
    </main>
  );
}
