'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { loginSchema } from '@/lib/auth-schemas';
import { persistAuthToken } from '@/lib/auth-token';
import { writeShopAuth } from '@/lib/shop-api-client';
import { AuthEmailInput } from '@/components/auth/auth-email-input';
import { AuthPasswordInput } from '@/components/auth/auth-password-input';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError('');
    setFieldErrors({});

    const parsed = loginSchema.safeParse({ email, password });
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
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      const data: unknown = await res.json().catch(() => ({}));
      const rec = data as { token?: string; customerId?: string; email?: string; error?: string };
      if (!res.ok || !rec.token) {
        setFormError(typeof rec.error === 'string' ? rec.error : 'Connexion impossible');
        return;
      }
      persistAuthToken(rec.token);
      if (rec.customerId && rec.email) {
        writeShopAuth({ token: rec.token, customerId: rec.customerId, email: rec.email });
      }
      window.location.assign('/');
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
      <AuthPasswordInput
        label="Mot de passe"
        name="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        invalid={Boolean(fieldErrors.password)}
        errorMessage={fieldErrors.password}
        autoComplete="current-password"
      />

      {formError ? (
        <p className="text-center text-sm text-red-600" role="alert">
          {formError}
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
            Connexion...
          </span>
        ) : (
          'SE CONNECTER'
        )}
      </button>

      <p className="text-center text-sm text-[#999999]">
        <Link href="/forgot-password" className="font-medium text-[#D9312B] underline-offset-2 hover:underline">
          Mot de passe oublié ?
        </Link>
      </p>
      <p className="text-center text-sm text-[#999999]">
        Pas encore de compte ?{' '}
        <Link href="/register" className="font-medium text-[#D9312B] underline-offset-2 hover:underline">
          Créer un compte
        </Link>
      </p>
    </form>
  );
}
