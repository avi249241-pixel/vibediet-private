import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useDiet } from '../context/DietContext.js';
import { GoalMode } from '../types/index.js';
import { SmartMacroSolverWidget } from '../services/macroMealSolver.js';
import { WeeklyCheckInModal, AcceptedTargets } from './WeeklyCheckInModal.js';
import { calculateMifflinStJeorBmr, getLocalDateString } from '../utils/atwater.js';

export const MetabolismCoachScreen: React.FC = () => {
  const {
    biometrics,
    updateBiometrics,
    weightLogs,
    logScaleWeight,
    currentDay,
    addManualMeal,
  } = useDiet();

  const [newWeightKg, setNewWeightKg] = useState(String(biometrics.weightKg));
  const [weightDate, setWeightDate] = useState(() => getLocalDateString());
  const [isCheckInOpen, setIsCheckInOpen] = useState(false);
  const [checkInBannerMessage, setCheckInBannerMessage] = useState<string | null>(null);

  const firstLog = weightLogs[0];
  const latestLog = weightLogs[weightLogs.length - 1];
  const firstSmoothed = firstLog?.smoothedWeightKg ?? firstLog?.weightKg ?? 0;
  const latestSmoothed = latestLog?.smoothedWeightKg ?? latestLog?.weightKg ?? 0;
  const smoothedDeltaKg =
    firstLog && latestLog
      ? Number((latestSmoothed - firstSmoothed).toFixed(2))
      : 0;

  // Calculate actual day span between logs
  let daySpan = 14;
  if (firstLog && latestLog && firstLog.date !== latestLog.date) {
    const d1 = new Date(firstLog.date).getTime();
    const d2 = new Date(latestLog.date).getTime();
    const diffDays = Math.round(Math.abs(d2 - d1) / (1000 * 60 * 60 * 24));
    if (diffDays >= 1) {
      daySpan = diffDays;
    }
  }

  // Daily Energy Balance = Delta SmoothedWeight * 7700 kcal/kg / daySpan
  const dailyEnergyBalance = Math.round((smoothedDeltaKg * 7700) / daySpan);
  const intakeCalories = biometrics.targetCalories || biometrics.baselineTdee || 2245;
  const trueExpendedTdee = Math.round(intakeCalories - dailyEnergyBalance);
  const isPlateauDetected =
    (biometrics.goalMode === 'moderate_cut' || biometrics.goalMode === 'aggressive_cut') &&
    daySpan >= 14 &&
    Math.abs(smoothedDeltaKg) < 0.15;

  const handleWeightSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(newWeightKg);
    if (!isNaN(val) && val >= 25 && val <= 350) {
      logScaleWeight(weightDate, val);
    }
  };

  const handleAcceptTargets = (targets: AcceptedTargets) => {
    updateBiometrics({
      targetCalories: targets.calories,
      targetProtein: targets.protein,
      targetCarbs: targets.carbs,
      targetFat: targets.fat,
    });
    setCheckInBannerMessage(
      `✓ Weekly Autopilot targets applied: ${targets.calories} kcal (P: ${targets.protein}g · C: ${targets.carbs}g · F: ${targets.fat}g)`
    );
    window.setTimeout(() => setCheckInBannerMessage(null), 5000);
  };

  const checkInParams = React.useMemo(() => {
    const logs = weightLogs.slice(-7).map((w) => ({
      date: w.date,
      weightKg: w.weightKg,
      smoothedWeightKg: w.smoothedWeightKg,
    }));
    return {
      goal: (biometrics.goalMode as any) || 'fat_loss',
      averageDailyIntakeKcal: intakeCalories,
      weightLogs: logs.length > 0 ? logs : [
        { date: new Date().toISOString().slice(0, 10), weightKg: biometrics.weightKg, smoothedWeightKg: biometrics.weightKg }
      ],
      currentTargets: {
        calories: biometrics.targetCalories,
        protein: biometrics.targetProtein,
        carbs: biometrics.targetCarbs,
        fat: biometrics.targetFat,
      },
      biometrics: {
        gender: biometrics.gender,
        weightKg: biometrics.weightKg,
        heightCm: biometrics.heightCm,
        age: biometrics.age,
        bmr: biometrics.bmr,
      },
      daysLogged: Math.max(1, Math.min(7, logs.length)),
    };
  }, [biometrics, intakeCalories, weightLogs]);

  return (
    <div className="vibediet-canvas space-y-6 pb-20 select-none max-w-5xl mx-auto" data-testid="metabolism-coach-screen">
      {/* 1. Top Metric Bento Trio */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* Card 1: BMR Resting Baseline */}
        <div className="apple-card p-5 space-y-1.5 bg-white dark:bg-[#121622]/90 border border-slate-900/[0.06] dark:border-white/[0.08]">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Mifflin-St Jeor BMR
          </span>
          <div className="text-2xl font-black text-[#0F172A] dark:text-white font-mono tabular-nums">
            {biometrics.bmr || calculateMifflinStJeorBmr(biometrics.gender || 'male', biometrics.weightKg || 76.4, biometrics.heightCm || 175, biometrics.age || 24)}{' '}
            <span className="text-xs font-sans font-normal text-slate-400 dark:text-zinc-500">kcal/d</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-zinc-500 font-mono">
            {biometrics.gender} · {biometrics.weightKg}kg · {biometrics.heightCm}cm
          </p>
        </div>

        {/* Card 2: True Expended Adaptive TDEE */}
        <div className="apple-card p-5 space-y-1.5 bg-white dark:bg-[#121622]/90 border border-slate-900/[0.06] dark:border-white/[0.08]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#0EA5E9]">
              True Expended TDEE
            </span>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#0EA5E9]/15 text-[#0EA5E9] border border-[#0EA5E9]/30">
              α = 0.12 EWMA
            </span>
          </div>
          <div className="text-2xl font-black text-[#0EA5E9] font-mono tabular-nums">
            {trueExpendedTdee}{' '}
            <span className="text-xs font-sans font-normal text-slate-400 dark:text-zinc-500">kcal/d</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-zinc-500 font-mono">
            14-day smoothed Δ ({smoothedDeltaKg >= 0 ? `+${smoothedDeltaKg}` : smoothedDeltaKg} kg)
          </p>
        </div>

        {/* Card 3: Daily Target & Weekly Check-In Trigger */}
        <div className="apple-card p-5 space-y-2 flex flex-col justify-between bg-white dark:bg-[#121622]/90 border border-slate-900/[0.06] dark:border-white/[0.08]">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#FF6B2C]">
                Daily Target
              </span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#FF6B2C]/15 text-[#FF6B2C] border border-[#FF6B2C]/30">
                Floor Guarded
              </span>
            </div>
            <div className="text-2xl font-black text-[#FF6B2C] font-mono tabular-nums mt-1">
              {biometrics.targetCalories}{' '}
              <span className="text-xs font-sans font-normal text-slate-400 dark:text-zinc-500">kcal/d</span>
            </div>
          </div>

          {/* ✨ Weekly Check-In Trigger Button */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={() => setIsCheckInOpen(true)}
            data-testid="open-weekly-check-in-btn"
            className="w-full py-2 px-3 rounded-xl text-white font-extrabold text-xs tracking-wide shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer hover:brightness-105"
            style={{
              background: 'linear-gradient(135deg, #0EA5E9, #38BDF8)',
            }}
          >
            <span>✨</span>
            <span>Weekly Check-In</span>
          </motion.button>
        </div>
      </div>

      {/* Check-In Success Message Banner */}
      {checkInBannerMessage && (
        <div className="apple-card p-3.5 border-[#10B981]/40 bg-[#10B981]/10 text-[#10B981] text-xs font-mono font-semibold flex items-center gap-2">
          <span>{checkInBannerMessage}</span>
        </div>
      )}

      {/* Plateau Guard Alert */}
      {isPlateauDetected && (
        <div className="apple-card p-4 border-[#FF6B2C]/30 bg-[#FF6B2C]/10 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2.5">
          <span className="text-base">🧬</span>
          <div>
            <strong>Metabolic Adaptation / Plateau Guard:</strong> Smoothed weight trend has changed by
            less than 0.15 kg over {daySpan} days. Coach suggests a 2-day{' '}
            <strong>Maintenance Refeed (+350 kcal from complex carbohydrates)</strong> to replenish muscle glycogen,
            support training performance, and improve metabolic adherence.
          </div>
        </div>
      )}

      {/* Smart Macro Solver Widget */}
      <SmartMacroSolverWidget
        remainingKcal={Math.max(0, (biometrics.targetCalories || 2245) - currentDay.totalCalories)}
        remainingProtein={Math.max(0, (biometrics.targetProtein || 168) - currentDay.totalProtein)}
        remainingCarbs={Math.max(0, (biometrics.targetCarbs || 247) - currentDay.totalCarbs)}
        remainingFat={Math.max(0, (biometrics.targetFat || 65) - currentDay.totalFat)}
        targetSlot="dinner"
        onLogCombo={(slot, title, items) => {
          addManualMeal(slot, title, items);
        }}
      />

      {/* 2. Goal Mode Presets */}
      <div className="apple-card p-5 space-y-3 bg-white dark:bg-[#121622]/90 border border-slate-900/[0.06] dark:border-white/[0.08]">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-300 flex items-center gap-2">
          <span>🎯</span> Adaptive Goal Mode Presets
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          {(
            [
              ['aggressive_cut', 'Aggressive Cut (-25%)'],
              ['moderate_cut', 'Moderate Cut (-15%)'],
              ['maintenance', 'Maintenance (0%)'],
              ['lean_bulk', 'Lean Bulk (+10%)'],
            ] as [GoalMode, string][]
          ).map(([mode, label]) => (
            <motion.button
              key={mode}
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={() => updateBiometrics({ goalMode: mode })}
              className={`px-3 py-2.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                biometrics.goalMode === mode
                  ? 'bg-[#0EA5E9] text-white border-[#0EA5E9] font-bold shadow-xs'
                  : 'apple-subcard bg-slate-50 dark:bg-white/[0.04] text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-white/[0.08] hover:border-slate-300'
              }`}
            >
              {label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* 3. EWMA Weight Smoothing Table & Scale Logger */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <form onSubmit={handleWeightSubmit} className="apple-card p-5 space-y-3.5 bg-white dark:bg-[#121622]/90 border border-slate-900/[0.06] dark:border-white/[0.08]">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-300 flex items-center gap-2">
            <span>⚖️</span> Log Scale Weight
          </h3>
          <div>
            <label className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium">Date</label>
            <input
              type="date"
              value={weightDate}
              onChange={(e) => setWeightDate(e.target.value)}
              className="w-full mt-1 apple-subcard bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] px-3 py-2 text-xs text-[#0F172A] dark:text-white focus:outline-none focus:border-[#0EA5E9]"
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium">Morning Scale Weight (kg)</label>
            <input
              type="number"
              step="0.1"
              value={newWeightKg}
              onChange={(e) => setNewWeightKg(e.target.value)}
              data-testid="weight-input-kg"
              className="w-full mt-1 apple-subcard bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] px-3 py-2 text-xs text-[#0F172A] dark:text-white font-mono font-bold focus:outline-none focus:border-[#0EA5E9]"
            />
          </div>
          <motion.button
            type="submit"
            whileTap={{ scale: 0.96 }}
            data-testid="submit-weight-btn"
            className="w-full py-2.5 rounded-xl text-white font-extrabold text-xs tracking-wide shadow-xs transition cursor-pointer hover:brightness-105"
            style={{
              background: 'linear-gradient(135deg, #0EA5E9, #38BDF8)',
            }}
          >
            + Record &amp; Compute EWMA Trend
          </motion.button>
        </form>

        <div className="lg:col-span-2 apple-card p-5 space-y-3 bg-white dark:bg-[#121622]/90 border border-slate-900/[0.06] dark:border-white/[0.08]">
          <div className="flex items-center justify-between border-b border-slate-900/[0.06] dark:border-white/[0.06] pb-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-300 flex items-center gap-2">
              <span>📈</span> Exponentially Smoothed Bodyweight Ledger (α = 0.12)
            </h3>
            <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">Noise Filtered</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-500 dark:text-zinc-500 border-b border-slate-900/[0.06] dark:border-white/[0.06]">
                  <th className="py-2">Date</th>
                  <th className="py-2 text-right">Raw Scale</th>
                  <th className="py-2 text-right">Smoothed Trend (α=0.12)</th>
                  <th className="py-2 text-right">Fluid Variance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/[0.04] dark:divide-white/[0.04]">
                {weightLogs.map((w) => {
                  const weightVal = typeof w.weightKg === 'number' ? w.weightKg : 76.4;
                  const smoothedVal = typeof w.smoothedWeightKg === 'number' ? w.smoothedWeightKg : weightVal;
                  const noise = Number((weightVal - smoothedVal).toFixed(2));
                  return (
                    <tr key={w.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                      <td className="py-2 font-mono text-slate-600 dark:text-zinc-400">{w.date}</td>
                      <td className="py-2 text-right text-[#0F172A] dark:text-white font-semibold font-mono tabular-nums">
                        {weightVal.toFixed(1)} kg
                      </td>
                      <td className="py-2 text-right text-[#0EA5E9] font-bold font-mono tabular-nums">
                        {smoothedVal.toFixed(2)} kg
                      </td>
                      <td className="py-2 text-right font-mono text-slate-400 dark:text-zinc-500 tabular-nums">
                        {noise >= 0 ? `+${noise}` : noise} kg
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Weekly Check-In Modal Mount */}
      <WeeklyCheckInModal
        isOpen={isCheckInOpen}
        onClose={() => setIsCheckInOpen(false)}
        onKeepCurrent={() => setIsCheckInOpen(false)}
        onAccept={handleAcceptTargets}
        params={checkInParams}
      />
    </div>
  );
};
