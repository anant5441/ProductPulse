import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Plus, Check, Star, ShieldCheck, ArrowUpRight } from 'lucide-react';
import { productsApi, trackingApi } from '../api/client';
import { formatCurrency, formatDateTime, getStockInfo } from '../utils/format';
import { useToast } from '../context/ToastContext';

export default function ProductDetails() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const { showToast } = useToast();

  const loadDetails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await productsApi.getById(id);
      setData(res);
    } catch (err) {
      setError(err.message || 'Product not found');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  const handleTrack = async () => {
    if (!data?.product?.id) return;
    setTrackingLoading(true);
    try {
      const res = await trackingApi.track(data.product.id, 120);
      showToast('Product added to tracking watchlist', 'success');
      setData((prev) => ({
        ...prev,
        tracking: { id: res.id, is_active: true },
      }));
    } catch (err) {
      showToast(err.message || 'Could not track product', 'error');
    } finally {
      setTrackingLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto">
        <div className="h-4 bg-slate-200 rounded w-28 animate-pulse" />
        <div className="bg-white p-6 rounded-lg border border-slate-200 space-y-4 animate-pulse">
          <div className="h-6 bg-slate-200 rounded w-1/2" />
          <div className="h-4 bg-slate-100 rounded w-1/4" />
          <div className="h-24 bg-slate-50 rounded mt-4" />
        </div>
      </div>
    );
  }

  if (error || !data?.product) {
    return (
      <div className="p-12 text-center bg-white border border-slate-200 rounded-lg max-w-md mx-auto space-y-3">
        <p className="text-sm font-medium text-rose-700">{error || 'Product not found'}</p>
        <Link
          to="/products"
          className="inline-flex items-center gap-1 text-xs font-medium text-[#6C3BFF] hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Product Catalog</span>
        </Link>
      </div>
    );
  }

  const { product, tracking, latestObservation } = data;
  const specs = product.specifications || {};
  const reviews = product.metadata?.reviews || [];
  const stock = latestObservation ? getStockInfo(latestObservation.stockStatus, latestObservation.stock) : null;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Back Navigation */}
      <Link
        to="/products"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to products</span>
      </Link>

      {/* Main Product Header Card */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold tracking-wider uppercase text-slate-500">
                {product.brand}
              </span>
              <span className="text-slate-300">·</span>
              <span className="text-xs text-slate-500">{product.category}</span>
            </div>

            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {product.name}
            </h2>

            <div className="flex items-center gap-3 pt-1">
              <span className="text-xs font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                {product.sku}
              </span>
              {product.product_url && (
                <a
                  href={product.product_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-[#6C3BFF] hover:underline font-medium"
                >
                  <span>View on INE Store</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>

          {/* Tracking Status / Action CTA */}
          <div className="sm:text-right shrink-0">
            {tracking?.is_active ? (
              <div className="space-y-2">
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Check className="w-3.5 h-3.5" />
                  <span>Currently Tracking</span>
                </span>
                <div>
                  <Link
                    to={`/tracked/${tracking.id}`}
                    className="inline-flex items-center gap-1 px-3.5 py-1.5 text-xs font-medium text-white bg-[#6C3BFF] hover:bg-[#5829e6] rounded-md transition-colors shadow-xs"
                  >
                    <span>View Tracking Dashboard</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ) : (
              <button
                onClick={handleTrack}
                disabled={trackingLoading}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#6C3BFF] hover:bg-[#5829e6] rounded-md transition-colors shadow-xs disabled:opacity-60"
              >
                <Plus className="w-4 h-4" />
                <span>{trackingLoading ? 'Adding...' : 'Track this product'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Latest Observation Card if tracked */}
        {latestObservation && (
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
                Latest Observed Price
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-bold text-slate-900 tracking-tight">
                  {formatCurrency(latestObservation.price)}
                </span>
                {latestObservation.originalPrice && latestObservation.originalPrice > latestObservation.price && (
                  <span className="text-xs text-slate-400 line-through">
                    MRP {formatCurrency(latestObservation.originalPrice)}
                  </span>
                )}
                {latestObservation.discount > 0 && (
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                    {latestObservation.discount}% off
                  </span>
                )}
              </div>
            </div>

            {stock && (
              <div className="text-right">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
                  Availability
                </span>
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border mt-1 ${stock.textClass}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${stock.dotClass}`} />
                  <span>{stock.label}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Description */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900">About this item</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            {product.description || 'No detailed description available for this item.'}
          </p>
        </div>

        {/* Specifications (Two Column Layout) */}
        {Object.keys(specs).length > 0 && (
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900">Specifications</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50/75 p-4 rounded-lg border border-slate-200 text-xs">
              {Object.entries(specs).map(([key, val]) => (
                <div key={key} className="space-y-0.5">
                  <span className="text-[11px] font-medium text-slate-400 capitalize">
                    {key.replace(/([A-Z])/g, ' $1')}
                  </span>
                  <p className="font-medium text-slate-800">{String(val)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reviews Section */}
        {reviews.length > 0 && (
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900">Customer Feedback ({reviews.length})</h3>
            <div className="space-y-2.5">
              {reviews.map((rev) => (
                <div key={rev.id || Math.random()} className="p-3.5 bg-slate-50/50 rounded-lg border border-slate-200 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-amber-500">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-3.5 h-3.5 ${i < (rev.rating || 5) ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`}
                        />
                      ))}
                      <span className="text-slate-800 font-semibold ml-1.5">{rev.title}</span>
                    </div>
                    <span className="text-[11px] text-slate-400">{rev.date}</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed">{rev.body}</p>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 pt-1">
                    <span>By {rev.author}</span>
                    {rev.verifiedPurchase && (
                      <span className="inline-flex items-center gap-0.5 text-emerald-600 font-medium">
                        <ShieldCheck className="w-3 h-3" />
                        Verified Purchase
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
