import React, { useState, useEffect, useRef } from 'react';
import { Bell, ArrowDownRight, PackageCheck, Check, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { notificationsApi } from '../api/client';
import { formatCurrency, formatRelativeTime } from '../utils/format';

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  const fetchNotifications = async () => {
    try {
      const res = await notificationsApi.list({ limit: 15 });
      setNotifications(res?.notifications || []);
      setUnreadCount(res?.unreadCount || 0);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // 30s polling
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleToggle = () => {
    if (!isOpen) {
      fetchNotifications();
    }
    setIsOpen((prev) => !prev);
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.isRead) {
      try {
        await notificationsApi.markAsRead(notif.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch (err) {
        console.error('Failed to mark as read:', err);
      }
    }
    setIsOpen(false);
    if (notif.trackedProductId) {
      navigate(`/tracking/${notif.trackedProductId}`);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={handleToggle}
        className="relative p-2 text-slate-600 hover:text-slate-900 rounded-full hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-[#6C3BFF]/30"
        aria-label="Notifications"
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-rose-500 rounded-full ring-2 ring-white animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-900">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-[11px] font-medium bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-xs font-medium text-[#6C3BFF] hover:text-[#5425e6] hover:underline flex items-center gap-1"
              >
                <Check className="w-3 h-3" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">No alerts yet.</p>
                <p className="text-[11px] text-slate-400 mt-1">Price drop & back-in-stock alerts will appear here.</p>
              </div>
            ) : (
              notifications.map((notif) => {
                const isPriceDrop = notif.alertType === 'price_drop';
                const isBackInStock = notif.alertType === 'back_in_stock';
                const productName = notif.product?.name || notif.title || 'Tracked Product';

                return (
                  <button
                    key={notif.id}
                    type="button"
                    onClick={() => handleNotificationClick(notif)}
                    className={`w-full text-left p-3.5 hover:bg-slate-50 transition-colors flex gap-3 items-start group ${
                      !notif.isRead ? 'bg-indigo-50/30' : ''
                    }`}
                  >
                    {/* Icon Badge */}
                    <div
                      className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5 ${
                        isPriceDrop
                          ? 'bg-rose-100 text-rose-600'
                          : 'bg-emerald-100 text-emerald-600'
                      }`}
                    >
                      {isPriceDrop ? (
                        <ArrowDownRight className="w-4 h-4" />
                      ) : (
                        <PackageCheck className="w-4 h-4" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-1">
                        <span
                          className={`text-xs font-semibold ${
                            isPriceDrop ? 'text-rose-600' : 'text-emerald-700'
                          }`}
                        >
                          {isPriceDrop ? 'Price dropped' : 'Back in stock'}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {formatRelativeTime(notif.createdAt)}
                        </span>
                      </div>

                      <p className="text-xs font-medium text-slate-800 truncate mt-0.5" title={productName}>
                        {productName}
                      </p>

                      {isPriceDrop && notif.previousPrice && notif.currentPrice && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-1 font-mono">
                          <span className="line-through text-slate-400">
                            {formatCurrency(notif.previousPrice)}
                          </span>
                          <span>→</span>
                          <span className="font-semibold text-rose-600">
                            {formatCurrency(notif.currentPrice)}
                          </span>
                        </div>
                      )}

                      {isBackInStock && (
                        <p className="text-[11px] text-emerald-700 mt-1">
                          Now available{notif.currentPrice ? ` at ${formatCurrency(notif.currentPrice)}` : ''}
                        </p>
                      )}
                    </div>

                    {/* Unread indicator */}
                    {!notif.isRead && (
                      <span className="w-2 h-2 rounded-full bg-[#6C3BFF] shrink-0 mt-1.5" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
