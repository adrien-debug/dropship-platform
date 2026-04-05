'use client';

import { useCallback, useEffect, useState } from 'react';
import { FilterSidebar } from '@/components/shop/filter-sidebar';
import { Pagination } from '@/components/shop/pagination';
import { ProductGrid } from '@/components/shop/product-grid';
import { ShopBreadcrumb } from '@/components/shop/shop-breadcrumb';
import { SortDropdown } from '@/components/shop/sort-dropdown';
import type { LayoutMode, ProductDto, ProductSort, StockFilter } from '@/lib/product-types';
import { buildProductsQueryString } from '@/lib/products-api';

const PAGE_SIZE = 12;
const SEARCH_DEBOUNCE_MS = 400;

function parseEurosToCents(raw: string): number | null {
  const t = raw.trim();
  if (t === '') return null;
  const n = Number.parseFloat(t.replace(',', '.'));
  if (Number.isNaN(n) || n < 0) return null;
  return Math.round(n * 100);
}

function LayoutToggle({
  mode,
  onChange,
}: {
  mode: LayoutMode;
  onChange: (m: LayoutMode) => void;
}) {
  const btnBase =
    'inline-flex h-9 w-9 items-center justify-center rounded-[var(--dashboard-radius-input)] border transition';
  const activeStyle = {
    borderColor: 'var(--dashboard-accent)',
    background: 'var(--dashboard-accent-soft)',
    color: 'var(--dashboard-accent)',
  };
  const idleStyle = {
    borderColor: 'var(--dashboard-border-mid)',
    background: 'var(--dashboard-card)',
    color: 'var(--dashboard-text-secondary)',
  };

  return (
    <div className="flex gap-1" role="group" aria-label="Affichage grille ou liste">
      <button
        type="button"
        onClick={() => onChange('grid')}
        className={btnBase}
        style={mode === 'grid' ? activeStyle : idleStyle}
        aria-pressed={mode === 'grid'}
        title="Grille"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
          <path
            d="M2 2h6v6H2V2zm8 0h6v6h-6V2zM2 10h6v6H2v-6zm8 0h6v6h-6v-6z"
            stroke="currentColor"
            strokeWidth="1.25"
          />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => onChange('list')}
        className={btnBase}
        style={mode === 'list' ? activeStyle : idleStyle}
        aria-pressed={mode === 'list'}
        title="Liste"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
          <path
            d="M2 4h14v2H2V4zm0 4h14v2H2V8zm0 4h14v2H2v-4zm0 4h10v2H2v-2z"
            fill="currentColor"
          />
        </svg>
      </button>
    </div>
  );
}

export default function ShopPage() {

  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState('');
  const [stock, setStock] = useState<StockFilter>('all');
  const [priceMinEuros, setPriceMinEuros] = useState('');
  const [priceMaxEuros, setPriceMaxEuros] = useState('');
  const [sort, setSort] = useState<ProductSort>('random');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [layout, setLayout] = useState<LayoutMode>('grid');

  const [items, setItems] = useState<ProductDto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchInput), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [category, stock, priceMinEuros, priceMaxEuros, sort, debouncedSearch]);

  const loadCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/products?limit=300&sort=new');
      if (!res.ok) throw new Error('Categories fetch failed');
      const data = (await res.json()) as { items: ProductDto[] };
      const cats = [...new Set((data.items ?? []).map(p => p.category))].filter(Boolean).sort();
      setCategories(cats);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Impossible de charger les catégories.';
      setError(msg);
    }
  }, []);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    const priceMinCents = parseEurosToCents(priceMinEuros);
    const priceMaxCents = parseEurosToCents(priceMaxEuros);
    try {
      const qs = buildProductsQueryString({
        page,
        limit: PAGE_SIZE,
        category,
        stock,
        priceMinCents,
        priceMaxCents,
        q: debouncedSearch,
        sort,
      });
      const res = await fetch(`/api/products?${qs}`);
      if (!res.ok) throw new Error(`Products request failed (${res.status})`);
      const data = (await res.json()) as { items: ProductDto[]; total: number };
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Chargement des produits impossible.';
      setError(msg);
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [
    page,
    category,
    stock,
    priceMinEuros,
    priceMaxEuros,
    debouncedSearch,
    sort,
  ]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const resetFilters = useCallback(() => {
    setCategory('');
    setStock('all');
    setPriceMinEuros('');
    setPriceMaxEuros('');
    setSort('random');
    setSearchInput('');
    setDebouncedSearch('');
    setPage(1);
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <ShopBreadcrumb
        items={[
          { label: 'Accueil', href: '/' },
          { label: 'Boutique' },
        ]}
      />

      <header className="mb-8">
        <h1
          className="text-2xl font-semibold tracking-tight sm:text-3xl"
          style={{ color: 'var(--dashboard-text-bright)' }}
        >
          Boutique
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--dashboard-text-secondary)' }}>
          Parcourez le catalogue, filtrez et triez les produits.
        </p>
      </header>

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        <FilterSidebar
          categories={categories}
          category={category}
          onCategoryChange={setCategory}
          priceMinEuros={priceMinEuros}
          priceMaxEuros={priceMaxEuros}
          onPriceMinChange={setPriceMinEuros}
          onPriceMaxChange={setPriceMaxEuros}
          stock={stock}
          onStockChange={setStock}
          onReset={resetFilters}
        />

        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-1 flex-col gap-2 sm:max-w-md">
              <label htmlFor="shop-search" className="sr-only">
                Recherche
              </label>
              <input
                id="shop-search"
                type="search"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="Rechercher un produit…"
                className="w-full rounded-[var(--dashboard-radius-input)] border px-3 py-2 text-sm outline-none ring-[var(--dashboard-accent-ring)] focus:ring-2"
                style={{
                  borderColor: 'var(--dashboard-border-mid)',
                  background: 'var(--dashboard-surface)',
                  color: 'var(--dashboard-text-primary)',
                }}
                autoComplete="off"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <SortDropdown value={sort} onChange={setSort} />
              <LayoutToggle mode={layout} onChange={setLayout} />
            </div>
          </div>

          <ProductGrid items={items} layout={layout} loading={loading} error={error} />

          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            onPageChange={setPage}
          />
        </div>
      </div>
    </div>
  );
}
