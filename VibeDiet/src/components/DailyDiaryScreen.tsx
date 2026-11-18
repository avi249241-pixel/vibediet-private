import React, { useState } from 'react';
import { useDiet } from '../context/DietContext.js';
import { EvidenceTier, FoodItemEntry, MealEntry, MealSlot as DomainMealSlot } from '../types/index.js';
import { dateKey, deriveTargets } from '../utils/atwater.js';
import { BarcodeScannerModal } from './BarcodeScannerModal.js';
import VibeDietDashboard, {
  MealSlot,
  MealAction,
  MealItem,
  DashboardSummary,
} from './redesign/VibeDietDashboard.js';

interface DailyDiaryScreenProps {
  onOpenPhotoScanner: (slot?: DomainMealSlot) => void;
  onOpenManualEntry: (slot?: DomainMealSlot) => void;
  onOpenLegal: () => void;
}

export function renderTierBadge(tier: EvidenceTier) {
  if (tier === 1) {
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
        🟢 Verified
      </span>
    );
  }
  if (tier === 2) {
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#0EA5E9]/15 text-[#0EA5E9] border border-[#0EA5E9]/30">
        🔵 Barcode
      </span>
    );
  }
  if (tier === 3) {
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#FF6B2C]/15 text-[#FF6B2C] border border-[#FF6B2C]/30">
        🟣 AI Vision
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-zinc-400 border border-slate-200 dark:border-white/10">
      ⚪ User Estimate
    </span>
  );
}

export const DailyDiaryScreen: React.FC<DailyDiaryScreenProps> = ({
  onOpenPhotoScanner,
  onOpenManualEntry,
  onOpenLegal: _onOpenLegal,
}) => {
  const {
    currentDay,
    biometrics,
    selectedDate,
    setSelectedDate,
    addWaterMl,
    deleteMeal,
    clearDayMeals,
    copyRepeatMealToToday,
    repeatMeals,
    addManualMeal,
  } = useDiet();

  const [barcodeTargetSlot, setBarcodeTargetSlot] = useState<DomainMealSlot | null>(null);

  const caloriesTarget = biometrics?.targetCalories || 2245;
  const derivedTargets = deriveTargets(caloriesTarget);
  const proteinTarget = biometrics?.targetProtein || derivedTargets.protein;
  const fatTarget = biometrics?.targetFat || derivedTargets.fat;
  const carbsTarget = biometrics?.targetCarbs || derivedTargets.carbs;

  const hasMeals = (currentDay?.meals || []).length > 0;

  const summary: DashboardSummary = {
    caloriesEaten: currentDay?.totalCalories ?? 0,
    caloriesTarget,
    protein: currentDay?.totalProtein ?? 0,
    proteinTarget,
    carbs: currentDay?.totalCarbs ?? 0,
    carbsTarget,
    fat: currentDay?.totalFat ?? 0,
    fatTarget,
    fiber: hasMeals ? (currentDay?.totalFiber ?? 0) : 0,
    sugar: hasMeals ? (currentDay?.totalSugar ?? 0) : 0,
    sodium: hasMeals ? (currentDay?.totalSodium ?? 0) : 0,
    waterMl: currentDay?.waterMl ?? 0,
    waterTargetMl: 2500,
  };

  const mealsMap: Record<MealSlot, MealItem[]> = {
    breakfast: [],
    lunch: [],
    dinner: [],
    snacks: [],
  };

  (currentDay?.meals || []).forEach((meal) => {
    const slotKey: MealSlot =
      meal.slot === 'snack' ? 'snacks' : (meal.slot as MealSlot);
    if (!mealsMap[slotKey]) {
      mealsMap[slotKey] = [];
    }
    (meal.items || []).forEach((it) => {
      mealsMap[slotKey].push({
        id: `${meal.id}-${it.id}`,
        title: it.name,
        grams: it.grams,
        calories: it.calories,
        protein: it.protein,
        carbs: it.carbs,
        fat: it.fat,
        verified: it.tier === 1 || it.tier === 2,
      });
    });
  });

  const repeatMealItems = (repeatMeals || []).map((rm) => ({
    id: rm.id,
    title: rm.title,
    calories: rm.totalCalories,
    protein: rm.totalProtein,
    carbs: rm.totalCarbs,
    fat: rm.totalFat,
    onCopy: () => copyRepeatMealToToday(rm.id),
  }));

  const handlePrevDay = () => {
    const [y, m, day] = selectedDate.split('-').map(Number);
    const d = new Date(y, m - 1, day - 1);
    const prevDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    setSelectedDate(prevDateStr);
  };

  const handleNextDay = () => {
    const todayLimit = dateKey();
    if (selectedDate >= todayLimit) return;
    const [y, m, day] = selectedDate.split('-').map(Number);
    const d = new Date(y, m - 1, day + 1);
    const nextDateStr = dateKey(d);
    setSelectedDate(nextDateStr > todayLimit ? todayLimit : nextDateStr);
  };

  const handleClearDay = () => {
    clearDayMeals(selectedDate);
  };

  const handleTriggerAction = (action: MealAction, slot?: string) => {
    const domainSlot: DomainMealSlot =
      slot === 'snacks' ? 'snack' : (slot as DomainMealSlot) || 'lunch';

    if (action === 'photo') {
      onOpenPhotoScanner(domainSlot);
    } else if (action === 'barcode') {
      setBarcodeTargetSlot(domainSlot);
    } else if (action === 'search') {
      onOpenManualEntry(domainSlot);
    }
  };

  const handleDeleteMealItem = (_mealSlot: string, itemId: string) => {
    // itemId is composite: `${meal.id}-${it.id}`
    const mealId = itemId.includes('-') ? itemId.split('-')[0] : itemId;
    deleteMeal(mealId);
  };

  const handleBarcodeDetected = (food: FoodItemEntry) => {
    const target = barcodeTargetSlot || 'lunch';
    addManualMeal(target, food.name, [food]);
    setBarcodeTargetSlot(null);
  };

  const handleLogCombo = (slot: DomainMealSlot, title: string, items: FoodItemEntry[]) => {
    addManualMeal(slot, title, items);
  };

  const todayKey = dateKey();
  const yesterdayObj = new Date();
  yesterdayObj.setDate(yesterdayObj.getDate() - 1);
  const yesterdayKey = dateKey(yesterdayObj);

  let dateHeading = 'Today';
  if (selectedDate === todayKey) {
    dateHeading = 'Today';
  } else if (selectedDate === yesterdayKey) {
    dateHeading = 'Yesterday';
  } else {
    dateHeading = new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' });
  }

  const dateFormatted = new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <>
      <VibeDietDashboard
        selectedDate={selectedDate}
        maxDate={todayKey}
        onSelectDate={setSelectedDate}
        dateHeading={dateHeading}
        dateLabel={dateFormatted}
        onPrevDay={handlePrevDay}
        onNextDay={handleNextDay}
        onClearDay={handleClearDay}
        summary={summary}
        meals={mealsMap}
        onAddWater={addWaterMl}
        onDeleteMealItem={handleDeleteMealItem}
        onTriggerAction={handleTriggerAction}
        repeatMeals={repeatMealItems}
        onLogCombo={handleLogCombo}
      />

      {/* Barcode Scanner Modal Mount */}
      <BarcodeScannerModal
        isOpen={Boolean(barcodeTargetSlot)}
        onClose={() => setBarcodeTargetSlot(null)}
        onDetected={handleBarcodeDetected}
      />
    </>
  );
};
