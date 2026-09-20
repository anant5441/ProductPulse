import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Package, CheckCircle2, AlertTriangle, Clock, RefreshCw, Search } from 'lucide-react';
import { trackingApi } from '../api/client';
import TrackedCard from '../components/TrackedCard';
import Modal from '../components/Modal';
import { useToast } from '../context/ToastContext';
import { formatRelativeTime } from '../utils/format';

export default function Dashboard() {
  const [trackedList, setTrackedList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [untrackItem, setUntrackItem] = useState(null);
  const [isUntracking, setIsUntracking] = useState(false);
  const { showToast } = useToast();

  const loadTracked = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      setError(null);
      const res = await trackingApi.list();
      setTrackedList(res.trackedProducts || []);
    } catch (err) {
      setError(err.message || 'Failed to load tracked products');
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTracked();
  }, [loadTracked]);

  const handleConfirmUntrack = async () => {
    if (!untrackItem) return;
    setIsUntracking(true);
    try {
      await trackingApi.untrack(untrackItem.trackingId);
      showToast('Product untracked. Price and scrape history preserved.', 'info');
      setUntrackItem(null);
      loadTracked(true);
    } catch (err) {
      showToast(err.message || 'Could not untrack product.', 'error');
    } finally {
      setIsUntracking(false);
    }
  };

  // Metrics derived from actual data
  const totalTracked = trackedList.length;
  const successfulScrapes = trackedList.filter((t) => t.lastScrapeStatus === 'success').length;
  const failedScrapes = trackedList.filter((t) => t.lastScrapeStatus === 'failed').length;
  const mostRecentScrape = trackedList
    .map((t) => t.lastScrapedAt || t.lastSuccessAt)
    .filter(Boolean)
    .sort((a, b) => new Date(b) - new Date(a))[0];

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Product Tracking</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitor live prices and stock levels from the INE mock storefront.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadTracked(false)}
            className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors shadow-xs"
            title="Refresh dashboard"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <Link
            to="/products"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#6C3BFF] hover:bg-[#5829e6] text-white text-xs font-medium rounded-md shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Track product</span>
          </Link>
        </div>
      </div>

      {/* Summary Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>Tracked Products</span>
            <Package className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{loading ? '—' : totalTracked}</p>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>Successful Scrapes</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{loading ? '—' : successfulScrapes}</p>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>Failed Scrapes</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{loading ? '—' : failedScrapes}</p>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>Last Activity</span>
            <Clock className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-sm font-semibold text-slate-800 mt-2.5 truncate">
            {loading ? '—' : formatRelativeTime(mostRecentScrape)}
          </p>
        </div>
      </div>

      {/* Tracked Products Section */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider text-[11px]">
            Monitored Products ({trackedList.length})
          </h3>
        </div>

        {/* Loading Skeleton */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white p-5 rounded-lg border border-slate-200 space-y-3 animate-pulse">
                <div className="h-3 bg-slate-100 rounded w-1/4" />
                <div className="h-4 bg-slate-200 rounded w-3/4" />
                <div className="h-6 bg-slate-100 rounded w-1/2 pt-4" />
                <div className="h-8 bg-slate-100 rounded mt-4" />
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="p-6 bg-rose-50 border border-rose-200 rounded-lg text-center space-y-2">
            <p className="text-sm font-medium text-rose-800">{error}</p>
            <button
              onClick={() => loadTracked(false)}
              className="px-3 py-1.5 text-xs font-medium bg-rose-600 hover:bg-rose-700 text-white rounded-md transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && trackedList.length === 0 && (
          <div className="p-12 text-center bg-white border border-dashed border-slate-200 rounded-lg space-y-3">
            <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-800">No products tracked yet</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                Start monitoring a product's price and stock from the INE store.
              </p>
            </div>
            <Link
              to="/products"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#6C3BFF] hover:bg-[#5829e6] text-white text-xs font-medium rounded-md transition-colors"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Find a product</span>
            </Link>
          </div>
        )}

        {/* Tracked Product Grid */}
        {!loading && !error && trackedList.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {trackedList.map((item) => (
              <TrackedCard
                key={item.trackingId}
                item={item}
                onRefresh={() => loadTracked(true)}
                onUntrackRequest={(it) => setUntrackItem(it)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Untrack Confirmation Modal */}
      <Modal
        isOpen={Boolean(untrackItem)}
        onClose={() => setUntrackItem(null)}
        onConfirm={handleConfirmUntrack}
        isLoading={isUntracking}
        isDanger={true}
        title="Stop tracking this product?"
        message={`Are you sure you want to untrack "${untrackItem?.product?.name}"? Your historical price and scrape data will remain fully preserved.`}
        confirmText="Stop tracking"
      />
    </div>
  );
}
