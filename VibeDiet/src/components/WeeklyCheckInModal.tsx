import React, { useMemo, useEffect } from 'react';
import ReactDOM from 'react-dom';
import {
  WeeklyCheckInParams,
  WeeklyCheckInResult,
  computeWeeklyCheckIn,
} from '../services/weeklyAutopilot.js';

export interface AcceptedTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  result: WeeklyCheckInResult;
}

export interface WeeklyCheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: (targets: AcceptedTargets) => void;
  onKeepCurrent?: () => void;
  result?: WeeklyCheckInResult;
  params?: WeeklyCheckInParams;
}

const DEFAULT_SAMPLE_PARAMS: WeeklyCheckInParams = {
  goal: 'fat_loss',
  averageDailyIntakeKcal: 2050,
  weightLogs: [
    { date: '2026-11-09', weightKg: 82.4, smoothedWeightKg: 82.4 },
    { date: '2026-11-10', weightKg: 82.2, smoothedWeightKg: 82.38 },
    { date: '2026-11-11', weightKg: 82.5, smoothedWeightKg: 82.39 },
    { date: '2026-11-12', weightKg: 81.9, smoothedWeightKg: 82.33 },
    { date: '2026-11-13', weightKg: 82.1, smoothedWeightKg: 82.30 },
    { date: '2026-11-14', weightKg: 81.7, smoothedWeightKg: 82.23 },
    { date: '2026-11-15', weightKg: 81.6, smoothedWeightKg: 82.15 },
  ],
  currentTargets: {
    calories: 2150,
    protein: 165,
    carbs: 210,
    fat: 65,
  },
  biometrics: {
    gender: 'male',
    weightKg: 81.6,
    heightCm: 178,
    age: 28,
    bmr: 1780,
  },
  daysLogged: 7,
};

export const WeeklyCheckInModal: React.FC<WeeklyCheckInModalProps> = ({
  isOpen,
  onClose,
  onAccept,
  onKeepCurrent,
  result: propResult,
  params: propParams,
}) => {
  // Single global Escape keydown listener so 1 Escape press closes immediately
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Compute check-in results deterministically
  const activeResult: WeeklyCheckInResult = useMemo(() => {
    if (propResult) return propResult;
    return computeWeeklyCheckIn(propParams || DEFAULT_SAMPLE_PARAMS);
  }, [propResult, propParams]);

  const {
    goal,
    recommendedCalories,
    proteinGrams,
    carbsGrams,
    fatGrams,
    weeklyDeltaKcal,
    trueTdee,
    smoothedWeightDeltaKg,
    startSmoothedWeightKg,
    endSmoothedWeightKg,
    metabolicConfidenceScore,
    isPlateauDetected,
    isRapidLossDetected,
    isSafetyFloorEnforced,
    safetyFloorKcal,
    coachReasoning,
    previousTargets,
  } = activeResult;

  const safeProtein = Number.isFinite(proteinGrams) ? Math.round(proteinGrams) : 165;
  const safeCarbs = Number.isFinite(carbsGrams) ? Math.round(carbsGrams) : 210;
  const safeFat = Number.isFinite(fatGrams) ? Math.round(fatGrams) : 65;
  const prevProtein = Number.isFinite(previousTargets?.protein) ? Math.round(previousTargets.protein) : 165;
  const prevCarbs = Number.isFinite(previousTargets?.carbs) ? Math.round(previousTargets.carbs) : 210;
  const prevFat = Number.isFinite(previousTargets?.fat) ? Math.round(previousTargets.fat) : 65;
  const deltaProtein = safeProtein - prevProtein;
  const deltaCarbs = safeCarbs - prevCarbs;
  const deltaFat = safeFat - prevFat;

  const handleAccept = () => {
    onAccept({
      calories: recommendedCalories,
      protein: safeProtein,
      carbs: safeCarbs,
      fat: safeFat,
      result: activeResult,
    });
    onClose();
  };

  const handleKeepCurrent = () => {
    if (onKeepCurrent) {
      onKeepCurrent();
    }
    onClose();
  };

  if (!isOpen || typeof document === 'undefined') return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 overflow-y-auto">
      <div
        className="absolute inset-0 z-0 bg-slate-950/65 backdrop-blur-md"
        onClick={onClose}
        data-testid="weekly-check-in-modal-backdrop"
      />
      <div
        data-testid="weekly-check-in-modal"
        className="relative z-10 w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-[28px] bg-white dark:bg-[#121622] border border-slate-200/80 dark:border-white/15 shadow-2xl p-5 sm:p-7 space-y-5 select-none my-auto transition-colors"
      >
            {/* Ambient Ambient Radial Lighting */}
            <div
              className="absolute -top-24 -right-24 w-56 h-56 rounded-full pointer-events-none blur-3xl opacity-20"
              style={{
                background: `radial-gradient(circle, #0EA5E9, #FF6B2C)`,
              }}
            />

            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-900/[0.06] dark:border-white/[0.08] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-xs border border-[#0EA5E9]/20 bg-[#0EA5E9]/10 text-[#0EA5E9]">
                  <span className="text-xl">⚡</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-[#0F172A] dark:text-white tracking-tight">
                      Weekly Metabolic Autopilot
                    </h2>
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-[#0EA5E9]/15 text-[#0EA5E9] border border-[#0EA5E9]/30">
                      7-Day Calibration
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    True Expenditure &amp; Adaptive Macro Rebalancing
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close Check-In Modal"
                data-testid="close-weekly-check-in-btn"
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-800 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] transition border border-slate-900/[0.06] dark:border-white/[0.06] cursor-pointer"
              >
                <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            </div>

            {/* Metabolic Signal Bento (7-Day Trend, True TDEE, Confidence) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* 7-Day Trend Weight Delta */}
              <div className="apple-subcard rounded-2xl p-3.5 border border-slate-900/[0.06] dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.02] flex flex-col justify-between">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  Smoothed Δ (α = 0.12)
                </span>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span
                    className={`text-2xl font-mono font-extrabold ${
                      smoothedWeightDeltaKg < 0
                        ? 'text-[#10B981]'
                        : smoothedWeightDeltaKg > 0
                        ? 'text-[#FF6B2C]'
                        : 'text-slate-700 dark:text-zinc-300'
                    }`}
                  >
                    {smoothedWeightDeltaKg >= 0
                      ? `+${smoothedWeightDeltaKg}`
                      : smoothedWeightDeltaKg}
                  </span>
                  <span className="text-xs text-slate-400 dark:text-zinc-400 font-sans">kg/wk</span>
                </div>
                <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1 font-mono">
                  {startSmoothedWeightKg}kg → {endSmoothedWeightKg}kg
                </div>
              </div>

              {/* Calibrated True TDEE */}
              <div className="apple-subcard rounded-2xl p-3.5 border border-[#0EA5E9]/20 bg-[#0EA5E9]/[0.05] flex flex-col justify-between">
                <span className="text-[11px] font-semibold text-[#0EA5E9] uppercase tracking-wider">
                  Calibrated True TDEE
                </span>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-2xl font-mono font-extrabold text-[#0EA5E9]">
                    {trueTdee}
                  </span>
                  <span className="text-xs text-slate-400 dark:text-zinc-400 font-sans">kcal/d</span>
                </div>
                <div className="text-[10px] text-slate-500 dark:text-zinc-400 mt-1">
                  Intake vs. Biological Balance
                </div>
              </div>

              {/* Confidence Score */}
              <div
                className="apple-subcard rounded-2xl p-3.5 border border-slate-900/[0.06] dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.02] flex flex-col justify-between"
                data-testid="confidence-score"
              >
                <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  Calibration Confidence
                </span>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span
                    className={`text-2xl font-mono font-extrabold ${
                      metabolicConfidenceScore >= 85
                        ? 'text-[#0EA5E9]'
                        : metabolicConfidenceScore >= 65
                        ? 'text-[#FF6B2C]'
                        : 'text-[#F43F5E]'
                    }`}
                  >
                    {metabolicConfidenceScore}%
                  </span>
                  <span className="text-xs text-slate-400 dark:text-zinc-400 font-sans">score</span>
                </div>
                <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
                  {metabolicConfidenceScore >= 85
                    ? 'High Precision Signal'
                    : 'Partial Logs Detected'}
                </div>
              </div>
            </div>

            {/* Warning / Safeguard Callouts */}
            {isSafetyFloorEnforced && (
              <div className="rounded-2xl p-3.5 bg-rose-500/10 border border-rose-500/30 text-rose-800 dark:text-rose-200 text-xs flex items-start gap-2.5">
                <span className="text-base">🛡️</span>
                <div>
                  <strong>BMR Physiological Safety Floor Active:</strong> Caloric intake locked at{' '}
                  <span className="font-mono font-bold">{safetyFloorKcal} kcal/day</span> to protect basal metabolic rate and prevent hormonal down-regulation.
                </div>
              </div>
            )}

            {isPlateauDetected && !isSafetyFloorEnforced && (
              <div className="rounded-2xl p-3.5 bg-[#FF6B2C]/10 border border-[#FF6B2C]/30 text-amber-800 dark:text-amber-200 text-xs flex items-start gap-2.5">
                <span className="text-base">🧬</span>
                <div>
                  <strong>Metabolic Plateau Detected:</strong> Weight trend changed by less than 0.12 kg over 7 days. Moderate deficit adjustment applied; 2-day carb refeed suggested.
                </div>
              </div>
            )}

            {isRapidLossDetected && (
              <div className="rounded-2xl p-3.5 bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs flex items-start gap-2.5">
                <span className="text-base">⚠️</span>
                <div>
                  <strong>Rapid Loss Deceleration:</strong> Trend drop exceeded 0.9 kg/week. Deficit reduced to safeguard skeletal muscle mass and energy levels.
                </div>
              </div>
            )}

            {/* Target Comparison Bento (Calories & Macro Split) */}
            <div className="apple-subcard rounded-2xl p-4 border border-slate-900/[0.06] dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.02] space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#0F172A] dark:text-white uppercase tracking-wider">
                  Target Macro Comparison
                </span>
                <span className="text-xs text-slate-500 dark:text-zinc-400">
                  Current vs. Autopilot Recommendation
                </span>
              </div>

              {/* Total Calorie Comparison Pill */}
              <div
                className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-black/40 border border-slate-900/[0.06] dark:border-white/[0.06] shadow-xs"
                data-testid="recommended-calories"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Daily Calories:</span>
                  <span className="text-sm font-mono text-slate-600 dark:text-zinc-300">
                    {previousTargets.calories}
                  </span>
                  <span className="text-slate-400 text-xs">→</span>
                  <span className="text-base font-mono font-extrabold text-[#0F172A] dark:text-white">
                    {recommendedCalories}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-zinc-400">kcal/d</span>
                </div>

                <span
                  className={`text-xs font-mono font-bold px-2 py-0.5 rounded-lg border ${
                    weeklyDeltaKcal > 0
                      ? 'bg-[#0EA5E9]/15 text-[#0EA5E9] border-[#0EA5E9]/30'
                      : weeklyDeltaKcal < 0
                      ? 'bg-[#FF6B2C]/15 text-[#FF6B2C] border-[#FF6B2C]/30'
                      : 'bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-300 dark:border-zinc-700'
                  }`}
                >
                  {weeklyDeltaKcal > 0 ? `+${weeklyDeltaKcal}` : weeklyDeltaKcal} kcal
                </span>
              </div>

              {/* 3 Macro Pillars */}
              <div className="grid grid-cols-3 gap-2.5 text-center">
                {/* Protein Pill */}
                <div className="p-2.5 rounded-xl bg-white dark:bg-black/40 border border-slate-900/[0.06] dark:border-white/[0.06] shadow-xs">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#0EA5E9]">
                    Protein (2.2g/kg)
                  </div>
                  <div className="mt-1 text-sm font-mono font-extrabold text-[#0F172A] dark:text-white">
                    {safeProtein}g
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-zinc-400 font-mono mt-0.5">
                    {deltaProtein >= 0 ? `+${deltaProtein}` : deltaProtein}g
                  </div>
                </div>

                {/* Carbs Pill */}
                <div className="p-2.5 rounded-xl bg-white dark:bg-black/40 border border-slate-900/[0.06] dark:border-white/[0.06] shadow-xs">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#FF6B2C]">
                    Carbohydrates
                  </div>
                  <div className="mt-1 text-sm font-mono font-extrabold text-[#0F172A] dark:text-white">
                    {safeCarbs}g
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-zinc-400 font-mono mt-0.5">
                    {deltaCarbs >= 0 ? `+${deltaCarbs}` : deltaCarbs}g
                  </div>
                </div>

                {/* Fat Pill */}
                <div className="p-2.5 rounded-xl bg-white dark:bg-black/40 border border-slate-900/[0.06] dark:border-white/[0.06] shadow-xs">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#F43F5E]">
                    Healthy Fats
                  </div>
                  <div className="mt-1 text-sm font-mono font-extrabold text-[#0F172A] dark:text-white">
                    {safeFat}g
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-zinc-400 font-mono mt-0.5">
                    {deltaFat >= 0 ? `+${deltaFat}` : deltaFat}g
                  </div>
                </div>
              </div>
            </div>

            {/* Coach Reasoning Text */}
            <div className="apple-subcard rounded-2xl p-3.5 bg-slate-50 dark:bg-black/30 border border-slate-900/[0.06] dark:border-white/[0.06] text-xs text-slate-700 dark:text-zinc-300 leading-relaxed">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase text-slate-500 dark:text-zinc-400 mb-1">
                <span>🤖</span>
                <span>Adaptive Coach Rationale</span>
              </div>
              <p>{coachReasoning}</p>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-col-reverse sm:flex-row items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleKeepCurrent}
                data-testid="keep-current-plan-btn"
                className="w-full sm:w-1/2 py-3 px-4 rounded-xl text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white bg-slate-100 hover:bg-slate-200/80 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] border border-slate-200 dark:border-white/15 transition active:scale-[0.98] cursor-pointer"
              >
                Keep Current Plan
              </button>

              <button
                type="button"
                onClick={handleAccept}
                data-testid="accept-targets-btn"
                className="w-full sm:w-1/2 py-3 px-4 rounded-xl text-xs font-extrabold tracking-wide text-white transition active:scale-[0.98] cursor-pointer hover:brightness-105 shadow-sm"
                style={{
                  background: 'linear-gradient(135deg, #0EA5E9, #38BDF8)',
                }}
              >
                Accept &amp; Update Targets
              </button>
            </div>
          </div>
        </div>,
        document.body
      );
};
