'use client';

import { type ReactNode } from 'react';

interface LegacyContentWrapperProps {
  children: ReactNode;
}

/**
 * LegacyContentWrapper — thin wrapper for page content in the dark theme.
 *
 * Previously handled color inversion for light-themed pages. Now that
 * all major pages are migrated, this simply provides consistent padding
 * and scroll behavior.
 */
export function LegacyContentWrapper({ children }: LegacyContentWrapperProps) {
  return (
    <div className="h-full overflow-y-auto bg-ds-bg-base">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-8 sm:py-10">
        {children}
      </div>
    </div>
  );
}
