import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Trash2, LineChart, Table, Terminal, ExternalLink } from 'lucide-react';
import { historyApi, scrapeApi, trackingApi } from '../api/client';
import { formatCurrency, formatDateTime, formatRelativeTime, getStockInfo } from '../utils/format';
import PriceChart from '../components/PriceChart';
import ObservationsTable from '../components/ObservationsTable';
import ScrapeLogTable from '../components/ScrapeLogTable';
import Modal from '../components/Modal';
import { useToast } from '../context/ToastContext';

export default function TrackingDetails() {
  const { trackingId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState('charts'); // 'charts' | 'observations' | 'logs'
  const [statusData, setStatusData] = useState(null);
  const [priceHistory, setPriceHistory] = useState([]);
  const [stockHistory, setStockHistory] = useState([]);
  const [observations, setObservations] = useState([]);
  const [scrapeLogs, setScrapeLogs] = useState([]);

  const [loading, setLoading] = useState(true);
  const [isScraping, setIsScraping] = useState(false);
  const [isUntracking, setIsUntracking] = useState(false);
  const [showUntrackModal, setShowUntrackModal] = useState(false);
  const [error, setError] = useState(null);

  const loadAllTrackingData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setError(null);
    try {
      const [statusRes, priceRes, stockRes, obsRes, logsRes] = await Promise.all([
        historyApi.getStatus(trackingId),
        historyApi.getPriceHistory(trackingId),
        historyApi.getStockHistory(trackingId),
        historyApi.getObservations(trackingId, 50),
        historyApi.getScrapeLogs(trackingId),
      ]);

      setStatusData(statusRes);
      setPriceHistory(Array.isArray(priceRes) ? priceRes : (priceRes?.chartData || priceRes?.priceHistory || []));
      setStockHistory(Array.isArray(stockRes) ? stockRes : (stockRes?.stockData || stockRes?.stockHistory || []));
      setObservations(Array.isArray(obsRes) ? obsRes : (obsRes?.history || []));
      setScrapeLogs(Array.isArray(logsRes) ? logsRes : (logsRes?.logs || []));
    } catch (err) {
      setError(err.message || 'Failed to load tracking data');
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [trackingId]);

  useEffect(() => {
    loadAllTrackingData();
  }, [loadAllTrackingData]);

  const handleScrapeNow = async () => {
    if (isScraping) return;
    setIsScraping(true);
    try {
      const res = await scrapeApi.scrapeNow(trackingId);
      showToast(`Price updated: ${formatCurrency(res.price)} · ${res.stockStatus?.replace('_', ' ')}`, 'success');
      loadAllTrackingData(true);
    } catch (err) {
      showToast(err.message || 'Scrape attempt failed. See logs for details.', 'error');
      loadAllTrackingData(true);
    } finally {
      setIsScraping(false);
    }
  };

  const handleConfirmUntrack = async () => {
    setIsUntracking(true);
    try {
      await trackingApi.untrack(trackingId);
      showToast('Product untracked successfully. History preserved.', 'info');
      navigate('/');
    } catch (err) {
      showToast(err.message || 'Could not untrack product.', 'error');
    } finally {
      setIsUntracking(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-4 bg-slate-200 rounded w-28 animate-pulse" />
        <div className="bg-white p-6 rounded-lg border border-slate-200 space-y-4 animate-pulse">
          <div className="h-6 bg-slate-200 rounded w-1/3" />
          <div className="h-16 bg-slate-50 rounded mt-4" />
        </div>
      </div>
    );
  }

  if (error || !statusData) {
    return (
      <div className="p-12 text-center bg-white border border-slate-200 rounded-lg max-w-md mx-auto space-y-3">
        <p className="text-sm font-medium text-rose-700">{error || 'Tracker not found'}</p>
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-xs font-medium text-[#6C3BFF] hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Dashboard</span>
        </Link>
      </div>
    );
  }

  const product = statusData.product || statusData.tracker?.products || {};
  const tracking = statusData.tracking || statusData.tracker || {};
  const latestPrice = statusData.latestPrice;
  const originalPrice = statusData.originalPrice;
  const discount = statusData.discount;
  const stock = getStockInfo(statusData.stockStatus, statusData.stockQuantity);
  const hasDiscount = discount != null && discount > 0;
  const totalObservations = statusData.totalObservations || observations.length;

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Navigation */}
      <div className="flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Tracked Products</span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            onClick={handleScrapeNow}
            disabled={isScraping}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md shadow-xs transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScraping ? 'animate-spin text-[#6C3BFF]' : ''}`} />
            <span>{isScraping ? 'Checking price...' : 'Check price'}</span>
          </button>

          <button
            onClick={() => setShowUntrackModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Untrack</span>
          </button>
        </div>
      </div>

      {/* Main Product Header Card */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold tracking-wider uppercase text-slate-500">
                {product.brand}
              </span>
              <span className="text-slate-300">·</span>
              <span className="text-xs text-slate-500">{product.category}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
              {product.name}
            </h2>
            <div className="flex items-center gap-3 mt-1 text-xs">
              <span className="font-mono text-slate-400">{product.sku}</span>
              {product.product_url && (
                <a
                  href={product.product_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[#6C3BFF] hover:underline font-medium"
                >
                  <span>Store Page</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>

          {!tracking?.is_active && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200 self-start">
              Inactive (Untracked)
            </span>
          )}
        </div>

        {/* 4 Stats Cards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 pt-4 border-t border-slate-100">
          {/* Current Price */}
          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200/80">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
              Current Price
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl font-bold text-slate-900">
                {formatCurrency(latestPrice)}
              </span>
              {hasDiscount && (
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1 py-0.5 rounded">
                  {discount}% off
                </span>
              )}
            </div>
            {originalPrice && originalPrice > (latestPrice || 0) && (
              <span className="text-[11px] text-slate-400 line-through block mt-0.5">
                MRP {formatCurrency(originalPrice)}
              </span>
            )}
          </div>

          {/* Stock */}
          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200/80">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
              Stock Status
            </span>
            {stock ? (
              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border mt-2 ${stock.textClass}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${stock.dotClass}`} />
                <span>{stock.label}</span>
              </div>
            ) : (
              <span className="text-xs text-slate-400 mt-2 block">No stock data</span>
            )}
          </div>

          {/* Last Checked */}
          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200/80">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
              Last Checked
            </span>
            <p className="text-xs font-semibold text-slate-800 mt-2">
              {formatRelativeTime(statusData.lastScrapedAt || statusData.lastSuccessAt || tracking?.last_success_at)}
            </p>
            <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">
              Interval: {tracking?.scrape_interval_minutes || 120}m
            </span>
          </div>

          {/* Total Observations */}
          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200/80">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
              Observations
            </span>
            <p className="text-xl font-bold text-slate-900 mt-1">
              {totalObservations || observations.length || 0}
            </p>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              {scrapeLogs.length} scrape attempts
            </span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 gap-6 text-sm font-medium">
        <button
          onClick={() => setActiveTab('charts')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'charts'
              ? 'border-[#6C3BFF] text-[#6C3BFF]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <LineChart className="w-4 h-4" />
          <span>Price & Stock Charts</span>
        </button>

        <button
          onClick={() => setActiveTab('observations')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'observations'
              ? 'border-[#6C3BFF] text-[#6C3BFF]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Table className="w-4 h-4" />
          <span>Observations History ({observations.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'logs'
              ? 'border-[#6C3BFF] text-[#6C3BFF]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Terminal className="w-4 h-4" />
          <span>Scrape Telemetry ({scrapeLogs.length})</span>
        </button>
      </div>

      {/* Tab Panels */}
      <div>
        {activeTab === 'charts' && (
          <div className="space-y-6">
            <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                  Price History (INR)
                </h3>
                <span className="text-[11px] text-slate-400">
                  {priceHistory.length} data {priceHistory.length === 1 ? 'point' : 'points'}
                </span>
              </div>
              <PriceChart data={priceHistory} />
            </div>
          </div>
        )}

        {activeTab === 'observations' && (
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
              Recorded Price Observations
            </h3>
            <ObservationsTable history={observations} />
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                Scrape Execution Logs & Honest Telemetry
              </h3>
              <span className="text-xs text-slate-400">
                Playwright / Wasm proof-of-work attempts
              </span>
            </div>
            <ScrapeLogTable logs={scrapeLogs} />
          </div>
        )}
      </div>

      {/* Untrack Confirmation Modal */}
      <Modal
        isOpen={showUntrackModal}
        onClose={() => setShowUntrackModal(false)}
        onConfirm={handleConfirmUntrack}
        isLoading={isUntracking}
        isDanger={true}
        title="Stop tracking this product?"
        message="Your historical price and scrape telemetry data will be preserved in Supabase for future reference."
        confirmText="Stop tracking"
      />
    </div>
  );
}
