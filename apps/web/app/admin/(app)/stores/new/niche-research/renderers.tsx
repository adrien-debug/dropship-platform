export function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-pulse" />
      <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-pulse" style={{ animationDelay: '120ms' }} />
      <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-pulse" style={{ animationDelay: '240ms' }} />
    </span>
  );
}

export function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-kicker uppercase tracking-cta text-zinc-400">{label}</p>
      <p className="mt-0.5 font-semibold text-zinc-900 tabular-nums">{value}</p>
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
    return <p className="text-xs text-zinc-500">Aucun résultat.</p>;
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
          <li key={r.url} className="border border-zinc-200 rounded-lg p-3 bg-white">
            <a
              href={r.url}
              target="_blank"
              rel="noreferrer noopener"
              className="text-sm font-medium text-zinc-900 hover:underline line-clamp-2"
            >
              {r.title || host}
            </a>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-zinc-400">
              <span>{host}</span>
              {r.published && <span>· {new Date(r.published).toLocaleDateString('fr-FR')}</span>}
            </div>
            {r.snippet && <p className="mt-1 text-xs text-zinc-600 line-clamp-3">{r.snippet}</p>}
          </li>
        );
      })}
    </ul>
  );
}

export function PerplexityRenderer({ output }: { output: unknown }) {
  const data = output as { query?: string; answer?: string; citations?: string[] };
  if (!data.answer) return <p className="text-xs text-zinc-500">Réponse vide.</p>;
  return (
    <div className="space-y-2">
      <blockquote className="border-l-2 border-zinc-300 pl-3 text-sm text-zinc-700 whitespace-pre-wrap">
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
                className="inline-flex items-center px-2 py-0.5 rounded-full border border-zinc-200 text-xs text-zinc-600 hover:bg-zinc-50"
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
  const tone =
    verdict === 'no-go'
      ? 'bg-zinc-100'
      : verdict === 'caution'
      ? 'bg-blue-50'
      : 'bg-blue-100';
  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-zinc-700">Saturation</span>
          <span className="text-xs tabular-nums text-zinc-500">{sat}/100 · {verdict.toUpperCase()}</span>
        </div>
        <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${tone}`} style={{ width: `${sat}%` }} />
        </div>
      </div>
      {data.sampleCreatives && data.sampleCreatives.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {data.sampleCreatives.slice(0, 3).map((c, i) => (
            <div
              key={`${c.advertiser}-${i}`}
              className="aspect-square rounded-md bg-zinc-100 overflow-hidden border border-zinc-200"
            >
              {c.previewImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.previewImage} alt={c.advertiser} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[10px] text-zinc-500 text-center p-1">
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
            <li key={a.name} className="flex justify-between text-zinc-600">
              <span className="truncate">{a.name}</span>
              <span className="text-zinc-400 tabular-nums shrink-0 ml-3">{a.adCount} ads</span>
            </li>
          ))}
        </ul>
      )}
      {data.angles && data.angles.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {data.angles.map((a) => (
            <span
              key={a}
              className="inline-flex items-center px-2 py-0.5 rounded-full border border-zinc-200 text-xs text-zinc-600"
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
      <p className="text-xs text-zinc-500">
        Aucun produit. {data.error && <span className="text-zinc-500">{data.error}</span>}
      </p>
    );
  }
  const tag = supplier === 'aliexpress' ? 'bg-zinc-100 text-zinc-700' : 'bg-blue-50 text-blue-700';
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="text-zinc-400 text-left">
            <th className="font-medium py-1 pr-2">Produit</th>
            <th className="font-medium py-1 px-2 text-right">Coût</th>
            <th className="font-medium py-1 px-2 text-right">Prix</th>
            <th className="font-medium py-1 px-2 text-right">Marge</th>
            <th className="font-medium py-1 pl-2 text-right">Cmd</th>
          </tr>
        </thead>
        <tbody className="text-zinc-700">
          {candidates.slice(0, 6).map((c) => (
            <tr key={c.supplier_product_id} className="border-t border-zinc-100">
              <td className="py-1.5 pr-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded bg-zinc-100 shrink-0 overflow-hidden">
                    {c.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.image_url} alt="" className="w-full h-full object-cover" />
                    ) : null}
                  </div>
                  <a
                    href={c.supplier_url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className={`inline-block px-1.5 py-0.5 rounded-sm shrink-0 ${tag}`}
                  >
                    {supplier}
                  </a>
                  <span className="truncate text-zinc-700">{c.title}</span>
                </div>
              </td>
              <td className="py-1.5 px-2 text-right tabular-nums">
                {(c.cost_cents / 100).toFixed(2)} €
              </td>
              <td className="py-1.5 px-2 text-right tabular-nums">
                {(c.suggested_price_cents / 100).toFixed(2)} €
              </td>
              <td className="py-1.5 px-2 text-right tabular-nums text-blue-600">
                +{(c.margin_cents / 100).toFixed(2)} €
              </td>
              <td className="py-1.5 pl-2 text-right tabular-nums text-zinc-500">
                {c.orders ?? 0}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
