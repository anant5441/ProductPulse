import React from 'react';
import { formatCurrency, formatDateTime, getStockInfo } from '../utils/format';

export default function ObservationsTable({ history = [] }) {
  if (!history || history.length === 0) {
    return (
      <div className="p-8 text-center border border-dashed border-slate-200 rounded-lg text-slate-400 text-xs">
        No price observation records found.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white">
      <table className="w-full text-left text-xs text-slate-600">
        <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
          <tr>
            <th className="py-2.5 px-4">Observation Time</th>
            <th className="py-2.5 px-4">Observed Price</th>
            <th className="py-2.5 px-4">MRP</th>
            <th className="py-2.5 px-4">Discount</th>
            <th className="py-2.5 px-4">Stock Status</th>
            <th className="py-2.5 px-4">Seller</th>
            <th className="py-2.5 px-4">Est. Delivery</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 font-normal">
          {history.map((row) => {
            const stock = getStockInfo(row.stockStatus, row.stock);
            return (
              <tr key={row.id} className="hover:bg-slate-50/75 transition-colors">
                <td className="py-2.5 px-4 font-mono text-slate-800">{formatDateTime(row.scrapedAt)}</td>
                <td className="py-2.5 px-4 font-semibold text-slate-900">{formatCurrency(row.price)}</td>
                <td className="py-2.5 px-4 text-slate-400 line-through">{formatCurrency(row.originalPrice)}</td>
                <td className="py-2.5 px-4">
                  {row.discount ? (
                    <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-medium">
                      {row.discount}%
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="py-2.5 px-4">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${stock.dotClass}`} />
                    <span>{stock.label}</span>
                  </div>
                </td>
                <td className="py-2.5 px-4 text-slate-700">{row.sellerName || 'Direct'}</td>
                <td className="py-2.5 px-4 text-slate-500">{row.deliveryText || 'Standard'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
