'use client';

import { useEffect } from 'react';

/**
 * Warn the user before unloading the page if there are unsaved changes.
 * The browser shows its native dialog — message text is ignored on modern
 * browsers (Chrome shows a generic "Changes you made may not be saved").
 */
export function useUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);
}
