import { cookies } from 'next/headers';

/**
 * RGPD consent state, persisted in a 1st-party cookie. Three values:
 *  - 'granted'  : visitor accepted, third-party tags can fire
 *  - 'denied'   : visitor refused, no tags fire (banner stays hidden)
 *  - 'unknown'  : not asked yet, banner shows, no tags fire
 *
 * Storefront layout reads this server-side via `getConsent()` so SSR-injected
 * scripts only ship to the client when consent is granted.
 *
 * The cookie NAME lives in `lib/consent-shared.ts` so the client banner can
 * reference it without pulling `next/headers` into the browser bundle.
 */
export { CONSENT_COOKIE } from './consent-shared';

export type ConsentState = 'granted' | 'denied' | 'unknown';

import { CONSENT_COOKIE } from './consent-shared';

export async function getConsent(): Promise<ConsentState> {
  const c = await cookies();
  const v = c.get(CONSENT_COOKIE)?.value;
  if (v === 'granted') return 'granted';
  if (v === 'denied') return 'denied';
  return 'unknown';
}
