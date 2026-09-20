import React, { useState, useEffect } from 'react';
import { Bell, Mail, TrendingDown, PackageCheck, Clock, Save, ShieldAlert, Check } from 'lucide-react';
import { alertsApi } from '../api/client';
import { useToast } from '../context/ToastContext';

export default function AlertSettings({ trackingId }) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [priceDropEnabled, setPriceDropEnabled] = useState(true);
  const [priceDropThreshold, setPriceDropThreshold] = useState('0');
  const [backInStockEnabled, setBackInStockEnabled] = useState(true);
  const [inAppEnabled, setInAppEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');
  const [cooldownMinutes, setCooldownMinutes] = useState('120');

  useEffect(() => {
    let isMounted = true;
    async function loadPreferences() {
      setLoading(true);
      try {
        const res = await alertsApi.getPreferences(trackingId);
        const prefs = res?.preferences || res || {};
        if (isMounted) {
          setPriceDropEnabled(prefs.price_drop_enabled !== false);
          setPriceDropThreshold(String(prefs.price_drop_threshold ?? 0));
          setBackInStockEnabled(prefs.back_in_stock_enabled !== false);
          setInAppEnabled(prefs.in_app_enabled !== false);
          setEmailEnabled(Boolean(prefs.email_enabled));
          setEmailAddress(prefs.email_address || '');
          setCooldownMinutes(String(prefs.cooldown_minutes ?? 120));
        }
      } catch (err) {
        console.warn('Could not load existing alert preferences, using defaults:', err?.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (trackingId) {
      loadPreferences();
    }
    return () => {
      isMounted = false;
    };
  }, [trackingId]);

  const handleSave = async (e) => {
    e?.preventDefault();

    const thresholdNum = parseFloat(priceDropThreshold) || 0;
    if (thresholdNum < 0) {
      showToast('Minimum price drop cannot be negative.', 'error');
      return;
    }

    const cooldownNum = parseInt(cooldownMinutes, 10) || 0;
    if (cooldownNum < 0) {
      showToast('Cooldown cannot be negative.', 'error');
      return;
    }

    if (emailEnabled) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailAddress || !emailRegex.test(emailAddress.trim())) {
        showToast('Please enter a valid email address for email alerts.', 'error');
        return;
      }
    }

    if (!inAppEnabled && !emailEnabled) {
      showToast('Please enable at least one notification channel (In-app or Email).', 'error');
      return;
    }

    setSaving(true);
    try {
      await alertsApi.updatePreferences(trackingId, {
        priceDropEnabled,
        priceDropThreshold: thresholdNum,
        backInStockEnabled,
        inAppEnabled,
        emailEnabled,
        emailAddress: emailAddress.trim(),
        cooldownMinutes: cooldownNum,
      });
      showToast('Alert preferences saved successfully!', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to save alert preferences.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-xs animate-pulse space-y-4">
        <div className="h-5 bg-slate-200 rounded w-1/4" />
        <div className="h-10 bg-slate-100 rounded" />
        <div className="h-10 bg-slate-100 rounded" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-[#6C3BFF]/10 text-[#6C3BFF] rounded-lg">
            <Bell className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Alert Settings</h3>
            <p className="text-xs text-slate-500">Configure real-time price drop and stock alerts</p>
          </div>
        </div>

        {(priceDropEnabled || backInStockEnabled) && (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Alerts Active
          </span>
        )}
      </div>

      <form onSubmit={handleSave} className="p-5 space-y-6">
        {/* Trigger 1: Price Drop */}
        <div className="space-y-3 pb-5 border-b border-slate-100">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-0.5">
              <label htmlFor="price-drop-toggle" className="text-xs font-semibold text-slate-900 flex items-center gap-1.5 cursor-pointer">
                <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
                <span>Price Drop Alert</span>
              </label>
              <p className="text-xs text-slate-500">
                Trigger an alert when the selling price drops below the previous scraped price.
              </p>
            </div>

            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                id="price-drop-toggle"
                type="checkbox"
                checked={priceDropEnabled}
                onChange={(e) => setPriceDropEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#6C3BFF]"></div>
            </label>
          </div>

          {priceDropEnabled && (
            <div className="mt-3 pl-5 border-l-2 border-[#6C3BFF]/30 space-y-1.5">
              <label htmlFor="price-drop-threshold" className="text-xs font-medium text-slate-700 block">
                Minimum price drop amount (₹)
              </label>
              <div className="flex items-center gap-2 max-w-xs">
                <span className="text-sm font-semibold text-slate-500">₹</span>
                <input
                  id="price-drop-threshold"
                  type="number"
                  min="0"
                  step="1"
                  value={priceDropThreshold}
                  onChange={(e) => setPriceDropThreshold(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#6C3BFF] focus:border-[#6C3BFF]"
                />
              </div>
              <span className="text-[11px] text-slate-400 block">
                {Number(priceDropThreshold) > 0
                  ? `Only alerts if price drops by ₹${Number(priceDropThreshold).toLocaleString('en-IN')} or more.`
                  : 'Any price decrease will trigger an alert.'}
              </span>
            </div>
          )}
        </div>

        {/* Trigger 2: Back in Stock */}
        <div className="space-y-3 pb-5 border-b border-slate-100">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-0.5">
              <label htmlFor="back-in-stock-toggle" className="text-xs font-semibold text-slate-900 flex items-center gap-1.5 cursor-pointer">
                <PackageCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Back-in-Stock Alert</span>
              </label>
              <p className="text-xs text-slate-500">
                Trigger an alert when status transitions from <span className="font-mono text-[11px] text-rose-600">out_of_stock</span> to <span className="font-mono text-[11px] text-emerald-600">in_stock</span>.
              </p>
            </div>

            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                id="back-in-stock-toggle"
                type="checkbox"
                checked={backInStockEnabled}
                onChange={(e) => setBackInStockEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#6C3BFF]"></div>
            </label>
          </div>
        </div>

        {/* Channels */}
        <div className="space-y-3 pb-5 border-b border-slate-100">
          <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
            Notification Channels
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* In-app */}
            <label className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={inAppEnabled}
                onChange={(e) => setInAppEnabled(e.target.checked)}
                className="w-4 h-4 text-[#6C3BFF] border-slate-300 rounded focus:ring-[#6C3BFF]"
              />
              <div className="text-xs">
                <span className="font-medium text-slate-800 block">In-app notifications</span>
                <span className="text-[11px] text-slate-400">Bell dropdown alert in dashboard</span>
              </div>
            </label>

            {/* Email */}
            <label className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={emailEnabled}
                onChange={(e) => setEmailEnabled(e.target.checked)}
                className="w-4 h-4 text-[#6C3BFF] border-slate-300 rounded focus:ring-[#6C3BFF]"
              />
              <div className="text-xs">
                <span className="font-medium text-slate-800 block">SendGrid Email</span>
                <span className="text-[11px] text-slate-400">Direct alert email notification</span>
              </div>
            </label>
          </div>

          {emailEnabled && (
            <div className="pt-2 space-y-1.5 pl-1">
              <label htmlFor="alert-email" className="text-xs font-medium text-slate-700 block">
                Recipient Email Address
              </label>
              <div className="flex items-center gap-2 max-w-md">
                <div className="relative w-full">
                  <Mail className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    id="alert-email"
                    type="email"
                    required={emailEnabled}
                    value={emailAddress}
                    onChange={(e) => setEmailAddress(e.target.value)}
                    placeholder="your-email@example.com"
                    className="w-full pl-9 pr-3 py-1.5 text-xs font-medium border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#6C3BFF] focus:border-[#6C3BFF]"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Cooldown Settings */}
        <div className="space-y-2 pb-2">
          <div className="flex items-center justify-between">
            <label htmlFor="cooldown-minutes" className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>Notification Cooldown Period</span>
            </label>
            <span className="text-xs font-mono text-slate-500">{cooldownMinutes} minutes</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Prevents repeated emails/notifications within this time window for the same alert type.
          </p>
          <div className="flex items-center gap-3 max-w-xs pt-1">
            <input
              id="cooldown-minutes"
              type="number"
              min="0"
              step="10"
              value={cooldownMinutes}
              onChange={(e) => setCooldownMinutes(e.target.value)}
              className="w-32 px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#6C3BFF] focus:border-[#6C3BFF]"
            />
            <span className="text-xs text-slate-500">minutes</span>
          </div>
        </div>

        {/* Action button */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#6C3BFF] hover:bg-[#5829e6] text-white text-xs font-semibold rounded-md shadow-xs transition-colors disabled:opacity-60 cursor-pointer"
          >
            <Save className={`w-3.5 h-3.5 ${saving ? 'animate-spin' : ''}`} />
            <span>{saving ? 'Saving...' : 'Save alert preferences'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
