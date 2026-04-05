'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface SalesBucket {
  key: string;
  revenue: number;
  orders: number;
}

interface SalesBarChartProps {
  buckets: SalesBucket[];
  currency: string;
}

function formatMoney(currency: string, value: number): string {
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: currency || 'EUR', maximumFractionDigits: 0 }).format(value);
  } catch {
    return String(value);
  }
}

export function SalesBarChart({ buckets, currency }: SalesBarChartProps) {
  return (
    <div className="h-72 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={buckets} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--dashboard-chart-grid)" strokeDasharray="3 3" />
          <XAxis dataKey="key" tick={{ fill: 'var(--dashboard-chart-tick)', fontSize: 10 }} interval="preserveStartEnd" />
          <YAxis tick={{ fill: 'var(--dashboard-chart-tick)', fontSize: 11 }} tickFormatter={v => formatMoney(currency, Number(v))} width={72} />
          <Tooltip
            contentStyle={{
              background: 'var(--dashboard-chart-tooltip-bg)',
              border: '1px solid var(--dashboard-chart-tooltip-border)',
              borderRadius: 12,
              color: 'var(--dashboard-chart-tooltip-text)',
            }}
            formatter={(value: number | string, name: string) =>
              name === 'revenue' ? [formatMoney(currency, Number(value)), 'Revenu'] : [value, 'Commandes']
            }
          />
          <Bar dataKey="revenue" fill="var(--dashboard-chart-series-1)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
