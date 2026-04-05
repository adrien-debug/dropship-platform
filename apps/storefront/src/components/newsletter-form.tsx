'use client';

import { motion } from 'motion/react';
import { useState } from 'react';
import { z } from 'zod';

const newsletterSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
});

export function NewsletterForm(): React.JSX.Element {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    setError(null);
    const parsed = newsletterSchema.safeParse({ email });
    if (!parsed.success) {
      const first = parsed.error.flatten().fieldErrors.email?.[0];
      setError(first ?? 'Invalid email.');
      return;
    }
    setSubmitted(true);
    setEmail('');
    window.setTimeout(() => setSubmitted(false), 4000);
  };

  return (
    <motion.div
      className="rounded-3xl border border-op-brand/20 bg-op-card p-6 shadow-sm sm:p-8"
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <form
        className="mx-auto flex max-w-xl flex-col gap-3 sm:flex-row sm:items-start"
        onSubmit={onSubmit}
        noValidate
      >
        <div className="flex-1">
          <label htmlFor="newsletter-email" className="sr-only">
            Email address
          </label>
          <input
            id="newsletter-email"
            type="email"
            name="email"
            autoComplete="email"
            placeholder="you@crew.mail"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            className="w-full rounded-full border border-op-brand/25 bg-op-cream px-4 py-3 text-sm text-op-ink outline-none ring-op-brand/30 placeholder:text-op-muted focus:border-op-brand focus:ring-2"
          />
          {error ? (
            <p className="mt-2 text-xs font-medium text-op-brand" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <button
          type="submit"
          className="inline-flex shrink-0 items-center justify-center rounded-full bg-op-brand px-6 py-3 text-sm font-semibold text-op-cream transition hover:opacity-95"
        >
          Subscribe
        </button>
      </form>
      {submitted ? (
        <p className="mt-3 text-center text-sm font-medium text-op-muted" role="status">
          Thanks — you are on the list.
        </p>
      ) : null}
    </motion.div>
  );
}
