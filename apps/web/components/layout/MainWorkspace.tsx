'use client';

import { type ReactNode } from 'react';
import { ChatPanel } from './ChatPanel';

interface MainWorkspaceProps {
  children: ReactNode;
}

export function MainWorkspace({ children }: MainWorkspaceProps) {
  return (
    <main className="flex flex-1 min-w-0 h-full bg-ds-bg-base relative">
      <ChatPanel>{children}</ChatPanel>
    </main>
  );
}
