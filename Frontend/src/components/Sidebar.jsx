import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Activity, LayoutDashboard, Search, ExternalLink } from 'lucide-react';
import { healthApi } from '../api/client';

export default function Sidebar({ onCloseMobile }) {
  const [isOnline, setIsOnline] = useState(null);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      try {
        await healthApi.check();
        if (mounted) setIsOnline(true);
      } catch {
        if (mounted) setIsOnline(false);
      }
    };
    check();
    const interval = setInterval(check, 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/products', label: 'Product Catalog', icon: Search },
  ];

  return (
    <aside className="w-60 bg-white border-r border-slate-200 h-screen flex flex-col shrink-0 select-none">
      {/* Brand Header */}
      <div className="h-14 px-5 border-b border-slate-200 flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-md bg-[#6C3BFF] text-white flex items-center justify-center shadow-xs">
          <Activity className="w-4 h-4" />
        </div>
        <div>
          <span className="font-semibold text-sm tracking-tight text-slate-900 block">ProductPulse</span>
          <span className="text-[10px] text-slate-400 block -mt-0.5">Price & Stock Monitor</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="p-3 space-y-1 flex-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onCloseMobile}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[#6C3BFF]/10 text-[#6C3BFF]'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Store Link & API Status Footer */}
      <div className="p-4 border-t border-slate-200 space-y-3 bg-slate-50/50">
        <a
          href="https://demo.inelabteamdev.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between text-xs text-slate-500 hover:text-slate-800 transition-colors"
        >
          <span>INE Mock Storefront</span>
          <ExternalLink className="w-3 h-3" />
        </a>

        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                isOnline === true
                  ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]'
                  : isOnline === false
                  ? 'bg-rose-500'
                  : 'bg-slate-400 animate-pulse'
              }`}
            />
            <span className="text-slate-600 font-medium">
              {isOnline === true ? 'API Connected' : isOnline === false ? 'API Offline' : 'Connecting...'}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">v1.0.0</span>
        </div>
      </div>
    </aside>
  );
}
