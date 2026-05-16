import Link from 'next/link';
import { promises as fs } from 'fs';
import path from 'path';
import {
  TEMPLATE_CATALOG,
  type TemplateRegister,
  type TemplateMode,
} from '@/lib/template-catalog';
import { PageHeader } from '@/app/admin/_components/AdminUI';

export const dynamic = 'force-dynamic';

const REGISTER_COLORS: Record<TemplateRegister, string> = {
  mass: 'bg-blue-50 text-blue-700 border-blue-200',
  premium: 'bg-amber-50 text-amber-800 border-amber-200',
  luxury: 'bg-stone-900 text-amber-200 border-stone-900',
};

const MODE_COLORS: Record<TemplateMode, string> = {
  mono: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  collection: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  editorial: 'bg-rose-50 text-rose-700 border-rose-200',
  split: 'bg-zinc-100 text-zinc-700 border-zinc-300',
};

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
            Templates <em className="italic text-zinc-400">de storefront</em>
          </span>
        }
        lede={`${TEMPLATE_CATALOG.length - 1} layouts disponibles. Chaque template peut être assigné à n'importe quelle boutique. Clique sur "Voir en live" pour un preview rendu avec des données fictives.`}
      />

      {(['luxury', 'premium', 'mass'] as TemplateRegister[]).map((reg) => {
        const entries = byRegister[reg];
        if (!entries.length) return null;
        return (
          <section key={reg} className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-600">
                {labelForRegister(reg)}
              </h2>
              <span className="text-xs text-zinc-400">{entries.length} templates</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {entries.map((t) => {
                const preview = previewByid[t.id];
                return (
                  <article
                    key={t.id}
                    className="group border border-zinc-200 bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col"
                  >
                    <div className="relative aspect-[16/10] bg-gradient-to-br from-zinc-100 to-zinc-200 overflow-hidden">
                      {preview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={preview}
                          alt={t.label}
                          className="absolute inset-0 w-full h-full object-cover object-top group-hover:scale-[1.02] transition-transform duration-500"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-xs text-zinc-400 font-medium">
                          Pas d&apos;aperçu disponible
                        </div>
                      )}
                      <span
                        className={`absolute top-3 left-3 text-[10px] uppercase tracking-[0.14em] font-semibold px-2 py-1 rounded border ${REGISTER_COLORS[t.register]}`}
                      >
                        {t.register}
                      </span>
                      <span
                        className={`absolute top-3 right-3 text-[10px] uppercase tracking-[0.14em] font-semibold px-2 py-1 rounded border ${MODE_COLORS[t.mode]}`}
                      >
                        {t.mode}
                      </span>
                    </div>

                    <div className="p-4 flex-1 flex flex-col gap-3">
                      <div>
                        <h3 className="text-base font-semibold tracking-tight text-zinc-900">
                          {t.label}
                        </h3>
                        <p className="mt-1 text-xs text-zinc-500 leading-relaxed line-clamp-3">
                          {t.hint}
                        </p>
                      </div>

                      {t.niches.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {t.niches.map((n) => (
                            <span
                              key={n}
                              className="text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-50 text-zinc-600 border border-zinc-200"
                            >
                              {n}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-1.5">
                        {t.moods.slice(0, 3).map((m) => (
                          <span
                            key={m}
                            className="text-[10px] italic px-1.5 py-0.5 text-zinc-400"
                          >
                            {m}
                          </span>
                        ))}
                      </div>

                      <div className="mt-auto pt-3 border-t border-zinc-100 flex items-center justify-between gap-2">
                        <code className="text-[10px] text-zinc-400 font-mono truncate">
                          {t.id}
                        </code>
                        <Link
                          href={`/admin/templates/${t.id}/preview`}
                          className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Voir en live →
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
