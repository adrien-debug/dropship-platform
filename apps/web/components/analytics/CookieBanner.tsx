'use client';

import { useEffect, useState } from 'react';
import { CONSENT_COOKIE } from '@/lib/consent-shared';
import { apiFetch } from '@/lib/client-fetch';

/**
 * Minimal, self-contained RGPD banner. Shows only when the consent cookie
 * is unset; on Accept / Refuse, POSTs the choice to /api/consent (which
 * writes the cookie HTTP-side) then reloads the page so SSR re-injects
 * (or re-omits) the analytics tags.
 */
export function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    // Show only if cookie is not set.
    const cookies = document.cookie.split('; ');
    const has = cookies.some((c) => c.startsWith(`${CONSENT_COOKIE}=`));
    if (!has) setVisible(true);
  }, []);

  async function choose(choice: 'granted' | 'denied') {
    setPending(true);
    try {
      await apiFetch('/api/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ choice }),
      });
      // Hard reload so the layout re-runs SSR and emits / omits tags
      // accordingly. Without this, tags only kick in on next navigation.
      window.location.reload();
    } catch {
      setPending(false);
    }
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-md z-[60]">
      <div
        className="rounded-2xl p-5 sm:p-6"
        style={{
          background: 'var(--ct-surface-2)',
          border: '1px solid var(--ct-border-strong)',
          boxShadow: 'var(--ct-shadow-depth)',
          backdropFilter: 'blur(24px) saturate(150%)',
          WebkitBackdropFilter: 'blur(24px) saturate(150%)',
        }}
      >
        <p
          className="text-[10px] uppercase tracking-[0.14em] font-bold mb-3"
          style={{ color: 'var(--ct-text-muted)' }}
        >
          Cookies
        </p>
        <p
          className="text-sm leading-relaxed mb-5"
          style={{ color: 'var(--ct-text-body)' }}
        >
          On utilise des cookies de mesure d&apos;audience pour comprendre comment notre site est
          utilisé et améliorer l&apos;expérience. Aucune donnée personnelle n&apos;est revendue. Tu
          peux refuser sans impact sur ta navigation.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => choose('denied')}
            disabled={pending}
            className="flex-1 px-4 py-2.5 rounded-full text-xs uppercase tracking-[0.1em] font-medium disabled:opacity-50"
            style={{
              color: 'var(--ct-text-body)',
              border: '1px solid var(--ct-border-strong)',
              background: 'transparent',
              transition: 'background var(--ct-dur-base) var(--ct-ease)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'var(--ct-surface-3)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            }}
          >
            Refuser
          </button>
          <button
            type="button"
            onClick={() => choose('granted')}
            disabled={pending}
            className="flex-1 px-4 py-2.5 rounded-full text-xs uppercase tracking-[0.1em] font-medium disabled:opacity-50"
            style={{
              background: 'var(--ct-accent)',
              color: 'var(--ct-text-strong)',
              transition: 'opacity var(--ct-dur-base) var(--ct-ease)',
            }}
          >
            Accepter
          </button>
        </div>
      </div>
    </div>
  );
}
