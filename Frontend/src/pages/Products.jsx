import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Plus, Check, ChevronLeft, ChevronRight, Package, ArrowUpRight } from 'lucide-react';
import { productsApi, trackingApi } from '../api/client';
import { useToast } from '../context/ToastContext';

const CATEGORIES = ['All', 'Audio', 'Furniture', 'Kitchen', 'Lighting', 'Smart Home', 'Wearables'];

export default function Products() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryParam = searchParams.get('q') || '';
  const categoryParam = searchParams.get('category') || 'All';
  const pageParam = parseInt(searchParams.get('page') || '1', 10);

  const [searchTerm, setSearchTerm] = useState(queryParam);
  const [products, setProducts] = useState([]);
  const [trackedIds, setTrackedIds] = useState(new Set());
  const [trackingLoading, setTrackingLoading] = useState({});
  const [pageInfo, setPageInfo] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { showToast } = useToast();
  const debounceRef = useRef(null);

  // Load existing tracked products to mark "Tracked" state
  const loadTrackedStatus = useCallback(async () => {
    try {
      const res = await trackingApi.list();
      const ids = new Set((res.trackedProducts || []).map((t) => t.product?.id).filter(Boolean));
      setTrackedIds(ids);
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    loadTrackedStatus();
  }, [loadTrackedStatus]);

  // Fetch catalog or search
  const loadProducts = useCallback(async (q, cat, page) => {
    setLoading(true);
    setError(null);
    try {
      if (q && q.trim().length > 0) {
        // Search endpoint
        const res = await productsApi.search(q.trim());
        const items = res.products || [];
        const filtered = cat !== 'All' ? items.filter((p) => p.category === cat) : items;
        setProducts(filtered);
        setPageInfo({ page: 1, pages: 1, total: filtered.length });
      } else {
        // Paginated catalog endpoint
        const res = await productsApi.list({
          page,
          limit: 18,
          category: cat !== 'All' ? cat : undefined,
        });
        setProducts(res.products || []);
        setPageInfo({ page: res.page || 1, pages: res.pages || 1, total: res.total || 0 });
      }
    } catch (err) {
      setError(err.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, []);

  // Synchronize on searchParams changes
  useEffect(() => {
    loadProducts(queryParam, categoryParam, pageParam);
  }, [queryParam, categoryParam, pageParam, loadProducts]);

  // Handle live debounced search input
  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchTerm(val);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const next = new URLSearchParams(searchParams);
      if (val.trim()) next.set('q', val.trim());
      else next.delete('q');
      next.set('page', '1');
      setSearchParams(next);
    }, 350);
  };

  const handleCategorySelect = (cat) => {
    const next = new URLSearchParams(searchParams);
    if (cat !== 'All') next.set('category', cat);
    else next.delete('category');
    next.set('page', '1');
    setSearchParams(next);
  };

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > pageInfo.pages) return;
    const next = new URLSearchParams(searchParams);
    next.set('page', String(newPage));
    setSearchParams(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Track product action
  const handleTrackProduct = async (product) => {
    setTrackingLoading((prev) => ({ ...prev, [product.id]: true }));
    try {
      await trackingApi.track(product.id, 120);
      showToast(`Added "${product.name}" to tracking`, 'success');
      setTrackedIds((prev) => new Set([...prev, product.id]));
    } catch (err) {
      if (err.status === 409 || err.code === 'DUPLICATE_TRACKER') {
        showToast('This product is already being tracked.', 'info');
        setTrackedIds((prev) => new Set([...prev, product.id]));
      } else {
        showToast(err.message || 'Could not track product.', 'error');
      }
    } finally {
      setTrackingLoading((prev) => ({ ...prev, [product.id]: false }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Product Catalog</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Browse the INE storefront catalog and select products to monitor.
        </p>
      </div>

      {/* Search & Category Filter Bar */}
      <div className="space-y-3 bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Search products, brands, categories or SKU (e.g. Domus, Microphone)..."
            className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-[#6C3BFF] focus:bg-white transition-colors"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => handleCategorySelect(cat)}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                categoryParam === cat
                  ? 'bg-[#6C3BFF] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Results Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>
            Showing <strong className="text-slate-700">{products.length}</strong> {products.length === 1 ? 'product' : 'products'}
            {pageInfo.total > 0 && ` of ${pageInfo.total}`}
          </span>
        </div>

        {/* Loading Skeletons */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white p-5 rounded-lg border border-slate-200 space-y-3 animate-pulse">
                <div className="h-3 bg-slate-100 rounded w-1/3" />
                <div className="h-4 bg-slate-200 rounded w-4/5" />
                <div className="h-10 bg-slate-50 rounded" />
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
              onClick={() => loadProducts(queryParam, categoryParam, pageParam)}
              className="px-3 py-1.5 text-xs font-medium bg-rose-600 hover:bg-rose-700 text-white rounded-md transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && products.length === 0 && (
          <div className="p-12 text-center bg-white border border-dashed border-slate-200 rounded-lg space-y-2">
            <Package className="w-8 h-8 text-slate-300 mx-auto" />
            <h4 className="text-sm font-semibold text-slate-800">No products found</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Try searching with another keyword, category filter, or SKU.
            </p>
          </div>
        )}

        {/* Product Cards Grid */}
        {!loading && !error && products.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((item) => {
              const isTracked = trackedIds.has(item.id);
              const isTracking = Boolean(trackingLoading[item.id]);

              return (
                <div
                  key={item.id}
                  className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-medium tracking-wider uppercase text-slate-400">
                      <span>{item.brand || 'Store Item'}</span>
                      <span className="text-slate-500 font-normal normal-case">{item.category}</span>
                    </div>

                    <Link
                      to={`/products/${item.id}`}
                      className="font-semibold text-slate-900 text-sm hover:text-[#6C3BFF] line-clamp-1 block mt-1 transition-colors"
                    >
                      {item.name}
                    </Link>
                    <span className="text-xs font-mono text-slate-400 block mt-0.5">{item.sku}</span>

                    <p className="text-xs text-slate-500 line-clamp-2 mt-2 leading-relaxed">
                      {item.description || 'No description available for this catalog item.'}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <Link
                      to={`/products/${item.id}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 px-2.5 py-1.5 rounded hover:bg-slate-100 transition-colors"
                    >
                      <span>Details</span>
                      <ArrowUpRight className="w-3 h-3" />
                    </Link>

                    {isTracked ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-md">
                        <Check className="w-3.5 h-3.5" />
                        <span>Tracked</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleTrackProduct(item)}
                        disabled={isTracking}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#6C3BFF] hover:bg-[#5829e6] rounded-md transition-colors disabled:opacity-60 shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{isTracking ? 'Adding...' : 'Track'}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Controls */}
        {!loading && !error && pageInfo.pages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-slate-200 text-xs">
            <button
              onClick={() => handlePageChange(pageInfo.page - 1)}
              disabled={pageInfo.page <= 1}
              className="inline-flex items-center gap-1 px-3 py-1.5 border border-slate-200 rounded-md bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>

            <span className="text-slate-500 font-medium">
              Page {pageInfo.page} of {pageInfo.pages}
            </span>

            <button
              onClick={() => handlePageChange(pageInfo.page + 1)}
              disabled={pageInfo.page >= pageInfo.pages}
              className="inline-flex items-center gap-1 px-3 py-1.5 border border-slate-200 rounded-md bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
