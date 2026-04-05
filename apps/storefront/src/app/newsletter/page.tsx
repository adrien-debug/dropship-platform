'use client';

import Image from 'next/image';
import { useState } from 'react';

export default function NewsletterPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Veuillez entrer une adresse email valide.');
      return;
    }

    setSubmitted(true);
    setEmail('');
  };

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden"
      style={{ background: '#1a1a1a' }}
    >
      {/* Decorative character images */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-16 top-10 h-72 w-72 opacity-[0.06] sm:h-96 sm:w-96">
          <Image
            src="/characters/luffy.png"
            alt=""
            fill
            sizes="384px"
            className="object-contain"
            aria-hidden="true"
          />
        </div>
        <div className="absolute -right-12 bottom-10 h-64 w-64 opacity-[0.06] sm:h-80 sm:w-80">
          <Image
            src="/characters/zoro.png"
            alt=""
            fill
            sizes="320px"
            className="object-contain"
            aria-hidden="true"
          />
        </div>
        <div className="absolute right-1/4 top-16 hidden h-48 w-48 opacity-[0.04] lg:block">
          <Image
            src="/characters/nami.png"
            alt=""
            fill
            sizes="192px"
            className="object-contain"
            aria-hidden="true"
          />
        </div>
        <div className="absolute bottom-20 left-1/4 hidden h-52 w-52 opacity-[0.04] lg:block">
          <Image
            src="/characters/ace.png"
            alt=""
            fill
            sizes="208px"
            className="object-contain"
            aria-hidden="true"
          />
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto w-full max-w-lg px-6 py-20 text-center">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <Image
            src="/logo-onepiece.png"
            alt="One Peace"
            width={200}
            height={64}
            className="h-16 w-auto brightness-0 invert"
          />
        </div>

        <h1
          className="text-4xl font-bold tracking-widest text-white sm:text-5xl"
          style={{ fontFamily: "'Noto Sans JP', sans-serif" }}
        >
          NEWSLETTER
        </h1>

        <p className="mx-auto mt-4 max-w-sm text-base leading-relaxed text-white/60">
          Recevez les dernieres nouveautes et offres exclusives
        </p>

        {submitted ? (
          <div className="mt-10">
            <div
              className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold"
              style={{ background: 'rgba(22,163,74,0.15)', color: '#4ade80' }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M6.5 10.5L9 13L14 7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle
                  cx="10"
                  cy="10"
                  r="8.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
              </svg>
              Merci ! Vous etes inscrit.
            </div>
            <button
              type="button"
              onClick={() => setSubmitted(false)}
              className="mt-6 block w-full text-sm text-white/40 transition hover:text-white/70"
            >
              Inscrire une autre adresse
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="mt-10 space-y-4">
            <div>
              <label htmlFor="newsletter-email" className="sr-only">
                Adresse email
              </label>
              <input
                id="newsletter-email"
                type="email"
                name="email"
                autoComplete="email"
                placeholder="votre@email.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError(null);
                }}
                className="w-full rounded-full border border-white/15 px-5 py-3.5 text-center text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#D9312B]"
                style={{ background: 'rgba(255,255,255,0.07)' }}
              />
              {error && (
                <p className="mt-2 text-xs font-medium" style={{ color: '#D9312B' }} role="alert">
                  {error}
                </p>
              )}
            </div>

            <button
              type="submit"
              className="w-full max-w-md rounded-full px-6 py-3.5 text-sm font-bold tracking-widest text-white transition-colors duration-200"
              style={{ background: '#D9312B' }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = '#c62828';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = '#D9312B';
              }}
            >
              S&apos;INSCRIRE
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
