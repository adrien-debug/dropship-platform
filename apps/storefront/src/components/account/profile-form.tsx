'use client';

import { useEffect, useState } from 'react';
import type { ShopCustomer } from '@/types/account';
import { shopFetch } from '@/lib/shop-api-client';

export function ProfileForm({
  customerId,
  initial,
}: {
  customerId: string;
  initial: ShopCustomer;
}): React.ReactElement {
  const [name, setName] = useState(initial.name ?? '');
  const [email, setEmail] = useState(initial.email);
  const [phone, setPhone] = useState(initial.phone ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(initial.name ?? '');
    setEmail(initial.email);
    setPhone(initial.phone ?? '');
  }, [initial]);

  async function onSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await shopFetch(`/api/customers/${customerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || undefined,
          email: email.trim(),
          phone: phone.trim() || null,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Enregistrement impossible');
        return;
      }
      setMessage('Profil enregistré');
    } catch {
      setError('Erreur réseau');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={e => void onSubmit(e)} className="flex max-w-lg flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--dashboard-text-muted)' }}>
          Nom
        </span>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          className="w-full border px-3 py-2.5 text-sm outline-none focus:border-[color:var(--dashboard-accent)]"
          style={{
            borderRadius: 'var(--dashboard-radius-input)',
            background: 'var(--dashboard-card-2)',
            color: 'var(--dashboard-text-primary)',
            borderColor: 'var(--dashboard-border-mid)',
          }}
          autoComplete="name"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--dashboard-text-muted)' }}>
          E-mail
        </span>
        <input
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full border px-3 py-2.5 text-sm outline-none focus:border-[color:var(--dashboard-accent)]"
          style={{
            borderRadius: 'var(--dashboard-radius-input)',
            background: 'var(--dashboard-card-2)',
            color: 'var(--dashboard-text-primary)',
            borderColor: 'var(--dashboard-border-mid)',
          }}
          autoComplete="email"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--dashboard-text-muted)' }}>
          Téléphone
        </span>
        <input
          value={phone}
          onChange={e => setPhone(e.target.value)}
          className="w-full border px-3 py-2.5 text-sm outline-none focus:border-[color:var(--dashboard-accent)]"
          style={{
            borderRadius: 'var(--dashboard-radius-input)',
            background: 'var(--dashboard-card-2)',
            color: 'var(--dashboard-text-primary)',
            borderColor: 'var(--dashboard-border-mid)',
          }}
          autoComplete="tel"
        />
      </label>
      {error ? (
        <p className="text-sm" style={{ color: 'var(--dashboard-error)' }}>
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="text-sm" style={{ color: 'var(--dashboard-success)' }}>
          {message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={saving}
        className="inline-flex max-w-xs items-center justify-center px-5 py-2.5 text-sm font-medium disabled:opacity-50"
        style={{
          borderRadius: 'var(--dashboard-radius-button)',
          background: 'var(--dashboard-accent)',
          color: 'var(--dashboard-page)',
        }}
      >
        {saving ? 'Enregistrement…' : 'Enregistrer'}
      </button>
    </form>
  );
}
