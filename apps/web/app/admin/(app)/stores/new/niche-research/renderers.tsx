export function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--ct-border-strong)' }} />
      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--ct-border-strong)', animationDelay: '120ms' }} />
      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--ct-border-strong)', animationDelay: '240ms' }} />
    </span>
  );
}

export function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-kicker uppercase tracking-cta" style={{ color: 'var(--ct-text-muted)' }}>{label}</p>
      <p className="mt-0.5 font-semibold tabular-nums" style={{ color: 'var(--ct-text-primary)' }}>{value}</p>
    </div>
  );
}

export function WebSearchRenderer({ output }: { output: unknown }) {
  const data = output as {
    query?: string;
    results?: Array<{ title: string; url: string; snippet: string; published?: string }>;
  };
  const results = data.results ?? [];
  if (results.length === 0) {
    return <p className="text-xs" style={{ color: 'var(--ct-text-body)' }}>Aucun résultat.</p>;
  }
  return (
    <ul className="space-y-2">
      {results.map((r) => {
        let host = '';
        try {
          host = new URL(r.url).hostname.replace(/^www\./, '');
        } catch {
          host = r.url;
        }
        return (
          <li key={r.url} className="rounded-lg p-3" style={{ border: '1px solid var(--ct-border)', background: 'var(--ct-surface-1)' }}>
            <a
              href={r.url}
              target="_blank"
              rel="noreferrer noopener"
              className="text-sm font-medium hover:underline line-clamp-2"
              style={{ color: 'var(--ct-text-primary)' }}
            >
              {r.title || host}
            </a>
            <div className="flex items-center gap-2 mt-0.5 text-xs" style={{ color: 'var(--ct-text-muted)' }}>
              <span>{host}</span>
              {r.published && <span>· {new Date(r.published).toLocaleDateString('fr-FR')}</span>}
            </div>
            {r.snippet && <p className="mt-1 text-xs line-clamp-3" style={{ color: 'var(--ct-text-body)' }}>{r.snippet}</p>}
          </li>
        );
      })}
    </ul>
  );
}

export function PerplexityRenderer({ output }: { output: unknown }) {
  const data = output as { query?: string; answer?: string; citations?: string[] };
  if (!data.answer) return <p className="text-xs" style={{ color: 'var(--ct-text-body)' }}>Réponse vide.</p>;
  return (
    <div className="space-y-2">
      <blockquote className="pl-3 text-sm whitespace-pre-wrap" style={{ borderLeft: '2px solid var(--ct-border-strong)', color: 'var(--ct-text-body)' }}>
        {data.answer}
      </blockquote>
      {data.citations && data.citations.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {data.citations.map((c, i) => {
            let host = '';
            try {
              host = new URL(c).hostname.replace(/^www\./, '');
            } catch {
              host = c;
            }
            return (
              <a
                key={`${c}-${i}`}
                href={c}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs"
                style={{ border: '1px solid var(--ct-border)', color: 'var(--ct-text-body)' }}
              >
                [{i + 1}] {host}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function MetaLibraryRenderer({ output }: { output: unknown }) {
  const data = output as {
    saturation?: number;
    verdict?: 'go' | 'caution' | 'no-go';
    totalAds?: number;
    topAdvertisers?: Array<{ name: string; adCount: number }>;
    sampleCreatives?: Array<{ advertiser: string; previewImage?: string }>;
    angles?: string[];
  };
  const sat = data.saturation ?? 0;
  const verdict = data.verdict ?? 'caution';
  const toneColor =
    verdict === 'no-go'
      ? 'var(--ct-surface-3)'
      : verdict === 'caution'
      ? 'var(--ct-accent-soft)'
      : 'var(--ct-accent-soft)';
  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium" style={{ color: 'var(--ct-text-body)' }}>Saturation</span>
          <span className="text-xs tabular-nums" style={{ color: 'var(--ct-text-muted)' }}>{sat}/100 · {verdict.toUpperCase()}</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--ct-surface-3)' }}>
          <div className="h-full rounded-full" style={{ width: `${sat}%`, background: toneColor }} />
        </div>
      </div>
      {data.sampleCreatives && data.sampleCreatives.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {data.sampleCreatives.slice(0, 3).map((c, i) => (
            <div
              key={`${c.advertiser}-${i}`}
              className="aspect-square rounded-md overflow-hidden"
              style={{ background: 'var(--ct-surface-2)', border: '1px solid var(--ct-border)' }}
            >
              {c.previewImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.previewImage} alt={c.advertiser} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[10px] text-center p-1" style={{ color: 'var(--ct-text-muted)' }}>
                  {c.advertiser}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {data.topAdvertisers && data.topAdvertisers.length > 0 && (
        <ul className="space-y-1 text-xs">
          {data.topAdvertisers.slice(0, 3).map((a) => (
            <li key={a.name} className="flex justify-between" style={{ color: 'var(--ct-text-body)' }}>
              <span className="truncate">{a.name}</span>
              <span className="tabular-nums shrink-0 ml-3" style={{ color: 'var(--ct-text-muted)' }}>{a.adCount} ads</span>
            </li>
          ))}
        </ul>
      )}
      {data.angles && data.angles.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {data.angles.map((a) => (
            <span
              key={a}
              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs"
              style={{ border: '1px solid var(--ct-border)', color: 'var(--ct-text-body)' }}
            >
              {a}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function SupplierRenderer({
  output,
  supplier,
}: {
  output: unknown;
  supplier: 'aliexpress' | 'cj';
}) {
  const data = output as {
    query?: string;
    candidates?: Array<{
      supplier_product_id: string;
      title: string;
      image_url: string;
      supplier_url: string;
      cost_cents: number;
      suggested_price_cents: number;
      margin_cents: number;
      orders?: number;
      rating?: string | null;
    }>;
    error?: string;
  };
  const candidates = data.candidates ?? [];
  if (candidates.length === 0) {
    return (
      <p className="text-xs" style={{ color: 'var(--ct-text-body)' }}>
        Aucun produit. {data.error && <span style={{ color: 'var(--ct-text-body)' }}>{data.error}</span>}
      </p>
    );
  }
  const tagStyle = supplier === 'aliexpress'
    ? { background: 'var(--ct-surface-3)', color: 'var(--ct-text-body)' }
    : { background: 'var(--ct-accent-soft)', color: 'var(--ct-accent)' };
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="text-left" style={{ color: 'var(--ct-text-muted)' }}>
            <th className="font-medium py-1 pr-2">Produit</th>
            <th className="font-medium py-1 px-2 text-right">Coût</th>
            <th className="font-medium py-1 px-2 text-right">Prix</th>
            <th className="font-medium py-1 px-2 text-right">Marge</th>
            <th className="font-medium py-1 pl-2 text-right">Cmd</th>
          </tr>
        </thead>
        <tbody style={{ color: 'var(--ct-text-body)' }}>
          {candidates.slice(0, 6).map((c) => (
            <tr key={c.supplier_product_id} className="border-t" style={{ borderColor: 'var(--ct-border-soft)' }}>
              <td className="py-1.5 pr-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded shrink-0 overflow-hidden" style={{ background: 'var(--ct-surface-2)' }}>
                    {c.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.image_url} alt="" className="w-full h-full object-cover" />
                    ) : null}
                  </div>
                  <a
                    href={c.supplier_url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-block px-1.5 py-0.5 rounded-sm shrink-0"
                    style={tagStyle}
                  >
                    {supplier}
                  </a>
                  <span className="truncate" style={{ color: 'var(--ct-text-body)' }}>{c.title}</span>
                </div>
              </td>
              <td className="py-1.5 px-2 text-right tabular-nums">
                {(c.cost_cents / 100).toFixed(2)} €
              </td>
              <td className="py-1.5 px-2 text-right tabular-nums">
                {(c.suggested_price_cents / 100).toFixed(2)} €
              </td>
              <td className="py-1.5 px-2 text-right tabular-nums" style={{ color: 'var(--ct-accent)' }}>
                +{(c.margin_cents / 100).toFixed(2)} €
              </td>
              <td className="py-1.5 pl-2 text-right tabular-nums" style={{ color: 'var(--ct-text-muted)' }}>
                {c.orders ?? 0}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
