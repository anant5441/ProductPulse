import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, History, Trash2, ArrowUpRight } from 'lucide-react';
import { formatCurrency, formatRelativeTime, getStockInfo } from '../utils/format';
import { scrapeApi } from '../api/client';
import { useToast } from '../context/ToastContext';

export default function TrackedCard({ item, onRefresh, onUntrackRequest }) {
  const [isScraping, setIsScraping] = useState(false);
  const { showToast } = useToast();

  const product = item.product || {};
  const stock = getStockInfo(item.stockStatus, item.stockQuantity);
  const hasDiscount = item.discount != null && item.discount > 0;

  const handleScrapeNow = async (e) => {
    e.preventDefault();
    if (isScraping) return;
    setIsScraping(true);

    try {
      const res = await scrapeApi.scrapeNow(item.trackingId);
      showToast(`Price updated: ${formatCurrency(res.price)} · ${res.stockStatus?.replace('_', ' ')}`, 'success');
      if (onRefresh) onRefresh();
    } catch (err) {
      showToast(err.message || 'Scrape attempt failed. View logs for details.', 'error');
      if (onRefresh) onRefresh();
    } finally {
      setIsScraping(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between group">
      <div>
        {/* Header: Brand & Untrack button */}
        <div className="flex items-start justify-between gap-2">
          <span className="text-[11px] font-medium tracking-wider uppercase text-slate-500">
            {product.brand || 'Store Item'}
          </span>
          <button
            onClick={() => onUntrackRequest(item)}
            className="text-slate-300 hover:text-rose-600 p-1 -mr-1 -mt-1 rounded transition-colors"
            title="Untrack product"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Product Title & SKU */}
        <Link
          to={`/tracked/${item.trackingId}`}
          className="font-semibold text-slate-900 text-sm hover:text-[#6C3BFF] line-clamp-1 block mt-1 transition-colors"
        >
          {product.name || 'Unnamed Product'}
        </Link>
        <span className="text-xs font-mono text-slate-400 block mt-0.5">
          {product.sku || 'SKU —'}
        </span>

        {/* Price Row */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-baseline justify-between">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-slate-900 tracking-tight">
                {formatCurrency(item.latestPrice)}
              </span>
              {hasDiscount && (
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                  {item.discount}% off
                </span>
              )}
            </div>
            {item.originalPrice != null && item.originalPrice > (item.latestPrice || 0) && (
              <span className="text-xs text-slate-400 line-through block mt-0.5">
                MRP {formatCurrency(item.originalPrice)}
              </span>
            )}
          </div>

          {/* Stock Badge */}
          <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${stock.textClass}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${stock.dotClass}`} />
            <span>{stock.label}</span>
          </div>
        </div>

        {/* Scrape Status & Timestamp */}
        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
          <span>Checked {formatRelativeTime(item.lastScrapedAt || item.lastSuccessAt)}</span>
          {item.lastScrapeStatus === 'failed' && (
            <span className="text-rose-600 font-medium text-[11px]">Latest scrape failed</span>
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={handleScrapeNow}
          disabled={isScraping}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md transition-colors disabled:opacity-60"
        >
          <RefreshCw className={`w-3 h-3 ${isScraping ? 'animate-spin text-[#6C3BFF]' : ''}`} />
          <span>{isScraping ? 'Checking...' : 'Check price'}</span>
        </button>

        <Link
          to={`/tracked/${item.trackingId}`}
          className="inline-flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium text-[#6C3BFF] bg-[#6C3BFF]/5 hover:bg-[#6C3BFF]/10 border border-[#6C3BFF]/20 rounded-md transition-colors"
        >
          <History className="w-3 h-3" />
          <span>History</span>
          <ArrowUpRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}
