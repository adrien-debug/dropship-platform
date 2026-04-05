'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { registerSchema } from '@/lib/auth-schemas';
import { persistAuthToken } from '@/lib/auth-token';
import { writeShopAuth } from '@/lib/shop-api-client';
import { AuthEmailInput } from '@/components/auth/auth-email-input';
import { AuthPasswordInput } from '@/components/auth/auth-password-input';

export function RegisterForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError('');
    setFieldErrors({});

    const parsed = registerSchema.safeParse({
      name,
      email,
      password,
      confirmPassword,
    });
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
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: parsed.data.name,
          email: parsed.data.email,
          password: parsed.data.password,
        }),
      });
      const data: unknown = await res.json().catch(() => ({}));
      const rec = data as { token?: string; customerId?: string; email?: string; error?: string };
      if (!res.ok || !rec.token) {
        setFormError(typeof rec.error === 'string' ? rec.error : 'Inscription impossible');
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
      <div className="w-full">
        <label
          htmlFor="register-name"
          className="mb-1.5 block text-left text-sm font-medium text-[#333333]"
        >
          Nom complet
        </label>
        <input
          id="register-name"
          name="name"
          type="text"
          autoComplete="name"
          value={name}
          onChange={e => setName(e.target.value)}
          className="w-full min-h-10 rounded-lg border border-[#eeeeee] bg-white px-3 py-2 text-sm text-[#333333] placeholder:text-[#999999] focus:border-[#D9312B] focus:outline-none focus:ring-2 focus:ring-[#D9312B]/20"
          aria-invalid={Boolean(fieldErrors.name) || undefined}
        />
        {fieldErrors.name ? (
          <p className="mt-1 text-left text-xs text-red-600" role="alert">
            {fieldErrors.name}
          </p>
        ) : null}
      </div>

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
        autoComplete="new-password"
      />
      <AuthPasswordInput
        label="Confirmer le mot de passe"
        name="confirmPassword"
        value={confirmPassword}
        onChange={e => setConfirmPassword(e.target.value)}
        invalid={Boolean(fieldErrors.confirmPassword)}
        errorMessage={fieldErrors.confirmPassword}
        autoComplete="new-password"
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
            Inscription...
          </span>
        ) : (
          'CREER MON COMPTE'
        )}
      </button>

      <p className="text-center text-sm text-[#999999]">
        Déjà un compte ?{' '}
        <Link href="/login" className="font-medium text-[#D9312B] underline-offset-2 hover:underline">
          Se connecter
        </Link>
      </p>
    </form>
  );
}
