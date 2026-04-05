'use client';

import { useCallback, useEffect, useState } from 'react';
import { AddressCard } from '@/components/account/address-card';
import { useAccountAuth } from '@/components/account/account-auth-provider';
import { shopFetch } from '@/lib/shop-api-client';
import type { ShopAddress } from '@/types/account';

const emptyForm = {
  label: '',
  line1: '',
  line2: '',
  city: '',
  postalCode: '',
  country: '',
  isDefault: false,
};

export default function AccountAddressesPage(): React.ReactElement {
  const { auth } = useAccountAuth();
  const [addresses, setAddresses] = useState<ShopAddress[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!auth?.customerId) return;
    setError(null);
    const res = await shopFetch(`/api/customers/${auth.customerId}/addresses`);
    const data = (await res.json()) as { error?: string; addresses?: ShopAddress[] };
    if (!res.ok) {
      setError(data.error ?? 'Chargement impossible');
      setAddresses([]);
      return;
    }
    setAddresses(data.addresses ?? []);
  }, [auth?.customerId]);

  useEffect(() => {
    if (!auth?.customerId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      await load();
      if (!cancelled) setLoading(false);
    })().catch(() => {
      if (!cancelled) {
        setError('Erreur réseau');
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [auth?.customerId, load]);

  function startEdit(a: ShopAddress): void {
    setEditingId(a.id);
    setForm({
      label: a.label ?? '',
      line1: a.line1 ?? '',
      line2: a.line2 ?? '',
      city: a.city ?? '',
      postalCode: a.postalCode ?? '',
      country: a.country ?? '',
      isDefault: a.isDefault,
    });
  }

  function cancelEdit(): void {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function submitCreate(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!auth?.customerId) return;
    setError(null);
    const res = await shopFetch(`/api/customers/${auth.customerId}/addresses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label: form.label.trim() || null,
        line1: form.line1.trim(),
        line2: form.line2.trim() || null,
        city: form.city.trim() || null,
        postalCode: form.postalCode.trim() || null,
        country: form.country.trim() || null,
        isDefault: form.isDefault,
      }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(data.error ?? 'Création impossible');
      return;
    }
    setForm(emptyForm);
    await load();
  }

  async function submitEdit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!auth?.customerId || !editingId) return;
    setError(null);
    const res = await shopFetch(`/api/customers/${auth.customerId}/addresses/${editingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label: form.label.trim() || null,
        line1: form.line1.trim(),
        line2: form.line2.trim() || null,
        city: form.city.trim() || null,
        postalCode: form.postalCode.trim() || null,
        country: form.country.trim() || null,
        isDefault: form.isDefault,
      }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(data.error ?? 'Mise à jour impossible');
      return;
    }
    cancelEdit();
    await load();
  }

  async function handleDelete(id: string): Promise<void> {
    if (!auth?.customerId) return;
    if (!window.confirm('Supprimer cette adresse ?')) return;
    setError(null);
    const res = await shopFetch(`/api/customers/${auth.customerId}/addresses/${id}`, { method: 'DELETE' });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(data.error ?? 'Suppression impossible');
      return;
    }
    if (editingId === id) cancelEdit();
    await load();
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--dashboard-text-bright)' }}>
          Adresses de livraison
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--dashboard-text-muted)' }}>
          Ajoutez, modifiez ou supprimez vos adresses.
        </p>
      </header>

      {error ? (
        <p className="text-sm" style={{ color: 'var(--dashboard-error)' }}>
          {error}
        </p>
      ) : null}

      <section
        className="p-5"
        style={{
          borderRadius: 'var(--dashboard-radius-card)',
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: 'var(--dashboard-border)',
          background: 'var(--dashboard-card)',
        }}
      >
        <h2 className="text-sm font-semibold" style={{ color: 'var(--dashboard-text-primary)' }}>
          {editingId ? 'Modifier une adresse' : 'Nouvelle adresse'}
        </h2>
        <form
          onSubmit={e => void (editingId ? submitEdit(e) : submitCreate(e))}
          className="mt-4 grid max-w-xl gap-3 sm:grid-cols-2"
        >
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-xs uppercase tracking-wide" style={{ color: 'var(--dashboard-text-muted)' }}>
              Libellé
            </span>
            <input
              value={form.label}
              onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              className="border px-3 py-2 text-sm outline-none focus:border-[color:var(--dashboard-accent)]"
              style={{
                borderRadius: 'var(--dashboard-radius-input)',
                background: 'var(--dashboard-card-2)',
                color: 'var(--dashboard-text-primary)',
                borderColor: 'var(--dashboard-border-mid)',
              }}
            />
          </label>
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-xs uppercase tracking-wide" style={{ color: 'var(--dashboard-text-muted)' }}>
              Ligne 1
            </span>
            <input
              required
              value={form.line1}
              onChange={e => setForm(f => ({ ...f, line1: e.target.value }))}
              className="border px-3 py-2 text-sm outline-none focus:border-[color:var(--dashboard-accent)]"
              style={{
                borderRadius: 'var(--dashboard-radius-input)',
                background: 'var(--dashboard-card-2)',
                color: 'var(--dashboard-text-primary)',
                borderColor: 'var(--dashboard-border-mid)',
              }}
            />
          </label>
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-xs uppercase tracking-wide" style={{ color: 'var(--dashboard-text-muted)' }}>
              Ligne 2
            </span>
            <input
              value={form.line2}
              onChange={e => setForm(f => ({ ...f, line2: e.target.value }))}
              className="border px-3 py-2 text-sm outline-none focus:border-[color:var(--dashboard-accent)]"
              style={{
                borderRadius: 'var(--dashboard-radius-input)',
                background: 'var(--dashboard-card-2)',
                color: 'var(--dashboard-text-primary)',
                borderColor: 'var(--dashboard-border-mid)',
              }}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide" style={{ color: 'var(--dashboard-text-muted)' }}>
              Code postal
            </span>
            <input
              value={form.postalCode}
              onChange={e => setForm(f => ({ ...f, postalCode: e.target.value }))}
              className="border px-3 py-2 text-sm outline-none focus:border-[color:var(--dashboard-accent)]"
              style={{
                borderRadius: 'var(--dashboard-radius-input)',
                background: 'var(--dashboard-card-2)',
                color: 'var(--dashboard-text-primary)',
                borderColor: 'var(--dashboard-border-mid)',
              }}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide" style={{ color: 'var(--dashboard-text-muted)' }}>
              Ville
            </span>
            <input
              value={form.city}
              onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
              className="border px-3 py-2 text-sm outline-none focus:border-[color:var(--dashboard-accent)]"
              style={{
                borderRadius: 'var(--dashboard-radius-input)',
                background: 'var(--dashboard-card-2)',
                color: 'var(--dashboard-text-primary)',
                borderColor: 'var(--dashboard-border-mid)',
              }}
            />
          </label>
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-xs uppercase tracking-wide" style={{ color: 'var(--dashboard-text-muted)' }}>
              Pays
            </span>
            <input
              value={form.country}
              onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
              className="border px-3 py-2 text-sm outline-none focus:border-[color:var(--dashboard-accent)]"
              style={{
                borderRadius: 'var(--dashboard-radius-input)',
                background: 'var(--dashboard-card-2)',
                color: 'var(--dashboard-text-primary)',
                borderColor: 'var(--dashboard-border-mid)',
              }}
            />
          </label>
          <label className="flex items-center gap-2 sm:col-span-2">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={e => setForm(f => ({ ...f, isDefault: e.target.checked }))}
            />
            <span className="text-sm" style={{ color: 'var(--dashboard-text-secondary)' }}>
              Définir comme adresse par défaut
            </span>
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button
              type="submit"
              className="rounded-full px-5 py-2 text-sm font-medium"
              style={{ background: 'var(--dashboard-accent)', color: 'var(--dashboard-page)' }}
            >
              {editingId ? 'Enregistrer' : 'Ajouter'}
            </button>
            {editingId ? (
              <button
                type="button"
                onClick={() => cancelEdit()}
                className="rounded-full px-5 py-2 text-sm font-medium"
                style={{
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  borderColor: 'var(--dashboard-border-mid)',
                  color: 'var(--dashboard-text-primary)',
                }}
              >
                Annuler
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--dashboard-text-primary)' }}>
          Vos adresses
        </h2>
        {loading ? (
          <p className="text-sm" style={{ color: 'var(--dashboard-text-muted)' }}>
            Chargement…
          </p>
        ) : addresses.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--dashboard-text-muted)' }}>
            Aucune adresse pour le moment.
          </p>
        ) : (
          addresses.map(a => (
            <AddressCard
              key={a.id}
              address={a}
              onEdit={id => {
                const row = addresses.find(x => x.id === id);
                if (row) startEdit(row);
              }}
              onDelete={handleDelete}
            />
          ))
        )}
      </section>
    </div>
  );
}
