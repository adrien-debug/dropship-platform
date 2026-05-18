import Link from 'next/link';
import { promises as fs } from 'fs';
import path from 'path';
import {
  TEMPLATE_CATALOG,
  type TemplateRegister,
} from '@/lib/template-catalog';
import { PageHeader } from '@/app/admin/_components/AdminUI';

export const dynamic = 'force-dynamic';

// REGISTER_COLORS / MODE_COLORS no longer used after Cockpit re-skin — badges use --ct-* inline styles

async function fileExists(rel: string): Promise<boolean> {
  try {
    await fs.stat(path.join(process.cwd(), 'public', rel));
    return true;
  } catch {
    return false;
  }
}

async function resolvePreview(id: string): Promise<string | null> {
  const candidates = [
    `template-previews/${id}-rendered.png`,
    `template-previews/${id}-source.png`,
  ];
  for (const c of candidates) {
    if (await fileExists(c)) return `/${c}`;
  }
  return null;
}

export default async function TemplatesGalleryPage() {
  // Resolve preview URLs in parallel — keeps the page fast even with 26 entries.
  const previews = await Promise.all(
    TEMPLATE_CATALOG.map(async (t) => ({ id: t.id, preview: await resolvePreview(t.id) })),
  );
  const previewByid = Object.fromEntries(previews.map((p) => [p.id, p.preview]));

  // Group by register so the gallery reads as a hierarchy: luxury first,
  // premium next, mass at the bottom. Within each group templates stay in
  // catalog order.
  const byRegister: Record<TemplateRegister, typeof TEMPLATE_CATALOG[number][]> = {
    luxury: [],
    premium: [],
    mass: [],
  };
  for (const t of TEMPLATE_CATALOG) {
    if (t.id === 'auto') continue;
    byRegister[t.register].push(t);
  }

  return (
    <div className="flex flex-col flex-1 space-y-6 px-6 pb-12">
      <PageHeader
        kicker="Catalogue"
        title={
          <span>
            Templates <em style={{ fontStyle: 'italic', color: 'var(--ct-text-muted)' }}>de storefront</em>
          </span>
        }
        lede={`${TEMPLATE_CATALOG.length - 1} layouts disponibles. Chaque template peut être assigné à n'importe quelle boutique. Clique sur "Voir en live" pour un preview rendu avec des données fictives.`}
      />

      {(['luxury', 'premium', 'mass'] as TemplateRegister[]).map((reg) => {
        const entries = byRegister[reg];
        if (!entries.length) return null;
        return (
          <section key={reg} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--ct-text-muted)' }}>
                {labelForRegister(reg)}
              </h2>
              <span style={{ fontSize: 11, color: 'var(--ct-text-faint)' }}>{entries.length} templates</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {entries.map((t) => {
                const preview = previewByid[t.id];
                return (
                  <article
                    key={t.id}
                    style={{
                      border: '1px solid var(--ct-border)',
                      background: 'var(--ct-surface-1)',
                      borderRadius: 12, overflow: 'hidden',
                      display: 'flex', flexDirection: 'column',
                    }}
                  >
                    <div style={{ position: 'relative', aspectRatio: '16/10', background: 'var(--ct-surface-3)', overflow: 'hidden' }}>
                      {preview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={preview}
                          alt={t.label}
                          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }}
                        />
                      ) : (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--ct-text-faint)', fontWeight: 500 }}>
                          Pas d&apos;aper&ccedil;u disponible
                        </div>
                      )}
                      <span style={{ position: 'absolute', top: 12, left: 12, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 700, padding: '2px 8px', borderRadius: 4, border: '1px solid var(--ct-border-accent)', background: 'var(--ct-accent-soft)', color: 'var(--ct-accent-strong)' }}>
                        {t.register}
                      </span>
                      <span style={{ position: 'absolute', top: 12, right: 12, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 700, padding: '2px 8px', borderRadius: 4, border: '1px solid var(--ct-border)', background: 'var(--ct-surface-2)', color: 'var(--ct-text-body)' }}>
                        {t.mode}
                      </span>
                    </div>

                    <div style={{ padding: 16, flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div>
                        <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ct-text-primary)', letterSpacing: '-0.01em' }}>
                          {t.label}
                        </h3>
                        <p style={{ marginTop: 4, fontSize: 12, color: 'var(--ct-text-muted)', lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}>
                          {t.hint}
                        </p>
                      </div>

                      {t.niches.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {t.niches.map((n) => (
                            <span
                              key={n}
                              style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', padding: '2px 6px', borderRadius: 4, background: 'var(--ct-surface-3)', color: 'var(--ct-text-muted)', border: '1px solid var(--ct-border)' }}
                            >
                              {n}
                            </span>
                          ))}
                        </div>
                      )}

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {t.moods.slice(0, 3).map((m) => (
                          <span key={m} style={{ fontSize: 10, fontStyle: 'italic', padding: '2px 6px', color: 'var(--ct-text-faint)' }}>
                            {m}
                          </span>
                        ))}
                      </div>

                      <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid var(--ct-border-soft)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <code style={{ fontSize: 10, color: 'var(--ct-text-faint)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.id}
                        </code>
                        <Link
                          href={`/admin/templates/${t.id}/preview`}
                          style={{ fontSize: 12, fontWeight: 700, color: 'var(--ct-accent)', textDecoration: 'none' }}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Voir en live &#8594;
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function labelForRegister(r: TemplateRegister): string {
  switch (r) {
    case 'luxury': return 'Luxe — pièces signatures';
    case 'premium': return 'Premium — éditorial et boutique';
    case 'mass': return 'Mass-market — volume et grandes audiences';
  }
}
