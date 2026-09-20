const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

async function request(endpoint, options = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
      signal: controller.signal,
    });
    clearTimeout(id);

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) {
      const err = new Error(data.error?.message || `Request failed with status ${res.status}`);
      err.code = data.error?.code;
      err.status = res.status;
      throw err;
    }
    return data.data !== undefined ? data.data : data;
  } catch (err) {
    clearTimeout(id);
    if (err.name === 'AbortError') throw new Error('Request timed out. Please retry.');
    throw err;
  }
}

export const healthApi = {
  check: () => request('/health', {}, 5000),
};

export const productsApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', params.page);
    if (params.limit) qs.set('limit', params.limit);
    if (params.category) qs.set('category', params.category);
    if (params.search) qs.set('search', params.search);
    return request(`/products?${qs.toString()}`);
  },
  search: (q) => request(`/products/search?q=${encodeURIComponent(q)}`),
  getById: (id) => request(`/products/${id}`),
};

export const trackingApi = {
  list: () => request('/tracked-products'),
  track: (productId, scrapeIntervalMinutes = 120) =>
    request('/tracked-products', {
      method: 'POST',
      body: JSON.stringify({ productId, scrapeIntervalMinutes }),
    }),
  untrack: (trackingId) => request(`/tracked-products/${trackingId}`, { method: 'DELETE' }),
};

export const historyApi = {
  getPriceHistory: (trackingId) => request(`/tracked-products/${trackingId}/price-history`),
  getStockHistory: (trackingId) => request(`/tracked-products/${trackingId}/stock-history`),
  getObservations: (trackingId, limit = 50) => request(`/tracked-products/${trackingId}/history?limit=${limit}`),
  getScrapeLogs: (trackingId) => request(`/tracked-products/${trackingId}/scrape-logs`),
  getStatus: (trackingId) => request(`/tracked-products/${trackingId}/status`),
};

export const scrapeApi = {
  scrapeNow: (trackingId) => request(`/scrape/product/${trackingId}`, { method: 'POST' }, 60000),
  runDue: (force = false) => request(`/scheduler/run-due${force ? '?force=true' : ''}`, { method: 'POST' }, 60000),
};

export default { healthApi, productsApi, trackingApi, historyApi, scrapeApi };
