'use client';

import { useEffect, useState } from 'react';
import { CONSENT_COOKIE } from '@/lib/consent-shared';
import { apiFetch } from '@/lib/client-fetch';

/**
 * Minimal, self-contained RGPD banner. Shows only when the consent cookie
 * is unset; on Accept / Refuse, POSTs the choice to /api/consent (which
 * writes the cookie HTTP-side) then reloads the page so SSR re-injects
 * (or re-omits) the analytics tags. Self-styled — doesn't pull from the
 * design system because it must render even on edge cases where the
 * layout is missing.
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
      <div className="bg-white rounded-2xl shadow-2xl border border-zinc-200 p-5 sm:p-6">
        <p className="text-kicker uppercase tracking-kicker text-zinc-400 font-medium mb-3">
          Cookies
        </p>
        <p className="text-sm text-zinc-700 leading-relaxed mb-5">
          On utilise des cookies de mesure d&apos;audience pour comprendre comment notre site est utilisé et améliorer l&apos;expérience.
          Aucune donnée personnelle n&apos;est revendue. Tu peux refuser sans impact sur ta navigation.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => choose('denied')}
            disabled={pending}
            className="flex-1 border border-zinc-200 text-zinc-700 px-4 py-2.5 rounded-full text-xs uppercase tracking-cta font-medium hover:bg-zinc-50 transition-colors disabled:opacity-50"
          >
            Refuser
          </button>
          <button
            type="button"
            onClick={() => choose('granted')}
            disabled={pending}
            className="flex-1 bg-zinc-950 text-white px-4 py-2.5 rounded-full text-xs uppercase tracking-cta font-medium hover:bg-black transition-colors disabled:opacity-50"
          >
            Accepter
          </button>
        </div>
      </div>
    </div>
  );
}
