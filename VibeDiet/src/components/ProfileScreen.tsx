import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext.js';
import { useDiet } from '../context/DietContext.js';
import { SupportTicket } from '../types/index.js';
import { isSupabaseConfigured } from '../services/supabaseClient.js';
import { AuthModal } from './AuthModal.js';

export const ProfileScreen: React.FC = () => {
  const { user, token, activatePro } = useAuth();
  const {
    biometrics,
    updateBiometrics,
    currentDay,
    repeatMeals,
    weightLogs,
    submitSupportTicket,
    supportTickets,
    eraseAllUserData,
  } = useDiet();

  // Modal & Auth State
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const isCloudActive = isSupabaseConfigured();

  // Interactive Calorie & Macro Goal Editor State
  const [goalCalories, setGoalCalories] = useState<number>(biometrics.targetCalories || 2245);
  const [goalProtein, setGoalProtein] = useState<number>(biometrics.targetProtein || 168);
  const [goalCarbs, setGoalCarbs] = useState<number>(biometrics.targetCarbs || 220);
  const [goalFat, setGoalFat] = useState<number>(biometrics.targetFat || 65);
  const [goalSavedMessage, setGoalSavedMessage] = useState<string | null>(null);

  // Purge Confirmation State
  const [isPurging, setIsPurging] = useState(false);
  const [purgeSuccess, setPurgeSuccess] = useState(false);
  const [csvToast, setCsvToast] = useState<string | null>(null);

  // Support State
  const [category, setCategory] = useState<SupportTicket['category']>('nutrition_fix');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  // Billing State
  const [billingPlan, setBillingPlan] = useState<'monthly' | 'annual'>('annual');
  const [billingStatus, setBillingStatus] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<any>(null);

  // Save Biometric Goals
  const handleSaveGoals = (e: React.FormEvent) => {
    e.preventDefault();
    updateBiometrics({
      targetCalories: Number(goalCalories),
      targetProtein: Number(goalProtein),
      targetCarbs: Number(goalCarbs),
      targetFat: Number(goalFat),
    });
    setGoalSavedMessage('✓ Daily target macros updated successfully!');
    window.setTimeout(() => setGoalSavedMessage(null), 3500);
  };

  // Quick Macro Presets
  const applyMacroPreset = (preset: 'high_protein' | 'balanced' | 'low_carb') => {
    const cals = goalCalories || 2200;
    if (preset === 'high_protein') {
      const p = Math.round((cals * 0.40) / 4);
      const c = Math.round((cals * 0.35) / 4);
      const f = Math.round((cals * 0.25) / 9);
      setGoalProtein(p);
      setGoalCarbs(c);
      setGoalFat(f);
    } else if (preset === 'balanced') {
      const p = Math.round((cals * 0.30) / 4);
      const c = Math.round((cals * 0.45) / 4);
      const f = Math.round((cals * 0.25) / 9);
      setGoalProtein(p);
      setGoalCarbs(c);
      setGoalFat(f);
    } else if (preset === 'low_carb') {
      const p = Math.round((cals * 0.35) / 4);
      const c = Math.round((cals * 0.20) / 4);
      const f = Math.round((cals * 0.45) / 9);
      setGoalProtein(p);
      setGoalCarbs(c);
      setGoalFat(f);
    }
  };

  // 1-Click JSON Export (GDPR / DPDP Compliance)
  const handleExportJson = async () => {
    try {
      let exportData: any = null;
      try {
        const res = await fetch('/v1/user/export', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const json = await res.json();
          exportData = json.data;
        }
      } catch {}

      if (!exportData) {
        exportData = {
          exportTimestamp: new Date().toISOString(),
          user,
          biometrics,
          currentDay,
          repeatMeals,
          weightLogs,
          supportTickets,
        };
      }

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vibediet-user-export-${user.uid}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Export failed: ${err?.message || err}`);
    }
  };

  // 1-Click CSV Export
  const handleExportCsv = () => {
    try {
      const headers = [
        'Date',
        'Meal Slot',
        'Meal Title',
        'Food Item',
        'Grams',
        'Calories (kcal)',
        'Protein (g)',
        'Carbs (g)',
        'Fat (g)',
        'Fiber (g)',
        'Sugar (g)',
        'Sodium (mg)',
        'Evidence Tier',
      ];

      const rows: string[] = [headers.join(',')];
      const sanitize = (val: any) => `"${String(val ?? '').replace(/"/g, '""')}"`;
      const allMeals = [...(currentDay?.meals || []), ...repeatMeals];

      allMeals.forEach((meal) => {
        const date = meal.date || currentDay.date;
        const mealSlot = meal.slot || 'lunch';
        const title = meal.title || 'Logged Meal';

        if (meal.items && meal.items.length > 0) {
          meal.items.forEach((item) => {
            rows.push(
              [
                sanitize(date),
                sanitize(mealSlot),
                sanitize(title),
                sanitize(item.name),
                item.grams || 0,
                item.calories || 0,
                item.protein || 0,
                item.carbs || 0,
                item.fat || 0,
                item.fiber || 0,
                item.sugar || 0,
                item.sodium || 0,
                sanitize(`Tier ${item.tier || 1}`),
              ].join(',')
            );
          });
        }
      });

      const csvContent = rows.join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const filename = `vibediet-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setCsvToast(`✓ CSV Ledger downloaded (${filename})`);
      window.setTimeout(() => setCsvToast(null), 4000);
    } catch (err: any) {
      alert(`CSV Export failed: ${err?.message || err}`);
    }
  };

  // Account Data Purge Execution
  const handleConfirmPurge = () => {
    eraseAllUserData();
    setIsPurging(false);
    setPurgeSuccess(true);
    window.setTimeout(() => setPurgeSuccess(false), 4000);
  };

  const handleSupportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;
    const t = submitSupportTicket(category, subject.trim(), message.trim());
    setSubmittedId(t.id);
    setSubject('');
    setMessage('');
  };

  const handleCheckout = async (gateway: 'razorpay' | 'stripe') => {
    try {
      const res = await fetch('/v1/billing/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan: billingPlan, gateway }),
      });
      if (res.ok) {
        const data = await res.json();
        setActiveSession(data.session);
        setBillingStatus(`Checkout session created with ${data.session.gateway}`);
      }
    } catch (err: any) {
      setBillingStatus(`Checkout error: ${err?.message || err}`);
    }
  };

  const handleSimulateWebhook = async () => {
    activatePro();
    try {
      const res = await fetch('/v1/billing/simulate-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan: billingPlan, gateway: 'razorpay' }),
      });
      if (res.ok) {
        const data = await res.json();
        setBillingStatus(`✓ Pro Activated! HMAC-SHA256 signature verified (${data.transactionId})`);
      }
    } catch (err: any) {
      setBillingStatus(`Simulation error: ${err?.message || err}`);
    }
  };

  return (
    <div className="vibediet-canvas space-y-6 pb-20 select-none max-w-5xl mx-auto" data-testid="profile-screen">
      {/* 1. User Identity & Session Glass Card */}
      <div className="apple-card p-5 sm:p-6 space-y-4 bg-white dark:bg-[#121622]/90 border border-slate-900/[0.06] dark:border-white/[0.08]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#0EA5E9]/15 via-[#FF6B2C]/15 to-slate-100 dark:to-white/10 border border-slate-200 dark:border-white/10 flex items-center justify-center text-xl font-bold text-[#0F172A] dark:text-white shadow-inner">
              {user.isGuest ? '🕶️' : '👤'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[#0F172A] dark:text-white tracking-tight">
                  {user.isGuest ? 'Local Sandbox Account' : user.displayName}
                </h2>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                    user.isPro
                      ? 'bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30'
                      : 'apple-subcard bg-slate-100 dark:bg-white/[0.04] text-slate-500 dark:text-zinc-400'
                  }`}
                >
                  {user.isPro ? '★ PRO MEMBER' : 'FREE TIER'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 font-mono">{user.email}</p>
              <p className="text-[11px] text-[#0EA5E9] font-mono">UID: {user.uid}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {isCloudActive ? (
              <span
                data-testid="sync-badge-cloud"
                className="px-3 py-1 rounded-full text-[11px] font-mono font-bold bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30 flex items-center gap-1.5"
              >
                <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                Supabase Cloud Sync
              </span>
            ) : (
              <span
                data-testid="sync-badge-local"
                className="px-3 py-1 rounded-full text-[11px] font-mono font-bold bg-[#0EA5E9]/15 text-[#0EA5E9] border border-[#0EA5E9]/30 flex items-center gap-1.5"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#0EA5E9]" />
                Local Encrypted Mode
              </span>
            )}

            <button
              type="button"
              onClick={() => setIsAuthModalOpen(true)}
              data-testid="open-auth-modal-btn"
              className="px-3.5 py-1.5 rounded-xl apple-subcard bg-slate-100 hover:bg-slate-200/80 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-xs font-semibold text-slate-700 dark:text-zinc-200 transition cursor-pointer border border-slate-200 dark:border-white/10"
            >
              🔐 Manage Auth ID
            </button>
          </div>
        </div>
      </div>

      {/* 2-Column Bento Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left Column: Macro Goals Configurator */}
        <div className="apple-card p-5 space-y-4 bg-white dark:bg-[#121622]/90 border border-slate-900/[0.06] dark:border-white/[0.08]" data-testid="macro-goals-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-900/[0.06] dark:border-white/[0.06] pb-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-300 flex items-center gap-1.5">
                <span>🎯</span> Macro Target Configurator
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                Calibrated against Mifflin-St Jeor BMR &amp; EWMA TDEE
              </p>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => applyMacroPreset('high_protein')}
                className="text-[10px] font-semibold px-2 py-0.5 rounded-md apple-subcard bg-slate-50 hover:bg-slate-100 dark:bg-white/[0.04] text-[#0EA5E9] border border-slate-200 dark:border-white/10 cursor-pointer"
              >
                High Protein
              </button>
              <button
                type="button"
                onClick={() => applyMacroPreset('balanced')}
                className="text-[10px] font-semibold px-2 py-0.5 rounded-md apple-subcard bg-slate-50 hover:bg-slate-100 dark:bg-white/[0.04] text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-white/10 cursor-pointer"
              >
                Balanced
              </button>
              <button
                type="button"
                onClick={() => applyMacroPreset('low_carb')}
                className="text-[10px] font-semibold px-2 py-0.5 rounded-md apple-subcard bg-slate-50 hover:bg-slate-100 dark:bg-white/[0.04] text-[#FF6B2C] border border-slate-200 dark:border-white/10 cursor-pointer"
              >
                Low Carb
              </button>
            </div>
          </div>

          <form onSubmit={handleSaveGoals} className="space-y-3.5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div>
                <label className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium">Calories</label>
                <div className="mt-1 relative">
                  <input
                    type="number"
                    step="25"
                    min="1200"
                    max="5000"
                    value={goalCalories}
                    onChange={(e) => setGoalCalories(Number(e.target.value))}
                    data-testid="goal-calories-input"
                    className="w-full apple-subcard bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] px-2.5 py-1.5 text-xs font-mono font-bold text-[#0F172A] dark:text-white focus:outline-none focus:border-[#FF6B2C]"
                  />
                  <span className="absolute right-2 top-1.5 text-[10px] text-slate-400 dark:text-zinc-500 font-mono">kcal</span>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-[#0EA5E9] font-medium">Protein</label>
                <div className="mt-1 relative">
                  <input
                    type="number"
                    step="5"
                    min="40"
                    max="350"
                    value={goalProtein}
                    onChange={(e) => setGoalProtein(Number(e.target.value))}
                    data-testid="goal-protein-input"
                    className="w-full apple-subcard bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] px-2.5 py-1.5 text-xs font-mono font-bold text-[#0EA5E9] focus:outline-none focus:border-[#0EA5E9]"
                  />
                  <span className="absolute right-2 top-1.5 text-[10px] text-slate-400 dark:text-zinc-500 font-mono">g</span>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-[#FF6B2C] font-medium">Carbs</label>
                <div className="mt-1 relative">
                  <input
                    type="number"
                    step="5"
                    min="20"
                    max="600"
                    value={goalCarbs}
                    onChange={(e) => setGoalCarbs(Number(e.target.value))}
                    data-testid="goal-carbs-input"
                    className="w-full apple-subcard bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] px-2.5 py-1.5 text-xs font-mono font-bold text-[#FF6B2C] focus:outline-none focus:border-[#FF6B2C]"
                  />
                  <span className="absolute right-2 top-1.5 text-[10px] text-slate-400 dark:text-zinc-500 font-mono">g</span>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-[#F43F5E] font-medium">Fat</label>
                <div className="mt-1 relative">
                  <input
                    type="number"
                    step="5"
                    min="20"
                    max="200"
                    value={goalFat}
                    onChange={(e) => setGoalFat(Number(e.target.value))}
                    data-testid="goal-fat-input"
                    className="w-full apple-subcard bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] px-2.5 py-1.5 text-xs font-mono font-bold text-[#F43F5E] focus:outline-none focus:border-[#F43F5E]"
                  />
                  <span className="absolute right-2 top-1.5 text-[10px] text-slate-400 dark:text-zinc-500 font-mono">g</span>
                </div>
              </div>
            </div>

            {goalSavedMessage && (
              <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-[#10B981] text-xs font-mono font-medium">
                {goalSavedMessage}
              </div>
            )}

            <div className="flex justify-end pt-1">
              <motion.button
                type="submit"
                whileTap={{ scale: 0.96 }}
                data-testid="save-goals-btn"
                className="px-4 py-1.5 rounded-xl text-white font-bold text-xs transition shadow-xs cursor-pointer hover:brightness-105"
                style={{
                  background: 'linear-gradient(135deg, #0EA5E9, #38BDF8)',
                }}
              >
                Save Targets
              </motion.button>
            </div>
          </form>

          {/* Commercial Pro Subscription & Billing (Preserved for E2E Journeys) */}
          <div className="pt-3 border-t border-slate-900/[0.06] dark:border-white/[0.06] space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-[#0F172A] dark:text-white flex items-center gap-1.5">
                <span>💳</span> Subscription &amp; Billing
              </h4>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  user.isPro
                    ? 'bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40'
                    : 'apple-subcard bg-slate-100 dark:bg-white/[0.04] text-slate-500 dark:text-zinc-400'
                }`}
              >
                {user.isPro ? '✓ Pro Active' : 'Free Tier'}
              </span>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleCheckout('razorpay')}
                data-testid="upgrade-razorpay-btn"
                className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition cursor-pointer shadow-xs"
              >
                Razorpay UPI (INR)
              </button>
              <button
                type="button"
                onClick={() => handleCheckout('stripe')}
                data-testid="upgrade-stripe-btn"
                className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition cursor-pointer shadow-xs"
              >
                Stripe Global (USD)
              </button>
            </div>

            <button
              type="button"
              onClick={handleSimulateWebhook}
              data-testid="simulate-webhook-btn"
              className="w-full py-1.5 rounded-xl apple-subcard bg-slate-50 hover:bg-slate-100 dark:bg-white/[0.04] border border-[#10B981]/30 text-[#10B981] font-mono text-[11px] font-semibold transition cursor-pointer"
            >
              ⚡ Instant Pro Demo Activation
            </button>

            {billingStatus && (
              <div className="text-[11px] text-[#10B981] apple-subcard bg-emerald-50 dark:bg-emerald-950/20 p-2.5 border border-[#10B981]/30 rounded-xl font-mono">
                {billingStatus}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: 1-Click Export, Data Portability & Support Desk */}
        <div className="apple-card p-5 space-y-4 bg-white dark:bg-[#121622]/90 border border-slate-900/[0.06] dark:border-white/[0.08]" data-testid="data-portability-card">
          <div className="border-b border-slate-900/[0.06] dark:border-white/[0.06] pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-300 flex items-center gap-1.5">
              <span>📦</span> Data Portability &amp; Ephemeral Erasure (GDPR / DPDP)
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
              Full data ownership: download structured archives or trigger permanent deletion
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handleExportJson}
              data-testid="export-user-json-btn"
              className="p-3.5 rounded-2xl apple-subcard bg-slate-50 hover:bg-slate-100 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] border border-slate-200 dark:border-white/10 text-left transition cursor-pointer flex items-center justify-between"
            >
              <div>
                <p className="text-xs font-bold text-[#0F172A] dark:text-white flex items-center gap-1.5">
                  <span>📄</span> Export JSON Bundle
                </p>
                <p className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5">Meals, drafts &amp; weight logs</p>
              </div>
              <span className="text-xs font-mono text-[#0EA5E9] font-bold">.JSON</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              data-testid="export-user-csv-btn"
              className="p-3.5 rounded-2xl apple-subcard bg-slate-50 hover:bg-slate-100 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] border border-slate-200 dark:border-white/10 text-left transition cursor-pointer flex items-center justify-between"
            >
              <div>
                <p className="text-xs font-bold text-[#0F172A] dark:text-white flex items-center gap-1.5">
                  <span>📊</span> Export CSV Ledger
                </p>
                <p className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5">Spreadsheet-ready RFC-4180</p>
              </div>
              <span className="text-xs font-mono text-[#FF6B2C] font-bold">.CSV</span>
            </button>
          </div>

          {csvToast && (
            <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-[#10B981] text-xs font-mono font-medium">
              {csvToast}
            </div>
          )}

          {/* Danger Zone: Permanent Account Purge */}
          <div className="pt-2 border-t border-slate-900/[0.06] dark:border-white/[0.06]">
            {!isPurging ? (
              <button
                type="button"
                onClick={() => setIsPurging(true)}
                data-testid="erase-user-data-btn"
                className="w-full py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-[#F43F5E] border border-rose-500/25 text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-2"
              >
                <span>🗑️</span>
                <span>Delete Account &amp; Local Data</span>
              </button>
            ) : (
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 space-y-2.5" data-testid="purge-confirm-box">
                <p className="text-xs font-bold text-[#F43F5E]">
                  ⚠️ Irreversible: This permanently wipes all meals, drafts, weights, and calibrations.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleConfirmPurge}
                    data-testid="confirm-purge-btn"
                    className="flex-1 py-1.5 rounded-xl bg-[#F43F5E] hover:bg-rose-600 text-white font-bold text-xs transition cursor-pointer"
                  >
                    Confirm Permanent Erasure
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPurging(false)}
                    className="px-3.5 py-1.5 rounded-xl apple-subcard bg-white dark:bg-white/[0.06] text-slate-700 dark:text-zinc-300 text-xs font-semibold cursor-pointer border border-slate-200 dark:border-white/10"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {purgeSuccess && (
              <div className="mt-2 p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-[#10B981] text-xs font-mono font-medium">
                ✓ Full account memory purged &amp; zero-filled.
              </div>
            )}
          </div>

          {/* Support Ticket Submission */}
          <form onSubmit={handleSupportSubmit} className="pt-3 border-t border-slate-900/[0.06] dark:border-white/[0.06] space-y-2.5">
            <h4 className="text-xs font-bold text-[#0F172A] dark:text-white flex items-center gap-1.5">
              <span>🛟</span> Support Desk
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as SupportTicket['category'])}
                className="apple-subcard bg-slate-50 dark:bg-white/[0.04] px-2.5 py-1.5 text-xs text-[#0F172A] dark:text-white border border-slate-200 dark:border-white/10 rounded-xl"
              >
                <option value="nutrition_fix" className="bg-white dark:bg-[#121622] text-[#0F172A] dark:text-white">Nutrition / Tier Override</option>
                <option value="bug" className="bg-white dark:bg-[#121622] text-[#0F172A] dark:text-white">Bug Report</option>
                <option value="account" className="bg-white dark:bg-[#121622] text-[#0F172A] dark:text-white">Account &amp; Privacy</option>
                <option value="feedback" className="bg-white dark:bg-[#121622] text-[#0F172A] dark:text-white">Product Feedback</option>
              </select>
              <input
                type="text"
                placeholder="Subject summary..."
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                data-testid="support-subject-input"
                className="apple-subcard bg-slate-50 dark:bg-white/[0.04] px-2.5 py-1.5 text-xs text-[#0F172A] dark:text-white border border-slate-200 dark:border-white/10 rounded-xl focus:outline-none focus:border-[#0EA5E9]"
              />
            </div>
            <textarea
              rows={2}
              placeholder="Provide details..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              data-testid="support-message-input"
              className="w-full apple-subcard bg-slate-50 dark:bg-white/[0.04] px-2.5 py-1.5 text-xs text-[#0F172A] dark:text-white border border-slate-200 dark:border-white/10 rounded-xl resize-none focus:outline-none focus:border-[#0EA5E9]"
            />
            {submittedId && (
              <div className="text-[11px] text-[#10B981] font-mono font-medium">
                ✓ Ticket <strong>{submittedId}</strong> submitted to admin cockpit!
              </div>
            )}
            <button
              type="submit"
              data-testid="submit-support-btn"
              className="w-full py-2 rounded-xl apple-subcard bg-slate-50 hover:bg-slate-100 dark:bg-white/[0.04] border border-[#0EA5E9]/30 text-[#0EA5E9] font-bold text-xs transition cursor-pointer"
            >
              Submit Support Ticket
            </button>
          </form>
        </div>
      </div>

      {/* Auth Modal Mount */}
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </div>
  );
};
