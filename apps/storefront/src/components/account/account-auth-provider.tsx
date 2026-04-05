'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import { clearAuthToken } from '@/lib/auth-token';
import { clearShopAuth, readShopAuth, writeShopAuth, type ShopAuthState } from '@/lib/shop-api-client';

interface AccountAuthContextValue {
  auth: ShopAuthState | null;
  refresh: () => void;
  logout: () => Promise<void>;
  setAuth: (s: ShopAuthState) => void;
}

const AccountAuthContext = createContext<AccountAuthContextValue | null>(null);

export function AccountAuthProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const router = useRouter();
  const [auth, setAuthState] = useState<ShopAuthState | null>(null);

  const refresh = useCallback(() => {
    setAuthState(readShopAuth());
  }, []);

  useLayoutEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    function onStorage(e: StorageEvent): void {
      if (e.key === 'onepeace_shop_auth') refresh();
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [refresh]);

  const setAuth = useCallback((s: ShopAuthState) => {
    writeShopAuth(s);
    setAuthState(s);
  }, []);

  const logout = useCallback(async () => {
    clearShopAuth();
    clearAuthToken();
    setAuthState(null);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      /* ignore */
    }
    router.push('/login');
  }, [router]);

  const value = useMemo(
    () => ({ auth, refresh, logout, setAuth }),
    [auth, refresh, logout, setAuth],
  );

  return <AccountAuthContext.Provider value={value}>{children}</AccountAuthContext.Provider>;
}

export function useAccountAuth(): AccountAuthContextValue {
  const ctx = useContext(AccountAuthContext);
  if (!ctx) {
    throw new Error('useAccountAuth must be used within AccountAuthProvider');
  }
  return ctx;
}
