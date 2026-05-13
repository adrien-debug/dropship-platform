'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react';

/**
 * NavigationContext — central state for the 3-panel layout.
 *
 * Drives:
 *   - which chat surface is active (none, store-copilot, research-copilot)
 *   - left panel content key
 *   - right panel content key
 *   - active store context (when in a store route)
 */

export type ChatSurface =
  | { type: 'none' }
  | { type: 'store-copilot'; storeId: string; storeSlug: string; storeName: string }
  | { type: 'research-copilot' };

export interface NavigationState {
  chatSurface: ChatSurface;
  leftPanelKey: string;
  rightPanelKey: string;
}

interface NavigationContextValue extends NavigationState {
  setChatSurface: (surface: ChatSurface) => void;
  setLeftPanelKey: (key: string) => void;
  setRightPanelKey: (key: string) => void;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [chatSurface, setChatSurface] = useState<ChatSurface>({ type: 'none' });
  const [leftPanelKey, setLeftPanelKey] = useState('default');
  const [rightPanelKey, setRightPanelKey] = useState('default');

  return (
    <NavigationContext.Provider
      value={{
        chatSurface,
        leftPanelKey,
        rightPanelKey,
        setChatSurface,
        setLeftPanelKey,
        setRightPanelKey,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const ctx = useContext(NavigationContext);
  if (!ctx) {
    throw new Error('useNavigation must be used within NavigationProvider');
  }
  return ctx;
}

/**
 * Hook to set the chat surface for a store route.
 * Call this from store pages/layouts to activate the copilot.
 */
export function useStoreChat(storeId: string, storeSlug: string, storeName: string) {
  const { setChatSurface } = useNavigation();

  const activate = useCallback(() => {
    setChatSurface({ type: 'store-copilot', storeId, storeSlug, storeName });
  }, [setChatSurface, storeId, storeSlug, storeName]);

  const deactivate = useCallback(() => {
    setChatSurface({ type: 'none' });
  }, [setChatSurface]);

  return { activate, deactivate };
}
