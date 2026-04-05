'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface RevenuePoint {
  date: string;
  revenue: number;
}

interface RevenueLineChartProps {
  points: RevenuePoint[];
  currency: string;
}

function formatMoney(currency: string, value: number): string {
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: currency || 'EUR', maximumFractionDigits: 0 }).format(value);
  } catch {
    return String(value);
  }
}

export function RevenueLineChart({ points, currency }: RevenueLineChartProps) {
  return (
    <div className="h-72 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--dashboard-chart-grid)" strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fill: 'var(--dashboard-chart-tick)', fontSize: 11 }} />
          <YAxis tick={{ fill: 'var(--dashboard-chart-tick)', fontSize: 11 }} tickFormatter={v => formatMoney(currency, Number(v))} width={72} />
          <Tooltip
            contentStyle={{
              background: 'var(--dashboard-chart-tooltip-bg)',
              border: '1px solid var(--dashboard-chart-tooltip-border)',
              borderRadius: 12,
              color: 'var(--dashboard-chart-tooltip-text)',
            }}
            formatter={(value: number | string) => [formatMoney(currency, Number(value)), 'Revenu']}
            labelFormatter={label => String(label)}
          />
          <Line type="monotone" dataKey="revenue" stroke="var(--dashboard-chart-series-1)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
