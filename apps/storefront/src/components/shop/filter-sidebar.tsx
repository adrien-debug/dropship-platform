'use client';

import type { CSSProperties, FC } from 'react';
import type { StockFilter } from '@/lib/product-types';

export interface FilterSidebarProps {
  categories: string[];
  category: string;
  onCategoryChange: (value: string) => void;
  priceMinEuros: string;
  priceMaxEuros: string;
  onPriceMinChange: (value: string) => void;
  onPriceMaxChange: (value: string) => void;
  stock: StockFilter;
  onStockChange: (value: StockFilter) => void;
  onReset: () => void;
}

const labelClass = 'mb-1 block text-xs font-medium uppercase tracking-wide';
const labelStyle = { color: 'var(--dashboard-text-muted)' };
const inputClass =
  'w-full rounded-[var(--dashboard-radius-input)] border px-3 py-2 text-sm outline-none ring-[var(--dashboard-accent-ring)] focus:ring-2';

const inputStyle: CSSProperties = {
  borderColor: 'var(--dashboard-border-mid)',
  background: 'var(--dashboard-surface)',
  color: 'var(--dashboard-text-primary)',
};

export const FilterSidebar: FC<FilterSidebarProps> = ({
  categories,
  category,
  onCategoryChange,
  priceMinEuros,
  priceMaxEuros,
  onPriceMinChange,
  onPriceMaxChange,
  stock,
  onStockChange,
  onReset,
}) => {
  return (
    <aside
      className="flex w-full flex-col gap-6 rounded-[var(--dashboard-radius-card)] border p-4 lg:max-w-xs lg:shrink-0"
      style={{
        borderColor: 'var(--dashboard-border-mid)',
        background: 'var(--dashboard-card)',
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--dashboard-text-bright)' }}>
          Filtres
        </h2>
        <button
          type="button"
          onClick={onReset}
          className="text-xs font-medium underline-offset-2 hover:underline"
          style={{ color: 'var(--dashboard-accent)' }}
        >
          Réinitialiser
        </button>
      </div>

      <div>
        <label htmlFor="filter-category" className={labelClass} style={labelStyle}>
          Catégorie
        </label>
        <select
          id="filter-category"
          value={category}
          onChange={e => onCategoryChange(e.target.value)}
          className={inputClass}
          style={inputStyle}
        >
          <option value="">Toutes</option>
          {categories.map(c => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div>
        <span className={labelClass} style={labelStyle}>
          Prix (EUR)
        </span>
        <div className="flex gap-2">
          <div className="flex-1">
            <label htmlFor="price-min" className="sr-only">
              Minimum
            </label>
            <input
              id="price-min"
              type="number"
              min={0}
              step={0.01}
              placeholder="Min"
              value={priceMinEuros}
              onChange={e => onPriceMinChange(e.target.value)}
              className={inputClass}
              style={inputStyle}
            />
          </div>
          <div className="flex-1">
            <label htmlFor="price-max" className="sr-only">
              Maximum
            </label>
            <input
              id="price-max"
              type="number"
              min={0}
              step={0.01}
              placeholder="Max"
              value={priceMaxEuros}
              onChange={e => onPriceMaxChange(e.target.value)}
              className={inputClass}
              style={inputStyle}
            />
          </div>
        </div>
      </div>

      <fieldset>
        <legend className={`${labelClass} mb-2`} style={labelStyle}>
          Stock
        </legend>
        <div className="flex flex-col gap-2">
          {(
            [
              ['all', 'Tous'],
              ['in_stock', 'En stock'],
              ['out_of_stock', 'Rupture'],
            ] as const
          ).map(([val, lab]) => (
            <label
              key={val}
              className="flex cursor-pointer items-center gap-2 text-sm"
              style={{ color: 'var(--dashboard-text-primary)' }}
            >
              <input
                type="radio"
                name="stock"
                value={val}
                checked={stock === val}
                onChange={() => onStockChange(val)}
                className="h-4 w-4 shrink-0"
                style={{ accentColor: 'var(--dashboard-accent)' }}
              />
              {lab}
            </label>
          ))}
        </div>
      </fieldset>
    </aside>
  );
};
