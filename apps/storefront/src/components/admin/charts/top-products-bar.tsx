'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface TopProductRow {
  description: string;
  quantity: number;
  revenue: number;
}

interface TopProductsBarProps {
  products: TopProductRow[];
  currency: string;
}

const COLORS = [
  'var(--dashboard-chart-series-1)',
  'var(--dashboard-chart-series-2)',
  'var(--dashboard-chart-series-3)',
];

function formatMoney(currency: string, value: number): string {
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: currency || 'EUR', maximumFractionDigits: 0 }).format(value);
  } catch {
    return String(value);
  }
}

export function TopProductsBar({ products, currency }: TopProductsBarProps) {
  const data = products.map((p, i) => ({
    name: p.description.length > 28 ? `${p.description.slice(0, 26)}…` : p.description,
    revenue: p.revenue,
    full: p.description,
    color: COLORS[i % COLORS.length],
  }));

  return (
    <div className="h-80 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
          <CartesianGrid stroke="var(--dashboard-chart-grid)" strokeDasharray="3 3" />
          <XAxis type="number" tick={{ fill: 'var(--dashboard-chart-tick)', fontSize: 11 }} tickFormatter={v => formatMoney(currency, Number(v))} />
          <YAxis type="category" dataKey="name" width={120} tick={{ fill: 'var(--dashboard-chart-tick)', fontSize: 10 }} />
          <Tooltip
            contentStyle={{
              background: 'var(--dashboard-chart-tooltip-bg)',
              border: '1px solid var(--dashboard-chart-tooltip-border)',
              borderRadius: 12,
              color: 'var(--dashboard-chart-tooltip-text)',
            }}
            formatter={(value: number | string) => [formatMoney(currency, Number(value)), 'Revenu']}
          />
          <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
