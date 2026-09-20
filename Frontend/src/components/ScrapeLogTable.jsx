import React from 'react';
import { Check, X, Clock, AlertCircle } from 'lucide-react';
import { formatDateTime } from '../utils/format';

function StatusBadge({ status }) {
  const norm = String(status || '').toLowerCase();
  if (norm === 'success') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
        <Check className="w-3 h-3 text-emerald-600" />
        <span>Success</span>
      </span>
    );
  }
  if (norm === 'timeout') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
        <Clock className="w-3 h-3 text-amber-600" />
        <span>Timeout</span>
      </span>
    );
  }
  if (norm === 'structure_error' || norm === 'validation_failed') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-orange-50 text-orange-700 border border-orange-200">
        <AlertCircle className="w-3 h-3 text-orange-600" />
        <span>Structure Error</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
      <X className="w-3 h-3 text-rose-600" />
      <span>Failed</span>
    </span>
  );
}

export default function ScrapeLogTable({ logs = [] }) {
  if (!logs || logs.length === 0) {
    return (
      <div className="p-8 text-center border border-dashed border-slate-200 rounded-lg text-slate-400 text-xs">
        No scrape telemetry recorded yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white">
      <table className="w-full text-left text-xs text-slate-600">
        <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
          <tr>
            <th className="py-2.5 px-4">Timestamp</th>
            <th className="py-2.5 px-4">Attempt</th>
            <th className="py-2.5 px-4">Status</th>
            <th className="py-2.5 px-4">HTTP Status</th>
            <th className="py-2.5 px-4">Latency</th>
            <th className="py-2.5 px-4">Error Diagnostics</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 font-normal">
          {logs.map((log) => {
            const durationSec = log.responseTimeMs != null ? (log.responseTimeMs / 1000).toFixed(2) + 's' : '—';
            return (
              <tr key={log.id} className="hover:bg-slate-50/75 transition-colors">
                <td className="py-2.5 px-4 font-mono text-slate-800">{formatDateTime(log.startedAt)}</td>
                <td className="py-2.5 px-4 font-mono">#{log.attemptNumber || 1}</td>
                <td className="py-2.5 px-4">
                  <StatusBadge status={log.status} />
                </td>
                <td className="py-2.5 px-4 font-mono text-slate-700">{log.httpStatus || '—'}</td>
                <td className="py-2.5 px-4 font-mono text-slate-700">{durationSec}</td>
                <td className="py-2.5 px-4 text-slate-500 max-w-xs truncate" title={log.errorMessage || ''}>
                  {log.errorMessage ? (
                    <span className="text-rose-600 font-mono text-[11px]">{log.errorMessage}</span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
