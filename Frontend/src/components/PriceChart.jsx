import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { formatCurrency, formatDateTime } from '../utils/format';

function CustomTooltip({ active, payload }) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900 text-white p-2.5 rounded-md shadow-md text-xs space-y-0.5">
        <p className="font-bold text-sm text-emerald-400">{formatCurrency(data.price)}</p>
        <p className="text-slate-300 text-[11px]">{formatDateTime(data.timestamp)}</p>
      </div>
    );
  }
  return null;
}

export default function PriceChart({ data = [] }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center border border-dashed border-slate-200 rounded-lg text-slate-400 text-xs">
        No price observations recorded yet.
      </div>
    );
  }

  const chartData = data.map((d) => ({
    timestamp: d.timestamp,
    price: Number(d.price),
    displayDate: new Date(d.timestamp).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
  }));

  const minPrice = Math.min(...chartData.map((d) => d.price));
  const maxPrice = Math.max(...chartData.map((d) => d.price));
  const padding = Math.max((maxPrice - minPrice) * 0.1, 100);

  return (
    <div className="space-y-2">
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6C3BFF" stopOpacity={0.18} />
                <stop offset="95%" stopColor="#6C3BFF" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis
              dataKey="displayDate"
              tick={{ fontSize: 11, fill: '#94A3B8' }}
              tickLine={false}
              axisLine={{ stroke: '#E2E8F0' }}
            />
            <YAxis
              domain={[Math.max(0, Math.floor(minPrice - padding)), Math.ceil(maxPrice + padding)]}
              tick={{ fontSize: 11, fill: '#94A3B8' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="price"
              stroke="#6C3BFF"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#priceGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {chartData.length === 1 && (
        <p className="text-[11px] text-slate-500 text-center italic">
          Price history chart will show trends after additional scheduled scrapes.
        </p>
      )}
    </div>
  );
}
