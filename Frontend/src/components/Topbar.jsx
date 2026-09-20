import React from 'react';
import { Menu, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Topbar({ title, onOpenMobile, showTrackButton = true }) {
  return (
    <header className="h-14 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobile}
          className="md:hidden p-1.5 -ml-1 text-slate-500 hover:text-slate-800 rounded-md hover:bg-slate-100"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-base sm:text-lg font-semibold text-slate-900 tracking-tight">{title}</h1>
      </div>

      {showTrackButton && (
        <Link
          to="/products"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#6C3BFF] hover:bg-[#5829e6] text-white text-xs sm:text-sm font-medium rounded-md shadow-xs transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Track product</span>
        </Link>
      )}
    </header>
  );
}
