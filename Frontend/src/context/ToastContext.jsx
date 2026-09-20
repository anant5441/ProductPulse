import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext({ showToast: () => {} });

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-full">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-2.5 p-3 rounded-lg border shadow-sm text-sm transition-all duration-200 animate-in fade-in slide-in-from-bottom-2 ${
              t.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : t.type === 'info'
                ? 'bg-sky-50 border-sky-200 text-sky-800'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}
          >
            {t.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
            ) : t.type === 'info' ? (
              <Info className="w-4 h-4 text-sky-600 mt-0.5 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
            )}
            <span className="flex-1 leading-snug">{t.message}</span>
            <button
              onClick={() => removeToast(t.id)}
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
