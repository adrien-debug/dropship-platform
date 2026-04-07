'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function ContactPage() {
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Erreur serveur');
      setSent(true);
    } catch {
      setError('Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 font-['Noto_Sans_JP',sans-serif]">
      <nav className="mb-6 text-sm text-[#999]">
        <Link href="/" className="hover:text-[#D9312B] transition-colors">Accueil</Link>
        <span className="mx-2">›</span>
        <span className="text-[#333]">Contact</span>
      </nav>

      <h1 className="mb-8 inline-block pb-2 text-2xl font-bold tracking-wider text-[#333] border-b-[3px] border-[#D9312B]">
        CONTACT
      </h1>

      {sent ? (
        <div className="rounded-xl border border-green-200 bg-green-50 p-8 text-center">
          <p className="text-lg font-bold text-green-700">Message envoyé !</p>
          <p className="mt-2 text-sm text-green-600">
            Nous reviendrons vers vous dans les plus brefs délais.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-[#eee] bg-white p-6 shadow-sm">
          <div>
            <label htmlFor="name" className="mb-1 block text-xs font-bold uppercase tracking-wide text-[#999]">
              Nom
            </label>
            <input
              id="name"
              name="name"
              required
              className="w-full rounded-lg border border-[#eee] px-3 py-2 text-sm text-[#333] focus:border-[#D9312B] focus:ring-2 focus:ring-[#D9312B]/20 focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label htmlFor="email" className="mb-1 block text-xs font-bold uppercase tracking-wide text-[#999]">
              E-mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full rounded-lg border border-[#eee] px-3 py-2 text-sm text-[#333] focus:border-[#D9312B] focus:ring-2 focus:ring-[#D9312B]/20 focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label htmlFor="subject" className="mb-1 block text-xs font-bold uppercase tracking-wide text-[#999]">
              Sujet
            </label>
            <select
              id="subject"
              name="subject"
              className="w-full rounded-lg border border-[#eee] px-3 py-2 text-sm text-[#333] focus:border-[#D9312B] focus:ring-2 focus:ring-[#D9312B]/20 focus:outline-none transition-colors"
            >
              <option>Question sur une commande</option>
              <option>Retour / échange</option>
              <option>Problème technique</option>
              <option>Autre</option>
            </select>
          </div>

          <div>
            <label htmlFor="message" className="mb-1 block text-xs font-bold uppercase tracking-wide text-[#999]">
              Message
            </label>
            <textarea
              id="message"
              name="message"
              rows={5}
              required
              className="w-full rounded-lg border border-[#eee] px-3 py-2 text-sm text-[#333] focus:border-[#D9312B] focus:ring-2 focus:ring-[#D9312B]/20 focus:outline-none transition-colors resize-none"
            />
          </div>

          {error && (
            <p className="text-sm font-medium text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full bg-[#D9312B] px-6 py-3 font-bold tracking-wider text-white hover:bg-[#c62828] transition-colors disabled:opacity-50"
          >
            {submitting ? 'ENVOI…' : 'ENVOYER'}
          </button>
        </form>
      )}

      <div className="mt-8 text-center text-sm text-[#999]">
        <p>Vous pouvez aussi nous écrire à : <strong className="text-[#333]">support@onepiece-store.com</strong></p>
      </div>
    </main>
  );
}
