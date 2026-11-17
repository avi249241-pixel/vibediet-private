import React, { useState, useMemo } from 'react';
import { useDiet } from '../context/DietContext.js';
import { ActivityLevel, GoalMode } from '../types/index.js';
import {
  calculateMifflinStJeorBmr,
  ACTIVITY_MULTIPLIERS,
  calculateTargetCaloriesWithFloor,
} from '../utils/atwater.js';

interface OnboardingWizardProps {
  onComplete: () => void;
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onComplete }) => {
  const { biometrics, updateBiometrics, loadSampleDay } = useDiet();
  const [age, setAge] = useState(biometrics.age || 28);
  const [gender, setGender] = useState<'male' | 'female'>(biometrics.gender || 'male');
  const [heightCm, setHeightCm] = useState(biometrics.heightCm || 178);
  const [weightKg, setWeightKg] = useState(biometrics.weightKg || 78.5);
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(
    biometrics.activityLevel || 'moderately_active'
  );
  const [goalMode, setGoalMode] = useState<GoalMode>(biometrics.goalMode || 'moderate_cut');
  const [loadSample, setLoadSample] = useState(false);

  // Live Computed Mifflin-St Jeor & TDEE Preview
  const computed = useMemo(() => {
    const bmr = calculateMifflinStJeorBmr(gender, weightKg, heightCm, age);
    const baselineTdee = Math.round(bmr * (ACTIVITY_MULTIPLIERS[activityLevel] || 1.55));
    const targetCalories = calculateTargetCaloriesWithFloor(baselineTdee, gender, goalMode);
    const targetProtein = Math.round(weightKg * 2.1);
    const targetFat = Math.round((targetCalories * 0.28) / 9);
    const targetCarbs = Math.max(50, Math.round((targetCalories - targetProtein * 4 - targetFat * 9) / 4));
    return { bmr, baselineTdee, targetCalories, targetProtein, targetCarbs, targetFat };
  }, [gender, weightKg, heightCm, age, activityLevel, goalMode]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateBiometrics({
      age,
      gender,
      heightCm,
      weightKg,
      activityLevel,
      goalMode,
      onboarded: true,
    });
    if (loadSample) {
      loadSampleDay();
    }
    onComplete();
  };

  const handleQuickLoadSample = () => {
    updateBiometrics({
      age,
      gender,
      heightCm,
      weightKg,
      activityLevel,
      goalMode,
      onboarded: true,
    });
    loadSampleDay();
    onComplete();
  };

  return (
    <div className="max-w-3xl mx-auto pb-24" data-testid="onboarding-wizard">
      <form onSubmit={handleSave} className="apple-card p-6 sm:p-8 space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#0EA5E9]" />
            <span className="text-[11px] font-mono font-bold tracking-wider uppercase text-[#0EA5E9]">
              Metabolic Profile Calibration
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#0F172A] dark:text-white tracking-tight">
            Personalize Your Metabolic Intelligence
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Configures precision Mifflin-St Jeor BMR, dynamic TDEE multiplier, and medical safety floors.
          </p>
        </div>

        {/* Step 1: Goal & Biological Sex */}
        <div className="p-4 rounded-2xl apple-subcard bg-slate-50/70 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/10 space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-[#FF6B2C] text-white text-[11px] font-bold flex items-center justify-center">
              1
            </span>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#0F172A] dark:text-white">
              Metabolic Goal &amp; Biological Sex
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Biological Sex (Mifflin-St Jeor constant)
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as 'male' | 'female')}
                data-testid="onboarding-gender"
                className="w-full mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs text-[#0F172A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]"
              >
                <option value="male">Male (+5 constant · 1,500 kcal safety floor)</option>
                <option value="female">Female (-161 constant · 1,200 kcal safety floor)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Primary Metabolic Goal
              </label>
              <select
                value={goalMode}
                onChange={(e) => setGoalMode(e.target.value as GoalMode)}
                className="w-full mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs text-[#0F172A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]"
              >
                <option value="aggressive_cut">Aggressive Cut (-25% Deficit)</option>
                <option value="moderate_cut">Moderate Cut (-15% Deficit)</option>
                <option value="maintenance">Maintenance (0% Baseline)</option>
                <option value="lean_bulk">Lean Bulk (+10% Surplus)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Step 2: Body Stats & Activity Multiplier */}
        <div className="p-4 rounded-2xl apple-subcard bg-slate-50/70 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/10 space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-[#0EA5E9] text-white text-[11px] font-bold flex items-center justify-center">
              2
            </span>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#0F172A] dark:text-white">
              Body Dimensions &amp; Activity Multiplier
            </h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Age</label>
              <input
                type="number"
                min="14"
                max="100"
                value={age}
                onChange={(e) => setAge(Number(e.target.value))}
                className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-[#0F172A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Height (cm)</label>
              <input
                type="number"
                min="100"
                max="250"
                value={heightCm}
                onChange={(e) => setHeightCm(Number(e.target.value))}
                className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-[#0F172A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]"
              />
            </div>

            <div className="col-span-2 sm:col-span-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Scale Weight (kg)</label>
              <input
                type="number"
                step="0.1"
                min="35"
                max="250"
                value={weightKg}
                onChange={(e) => setWeightKg(Number(e.target.value))}
                className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-[#0F172A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Physical Activity Multiplier
            </label>
            <select
              value={activityLevel}
              onChange={(e) => setActivityLevel(e.target.value as ActivityLevel)}
              className="w-full mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs text-[#0F172A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]"
            >
              <option value="sedentary">Sedentary (desk work, little exercise · ×1.200)</option>
              <option value="lightly_active">Lightly Active (1–3 days/wk light cardio · ×1.375)</option>
              <option value="moderately_active">Moderately Active (3–5 days/wk resistance training · ×1.550)</option>
              <option value="very_active">Very Active (6–7 days/wk heavy training · ×1.725)</option>
              <option value="extremely_active">Extremely Active (twice-a-day athlete / laborer · ×1.900)</option>
            </select>
          </div>
        </div>

        {/* Step 3: Real-Time Target Confirmation */}
        <div className="p-4 rounded-2xl apple-subcard bg-gradient-to-br from-slate-50 to-sky-50/40 dark:from-white/[0.03] dark:to-sky-950/20 border border-slate-200/80 dark:border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#10B981] text-white text-[11px] font-bold flex items-center justify-center">
                3
              </span>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#0F172A] dark:text-white">
                Calculated Targets &amp; Macro Breakdown
              </h3>
            </div>
            <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
              ✓ Safety Floor Enforced
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-white/10 text-center">
              <p className="text-[10px] text-slate-500 dark:text-slate-400">BMR</p>
              <p className="text-base font-extrabold font-mono text-[#0F172A] dark:text-white">
                {computed.bmr}
              </p>
              <p className="text-[9px] text-slate-400">kcal/d</p>
            </div>
            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-white/10 text-center">
              <p className="text-[10px] text-slate-500 dark:text-slate-400">TDEE</p>
              <p className="text-base font-extrabold font-mono text-[#0EA5E9]">
                {computed.baselineTdee}
              </p>
              <p className="text-[9px] text-slate-400">kcal/d</p>
            </div>
            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-white/10 text-center">
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Daily Target</p>
              <p className="text-base font-extrabold font-mono text-[#FF6B2C]">
                {computed.targetCalories}
              </p>
              <p className="text-[9px] text-slate-400">kcal/d</p>
            </div>
            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-white/10 text-center">
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Protein</p>
              <p className="text-base font-extrabold font-mono text-[#0EA5E9]">
                {computed.targetProtein}g
              </p>
              <p className="text-[9px] text-slate-400">~2.1g/kg</p>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs px-1 text-slate-600 dark:text-slate-300">
            <span>Macro Allocation:</span>
            <span className="font-mono text-[11px]">
              <strong className="text-[#0EA5E9]">{computed.targetProtein}g P</strong> ·{' '}
              <strong className="text-[#FF6B2C]">{computed.targetCarbs}g C</strong> ·{' '}
              <strong className="text-[#F43F5E]">{computed.targetFat}g F</strong>
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            type="button"
            onClick={handleQuickLoadSample}
            className="flex-1 py-3 px-4 rounded-2xl apple-subcard bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-slate-800 dark:text-zinc-200 font-semibold text-xs transition cursor-pointer border border-slate-200 dark:border-white/10 flex items-center justify-center gap-2"
          >
            <span>🍛</span>
            <span>Load Sample Day (Indian-Fusion)</span>
          </button>

          <button
            type="submit"
            data-testid="save-onboarding-btn"
            className="flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-[#FF6B2C] to-[#FF9248] hover:opacity-95 text-white font-bold text-xs tracking-wide shadow-md shadow-[#FF6B2C]/20 transition cursor-pointer flex items-center justify-center gap-2"
          >
            <span>✓</span>
            <span>Confirm Targets &amp; Return to Diary</span>
          </button>
        </div>
      </form>
    </div>
  );
};
