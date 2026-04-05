/** localStorage key for the shop session JWT (issued by `/api/auth/login` or register auto-login). */
export const ONEPEACE_JWT_STORAGE_KEY = 'onepeace_shop_jwt';

export function persistAuthToken(token: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ONEPEACE_JWT_STORAGE_KEY, token);
  } catch {
    // ignore quota / private mode
  }
}

export function clearAuthToken(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(ONEPEACE_JWT_STORAGE_KEY);
  } catch {
    // ignore
  }
}
