/**
 * Cookie name shared between the server consent helper (`lib/consent.ts`,
 * which can't be imported client-side because it pulls `next/headers`)
 * and the client banner / consent API. Any module that needs to know the
 * NAME of the cookie should import from here, not from `lib/consent.ts`.
 */
export const CONSENT_COOKIE = 'consent_analytics';
