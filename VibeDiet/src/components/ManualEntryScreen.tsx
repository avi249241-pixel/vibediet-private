import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext.js';
import { useDiet } from '../context/DietContext.js';
import { VERIFIED_USDA_FOODS } from '../data/mockData.js';
import { LOCAL_VERIFIED_CATALOG } from '../services/foodCatalogService.js';
import { reconcileAtwaterMacros } from '../utils/atwater.js';
import { FoodItemEntry, MealSlot } from '../types/index.js';
import { renderTierBadge } from './DailyDiaryScreen.js';
import { BarcodeScannerModal } from './BarcodeScannerModal.js';

interface ManualEntryScreenProps {
  onAdded: () => void;
  initialSlot?: MealSlot;
}

function getDefaultMealSlot(): MealSlot {
  const hour = new Date().getHours();
  const minute = new Date().getMinutes();
  const time = hour + minute / 60;
  if (time >= 5 && time < 11.5) return 'breakfast';
  if (time >= 11.5 && time < 16) return 'lunch';
  if (time >= 16 && time < 18.5) return 'snack';
  return 'dinner';
}

const ALL_LOCAL_FOODS: FoodItemEntry[] = [
  ...VERIFIED_USDA_FOODS,
  ...LOCAL_VERIFIED_CATALOG,
];

export const ManualEntryScreen: React.FC<ManualEntryScreenProps> = ({
  onAdded,
  initialSlot,
}) => {
  const { token } = useAuth();
  const { addManualMeal } = useDiet();
  const [slot, setSlot] = useState<MealSlot>(() => initialSlot || getDefaultMealSlot());
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FoodItemEntry[]>(ALL_LOCAL_FOODS);
  const [isSearching, setIsSearching] = useState(false);
  const [isBarcodeOpen, setIsBarcodeOpen] = useState(false);

  // Debounced instant search (Local Verified IFCT/USDA + Live backend proxy)
  useEffect(() => {
    let active = true;
    const query = searchQuery.trim().toLowerCase();

    // Instant local filter first
    const instantMatches = ALL_LOCAL_FOODS.filter(
      (f) =>
        !query ||
        f.name.toLowerCase().includes(query) ||
        (f.tierSource && f.tierSource.toLowerCase().includes(query))
    );
    setSearchResults(instantMatches);

    if (!query) {
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/v1/foods/search?q=${encodeURIComponent(searchQuery)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (active && Array.isArray(data.results) && data.results.length > 0) {
            setSearchResults(data.results);
            setIsSearching(false);
            return;
          }
        }
      } catch {
        // Fallback to local verified catalog
      }
      if (active) {
        setIsSearching(false);
      }
    }, 150);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchQuery, token]);

  const handleBarcodeDetected = (food: FoodItemEntry) => {
    addManualMeal(slot, food.name, [food]);
    setIsBarcodeOpen(false);
    onAdded();
  };

  // Custom Item Form State with Live Atwater Verification
  const [customName, setCustomName] = useState('Homemade Masala Oats Bowl');
  const [grams, setGrams] = useState(220);
  const [reportedCalories, setReportedCalories] = useState(210);
  const [protein, setProtein] = useState(9);
  const [carbs, setCarbs] = useState(34);
  const [fiber, setFiber] = useState(5);
  const [fat, setFat] = useState(6);

  const liveRecon = reconcileAtwaterMacros({
    reportedCalories,
    protein,
    carbs,
    fat,
    fiber,
    tier: 4,
  });

  const handleLogCustom = (e: React.FormEvent) => {
    e.preventDefault();
    addManualMeal(slot, customName, [
      {
        name: customName,
        grams,
        tier: 4,
        reportedCalories,
        protein,
        carbs,
        fat,
        fiber,
        sugar: 2,
        sodium: 310,
      },
    ]);
    onAdded();
  };

  return (
    <div className="vibediet-canvas space-y-6 pb-20 select-none max-w-5xl mx-auto" data-testid="manual-entry-screen">
      {/* Top Header Card */}
      <div className="apple-card p-5 flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-[#121622]/90 border border-slate-900/[0.06] dark:border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-[#0F172A] dark:text-white tracking-tight">
              🔍 Verified Food Search &amp; Barcode Engine
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
              Tier 1 &amp; Tier 2
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Instant search across USDA FoodData Central, ICMR-NIN IFCT 2017 &amp; Open Food Facts
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Target Meal Slot Dropdown */}
          <div className="flex items-center gap-1.5 apple-subcard bg-slate-50 dark:bg-white/[0.04] px-3 py-1.5 border border-slate-900/[0.06] dark:border-white/[0.06]">
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Meal:</span>
            <select
              value={slot}
              onChange={(e) => setSlot(e.target.value as MealSlot)}
              className="bg-transparent text-xs font-semibold text-[#0F172A] dark:text-white focus:outline-none cursor-pointer"
            >
              <option value="breakfast" className="bg-white dark:bg-[#121622] text-[#0F172A] dark:text-white">Breakfast</option>
              <option value="lunch" className="bg-white dark:bg-[#121622] text-[#0F172A] dark:text-white">Lunch</option>
              <option value="dinner" className="bg-white dark:bg-[#121622] text-[#0F172A] dark:text-white">Dinner</option>
              <option value="snack" className="bg-white dark:bg-[#121622] text-[#0F172A] dark:text-white">Snack</option>
            </select>
          </div>

          {/* Barcode Scanner Modal Trigger */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsBarcodeOpen(true)}
            data-testid="open-barcode-scanner-btn"
            className="px-3.5 py-1.5 rounded-xl bg-[#FF6B2C]/15 hover:bg-[#FF6B2C]/25 text-[#FF6B2C] border border-[#FF6B2C]/30 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <span>🏷️</span>
            <span>Scan Barcode</span>
          </motion.button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left Column: Instant Search & Results */}
        <div className="apple-card p-5 space-y-4 bg-white dark:bg-[#121622]/90 border border-slate-900/[0.06] dark:border-white/[0.08]">
          <div className="flex items-center justify-between border-b border-slate-900/[0.06] dark:border-white/[0.06] pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-300 flex items-center gap-1.5">
              <span>🌾</span> Verified Food Catalog
            </h3>
            {isSearching && (
              <span className="text-xs text-[#0EA5E9] font-mono animate-pulse">Searching...</span>
            )}
          </div>

          {/* Search Input Bar */}
          <div className="relative flex items-center">
            <span className="absolute left-3.5 text-slate-400 dark:text-zinc-500 pointer-events-none">
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="8.5" cy="8.5" r="5.5" />
                <path d="M13 13l4 4" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Search staples (e.g. Avocado, Paneer, Basmati, Dal, Greek Yogurt)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full apple-subcard bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] pl-10 pr-9 py-2.5 text-xs text-[#0F172A] dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-[#0EA5E9] transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 text-slate-400 hover:text-slate-800 dark:hover:text-white p-1"
                aria-label="Clear search"
              >
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            )}
          </div>

          {/* Search Results List */}
          <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
            {searchResults.map((item) => (
              <div
                key={item.id}
                className="apple-subcard bg-slate-50/80 dark:bg-white/[0.04] border border-slate-900/[0.05] dark:border-white/[0.06] p-3 flex flex-wrap items-center justify-between gap-2 hover:border-slate-300 dark:hover:border-white/20 transition"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#0F172A] dark:text-white">{item.name}</span>
                    {renderTierBadge(item.tier)}
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500 dark:text-zinc-400 tabular-nums">
                    <span className="text-[#0F172A] dark:text-white font-semibold">{item.calories} kcal</span>
                    <span>·</span>
                    <span className="text-[#0EA5E9]">P:{item.protein}g</span>
                    <span className="text-[#FF6B2C]">C:{item.carbs}g</span>
                    <span className="text-[#F43F5E]">F:{item.fat}g</span>
                    <span className="text-slate-400 dark:text-zinc-500">({item.grams}g)</span>
                  </div>
                </div>

                <motion.button
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    addManualMeal(slot, item.name, [item]);
                    onAdded();
                  }}
                  className="px-3 py-1.5 rounded-xl bg-[#0EA5E9]/15 hover:bg-[#0EA5E9]/25 text-[#0EA5E9] border border-[#0EA5E9]/30 text-xs font-bold transition cursor-pointer shadow-xs flex items-center gap-1.5"
                >
                  <span>+ Log to {slot.toUpperCase()}</span>
                </motion.button>
              </div>
            ))}

            {searchResults.length === 0 && !isSearching && (
              <div className="text-xs text-slate-500 dark:text-zinc-400 text-center py-6 apple-subcard bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] rounded-xl px-4">
                No foods match &quot;{searchQuery}&quot; — use Custom Atwater Verifier on the right.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Custom Food Entry with Live Atwater Verification */}
        <form onSubmit={handleLogCustom} className="apple-card p-5 space-y-4 bg-white dark:bg-[#121622]/90 border border-slate-900/[0.06] dark:border-white/[0.08]">
          <div className="flex items-center justify-between border-b border-slate-900/[0.06] dark:border-white/[0.06] pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-300 flex items-center gap-1.5">
              <span>🔬</span> Custom Atwater 4-4-9-7 Verifier
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-zinc-400 border border-slate-200 dark:border-white/10">
              Tier 4 Estimate
            </span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium">Food / Meal Title</label>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="w-full mt-1 apple-subcard bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] px-3 py-2 text-xs text-[#0F172A] dark:text-white focus:outline-none focus:border-[#0EA5E9]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium">Portion Weight (g)</label>
                <input
                  type="number"
                  min="1"
                  value={grams}
                  onChange={(e) => setGrams(Number(e.target.value))}
                  className="w-full mt-1 apple-subcard bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] px-3 py-2 text-xs text-[#0F172A] dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium">Reported Calories (kcal)</label>
                <input
                  type="number"
                  min="0"
                  value={reportedCalories}
                  onChange={(e) => setReportedCalories(Number(e.target.value))}
                  className="w-full mt-1 apple-subcard bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] px-3 py-2 text-xs text-[#0F172A] dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] text-[#0EA5E9] font-medium">Protein (g × 4)</label>
                <input
                  type="number"
                  min="0"
                  value={protein}
                  onChange={(e) => setProtein(Number(e.target.value))}
                  className="w-full mt-1 apple-subcard bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] px-3 py-2 text-xs text-[#0F172A] dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] text-[#FF6B2C] font-medium">Total Carbs (g × 4)</label>
                <input
                  type="number"
                  min="0"
                  value={carbs}
                  onChange={(e) => setCarbs(Number(e.target.value))}
                  className="w-full mt-1 apple-subcard bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] px-3 py-2 text-xs text-[#0F172A] dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] text-[#10B981] font-medium">Dietary Fiber (g)</label>
                <input
                  type="number"
                  min="0"
                  value={fiber}
                  onChange={(e) => setFiber(Number(e.target.value))}
                  className="w-full mt-1 apple-subcard bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] px-3 py-2 text-xs text-[#0F172A] dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] text-[#F43F5E] font-medium">Dietary Fat (g × 9)</label>
                <input
                  type="number"
                  min="0"
                  value={fat}
                  onChange={(e) => setFat(Number(e.target.value))}
                  className="w-full mt-1 apple-subcard bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] px-3 py-2 text-xs text-[#0F172A] dark:text-white font-mono"
                />
              </div>
            </div>
          </div>

          {/* Live Atwater Discrepancy Diagnostics */}
          <div className="apple-subcard bg-slate-50 dark:bg-white/[0.04] p-3.5 space-y-1.5 text-xs font-mono border border-slate-900/[0.05] dark:border-white/[0.06]">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-zinc-400">Atwater Ground-Truth:</span>
              <span className="font-bold text-[#10B981] tabular-nums">
                {liveRecon.calculatedCalories} kcal (Net Carbs: {liveRecon.netCarbs}g)
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-zinc-400">Discrepancy vs Label:</span>
              <span
                className={`tabular-nums ${
                  liveRecon.hasDiscrepancy ? 'text-[#F43F5E] font-bold' : 'text-slate-700 dark:text-zinc-300'
                }`}
              >
                {(liveRecon.discrepancyRatio * 100).toFixed(1)}%{' '}
                {liveRecon.hasDiscrepancy ? '(Using Atwater Invariant)' : '(Within ±10% bound)'}
              </span>
            </div>
          </div>

          <motion.button
            type="submit"
            whileTap={{ scale: 0.96 }}
            className="w-full py-2.5 rounded-xl text-white font-extrabold text-xs shadow-sm transition cursor-pointer hover:brightness-105"
            style={{
              background: 'linear-gradient(135deg, #FF6B2C, #FF9248)',
            }}
          >
            + Commit Reconciled Food ({liveRecon.reconciledCalories} kcal)
          </motion.button>
        </form>
      </div>

      {/* Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isBarcodeOpen}
        onClose={() => setIsBarcodeOpen(false)}
        onDetected={handleBarcodeDetected}
      />
    </div>
  );
};
