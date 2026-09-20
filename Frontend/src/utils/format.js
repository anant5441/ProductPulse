export function formatCurrency(amount) {
  if (amount == null || isNaN(amount)) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDateTime(isoString) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatRelativeTime(isoString) {
  if (!isoString) return 'Never checked';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '—';
  
  const elapsedSec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (elapsedSec < 60) return 'Just now';
  if (elapsedSec < 3600) return `${Math.floor(elapsedSec / 60)} min ago`;
  if (elapsedSec < 86400) return `${Math.floor(elapsedSec / 3600)} hr ago`;
  if (elapsedSec < 172800) return 'Yesterday';
  return `${Math.floor(elapsedSec / 86400)} days ago`;
}

export function getStockInfo(status, quantity) {
  const norm = String(status || '').toLowerCase();
  if (norm === 'in_stock' || (quantity != null && quantity > 5)) {
    return { label: quantity != null ? `In stock (${quantity})` : 'In stock', dotClass: 'bg-emerald-500', textClass: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
  }
  if (norm === 'low_stock' || (quantity != null && quantity > 0 && quantity <= 5)) {
    return { label: quantity != null ? `Low stock (${quantity} left)` : 'Low stock', dotClass: 'bg-amber-500', textClass: 'text-amber-700 bg-amber-50 border-amber-200' };
  }
  if (norm === 'out_of_stock' || quantity === 0) {
    return { label: 'Out of stock', dotClass: 'bg-rose-500', textClass: 'text-rose-700 bg-rose-50 border-rose-200' };
  }
  return { label: 'Status unknown', dotClass: 'bg-slate-400', textClass: 'text-slate-600 bg-slate-50 border-slate-200' };
}
