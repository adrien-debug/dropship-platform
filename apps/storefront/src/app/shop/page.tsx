import { getProducts, getCategories } from '@/lib/medusa';
import { ShopGrid } from './shop-grid';

export const dynamic = 'force-dynamic';

interface ShopPageProps {
  searchParams: Promise<{ category?: string; search?: string; sort?: string; page?: string }>;
}

export default async function ShopPage({ searchParams }: ShopPageProps) {
  const params = await searchParams;
  const page = Number(params.page ?? '1');
  const limit = 24;
  const offset = (page - 1) * limit;

  const [categories, allCats] = await Promise.all([
    (async () => {
      const cats = await getCategories();
      const found = cats.find((c) => c.name === params.category);
      return found ? [found.id] : undefined;
    })(),
    getCategories(),
  ]);

  const { products, count: total } = await getProducts({
    category_id: categories,
    q: params.search,
    limit,
    offset,
    order: params.sort === 'price-asc' ? 'variants.calculated_price.calculated_amount' : undefined,
  });

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="mx-auto max-w-7xl px-4 py-ds-xl">
      <h1 className="mb-ds-lg" style={{ fontSize: 'var(--ds-size-h1)', fontWeight: 'var(--ds-weight-black, 900)', letterSpacing: '-2px' }}>
        Boutique
      </h1>

      <div className="mb-ds-lg flex flex-wrap items-center gap-3">
        <form className="flex-1" method="GET">
          <input
            type="text"
            name="search"
            placeholder="Rechercher un produit..."
            defaultValue={params.search ?? ''}
            className="w-full border border-[var(--ds-border)] bg-[var(--ds-bg)] px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ds-accent)]"
            style={{ borderRadius: 'var(--ds-radius)', fontFamily: 'var(--ds-font-primary)' }}
          />
        </form>

        <div className="flex gap-2 overflow-x-auto">
          <a
            href="/shop"
            className={`ds-btn whitespace-nowrap text-sm ${!params.category ? 'ds-btn-primary' : ''}`}
          >
            Tous
          </a>
          {allCats.map((cat) => (
            <a
              key={cat.id}
              href={`/shop?category=${encodeURIComponent(cat.name)}`}
              className={`ds-btn whitespace-nowrap text-sm ${params.category === cat.name ? 'ds-btn-primary' : ''}`}
            >
              {cat.name}
            </a>
          ))}
        </div>
      </div>

      <p className="mb-4 text-sm text-[var(--ds-text-muted)]">
        {total} produit{total > 1 ? 's' : ''}
      </p>

      <ShopGrid products={products} />

      {totalPages > 1 && (
        <div className="mt-ds-xl flex justify-center gap-2">
          {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map((p) => (
            <a
              key={p}
              href={`/shop?${new URLSearchParams({
                ...(params.category ? { category: params.category } : {}),
                ...(params.search ? { search: params.search } : {}),
                page: String(p),
              }).toString()}`}
              className={`ds-btn text-sm ${p === page ? 'ds-btn-primary' : ''}`}
            >
              {p}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
