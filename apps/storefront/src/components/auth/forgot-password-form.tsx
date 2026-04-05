'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { forgotPasswordSchema } from '@/lib/auth-schemas';
import { AuthEmailInput } from '@/components/auth/auth-email-input';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError('');
    setInfo('');
    setFieldErrors({});

    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      const next: Record<string, string> = {};
      for (const [key, messages] of Object.entries(flat)) {
        const msg = messages?.[0];
        if (msg) next[key] = msg;
      }
      setFieldErrors(next);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      const data: unknown = await res.json().catch(() => ({}));
      const rec = data as { ok?: boolean; error?: string; message?: string };
      if (!res.ok) {
        setFormError(typeof rec.error === 'string' ? rec.error : 'Demande impossible');
        return;
      }
      setInfo(
        typeof rec.message === 'string'
          ? rec.message
          : 'Si un compte existe pour cette adresse, vous recevrez un e-mail avec les instructions.',
      );
    } catch {
      setFormError('Erreur réseau');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <AuthEmailInput
        label="Adresse email"
        name="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        invalid={Boolean(fieldErrors.email)}
        errorMessage={fieldErrors.email}
      />

      {formError ? (
        <p className="text-center text-sm text-red-600" role="alert">
          {formError}
        </p>
      ) : null}
      {info ? (
        <p className="text-center text-sm text-[#D9312B]" role="status">
          {info}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-full bg-[#D9312B] px-6 py-3 text-sm font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#c62828] disabled:opacity-50 disabled:pointer-events-none"
      >
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <span className="inline-block size-4 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden />
            Envoi...
          </span>
        ) : (
          'REINITIALISER'
        )}
      </button>

      <p className="text-center text-sm text-[#999999]">
        <Link href="/login" className="font-medium text-[#D9312B] underline-offset-2 hover:underline">
          Retour à la connexion
        </Link>
      </p>
    </form>
  );
}
