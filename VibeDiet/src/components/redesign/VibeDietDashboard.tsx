import React, { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import "./VibeDietTheme.css";
import { SmartMacroSolverWidget } from "../../services/macroMealSolver.js";
import { MealEntry } from "../../types/index.js";

export type MealSlot = "breakfast" | "lunch" | "dinner" | "snacks";
export type MealAction = "photo" | "barcode" | "search";

export interface MealItem {
  id: string;
  title: string;
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  verified?: boolean;
}

export interface SmartCombo {
  id: string;
  title: string;
  subtitle: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  onLog: () => void;
}

export interface DashboardSummary {
  caloriesEaten: number;
  caloriesTarget: number;
  protein: number;
  proteinTarget: number;
  carbs: number;
  carbsTarget: number;
  fat: number;
  fatTarget: number;
  fiber: number;
  sugar: number;
  sodium: number;
  waterMl: number;
  waterTargetMl: number;
}

export interface RepeatMealItem {
  id: string;
  title: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  onCopy: () => void;
}

export interface VibeDietDashboardProps {
  selectedDate?: string;
  onSelectDate?: (date: string) => void;
  dateHeading?: string;
  dateLabel: string;
  onPrevDay: () => void;
  onNextDay: () => void;
  onClearDay: () => void;
  summary: DashboardSummary;
  meals: Record<MealSlot, MealItem[]>;
  smartCombos?: SmartCombo[];
  onAddWater: (ml: number) => void;
  onDeleteMealItem: (mealSlot: string, itemId: string) => void;
  onTriggerAction: (action: MealAction, mealSlot?: string) => void;
  repeatMeals?: RepeatMealItem[];
  onLogCombo?: (slot: "breakfast" | "lunch" | "dinner" | "snack", title: string, items: any[]) => void;
}

const mealOrder: MealSlot[] = ["breakfast", "lunch", "dinner", "snacks"];

const mealMeta: Record<MealSlot, { label: string; badge: string; emoji: string }> = {
  breakfast: { label: "Breakfast", badge: "rgba(255, 146, 72, 0.14)", emoji: "🍳" },
  lunch: { label: "Lunch", badge: "rgba(16, 185, 129, 0.13)", emoji: "🥗" },
  dinner: { label: "Dinner", badge: "rgba(14, 165, 233, 0.13)", emoji: "🍲" },
  snacks: { label: "Snacks", badge: "rgba(244, 63, 94, 0.11)", emoji: "🍎" },
};

const clamp = (value: number, min = 0, max = 1) => Math.min(Math.max(value, min), max);
const whole = (value: number) => Math.round(value).toLocaleString("en-US");
const macro = (value: number) =>
  Number.isInteger(value) ? String(value) : value.toFixed(1);

function ArrowIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <path
        d={direction === "left" ? "m12 5-5 5 5 5" : "m8 5 5 5-5 5"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <path
        d="M4.5 6.25h11M8 3.75h4M6 6.25l.55 9.1c.02.42.36.75.78.75h5.34c.42 0 .76-.33.78-.75l.55-9.1M8.25 9v4.25M11.75 9v4.25"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DropletIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d="M12 3.25S5.75 10.1 5.75 14.65a6.25 6.25 0 0 0 12.5 0C18.25 10.1 12 3.25 12 3.25Z"
        fill="rgba(14,165,233,0.14)"
        stroke="#0EA5E9"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M9 16.25c.45 1.05 1.35 1.6 2.65 1.7" stroke="#0EA5E9" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function MealIllustration({ slot }: { slot: MealSlot }) {
  if (slot === "breakfast") {
    return (
      <svg viewBox="0 0 48 48" className="h-10 w-10" fill="none" aria-hidden="true">
        <circle cx="24" cy="25" r="16" fill="#FFF" stroke="#F1F5F9" strokeWidth="2" />
        <path
          d="M13.5 25.2c-.4-4.3 3.6-6.3 6-7.7 2.7-1.6 4.2-4.3 7.8-2.8 2.4 1 2.4 3.6 4.6 5.2 3.5 2.6 3.6 7.7.3 10.5-2.5 2.2-5.3.8-8 2-4.7 2-10-2.1-10.7-7.2Z"
          fill="#FFFDF7"
          stroke="#F4D9B8"
          strokeWidth="1.2"
        />
        <circle cx="24.2" cy="24.2" r="5.7" fill="#FFB020" />
        <circle cx="22.4" cy="22.3" r="1.65" fill="#FFD985" />
      </svg>
    );
  }

  if (slot === "lunch") {
    return (
      <svg viewBox="0 0 48 48" className="h-10 w-10" fill="none" aria-hidden="true">
        <path d="M10 23h28c0 10-5.7 15-14 15S10 33 10 23Z" fill="#FFF" stroke="#CBD5E1" strokeWidth="1.6" />
        <path d="M13 23c1.2-7.2 6-11 11-11s9.8 3.8 11 11" fill="#F8FAFC" />
        <path d="M15 21c2.2-5.5 5.8-7.4 9.5-7.8-1 4.4-4.2 7.3-9.5 7.8Z" fill="#34D399" />
        <path d="M23 21c.4-5.7 3.8-8.5 8.7-8.8-.1 4.8-3.1 8-8.7 8.8Z" fill="#10B981" />
        <path d="M25 22c1.8-4.6 5.4-5.8 9-4.8-1.2 3.8-4.1 5.5-9 4.8Z" fill="#FF9248" />
        <path d="M16 38h16" stroke="#94A3B8" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }

  if (slot === "dinner") {
    return (
      <svg viewBox="0 0 48 48" className="h-10 w-10" fill="none" aria-hidden="true">
        <circle cx="24" cy="24" r="17" fill="#FFF" stroke="#DBEAFE" strokeWidth="2" />
        <circle cx="24" cy="24" r="12.5" fill="#F8FAFC" stroke="#E2E8F0" />
        <path
          d="M15 27c1.2-6.2 7.2-10 13.5-7.5-1.1 6.8-6.8 10.3-13.5 7.5Z"
          fill="#FF9248"
        />
        <path d="m17 26 9-4.5M20 28.5l8-4.2" stroke="#FFF1E8" strokeWidth="1.3" strokeLinecap="round" />
        <circle cx="31.5" cy="29.5" r="3.4" fill="#34D399" />
        <circle cx="34" cy="25.8" r="3.1" fill="#10B981" />
        <circle cx="29.5" cy="24.9" r="2.8" fill="#6EE7B7" />
        <path d="m31.5 31.5-1.8 3" stroke="#059669" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 48 48" className="h-10 w-10" fill="none" aria-hidden="true">
      <path
        d="M24 16c-4.3-4.2-12-1.7-13 6.8-1.2 9.8 6.3 15.1 13 10.4 6.7 4.7 14.2-.6 13-10.4C36 14.3 28.3 11.8 24 16Z"
        fill="#FB7185"
      />
      <path d="M24 16c-.2-4.2 1.1-6.5 3.3-8" stroke="#92400E" strokeWidth="2.1" strokeLinecap="round" />
      <path d="M26.5 11.5c1.2-4.1 4.7-5.2 8-4.1-.6 3.8-3.6 5.8-8 4.1Z" fill="#34D399" />
      <path d="M16 20.5c-1.4 1.4-2 3.3-2 5" stroke="#FDA4AF" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

interface MacroBarProps {
  label: string;
  value: number;
  target: number;
  barClass: string;
}

function MacroBar({ label, value, target, barClass }: MacroBarProps) {
  const progress = target > 0 ? clamp(value / target) : 0;

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-xs font-semibold text-[var(--text-primary)]">{label}</span>
        <span className="numeric text-[11px] font-medium text-[var(--text-secondary)]">
          {macro(value)} <span className="text-[var(--text-tertiary)]">/ {whole(target)} g</span>
        </span>
      </div>
      <div
        className="h-2.5 overflow-hidden rounded-full bg-[var(--active)]"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={target}
        aria-valuenow={Math.round(value)}
      >
        <motion.div
          className={`h-full rounded-full bg-gradient-to-r ${barClass}`}
          initial={{ width: 0 }}
          animate={{ width: `${progress * 100}%` }}
          transition={{ type: "spring", stiffness: 90, damping: 22 }}
        />
      </div>
    </div>
  );
}

interface MealCardProps {
  slot: MealSlot;
  items: MealItem[];
  index: number;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onDelete: (slot: MealSlot, itemId: string) => void;
  onAction: (action: MealAction, slot: MealSlot) => void;
}

function MealCard({
  slot,
  items,
  index,
  open,
  onToggle,
  onClose,
  onDelete,
  onAction,
}: MealCardProps) {
  const rootRef = useRef<HTMLElement>(null);
  const totalCalories = items.reduce((total, item) => total + item.calories, 0);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) onClose();
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, onClose]);

  const chooseAction = (action: MealAction) => {
    onAction(action, slot);
    onClose();
  };

  return (
    <motion.article
      ref={rootRef}
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 26, delay: index * 0.035 }}
      className={`apple-card min-w-0 p-4 sm:p-5 ${open ? "relative z-30" : "relative z-0"}`}
      aria-label={mealMeta[slot].label}
    >
      <div className="flex items-center gap-3">
        <div
          className="grid h-12 w-12 shrink-0 place-items-center rounded-[16px]"
          style={{ backgroundColor: mealMeta[slot].badge }}
        >
          <MealIllustration slot={slot} />
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[15px] font-bold tracking-[-0.025em] text-[var(--text-primary)]">
            {mealMeta[slot].label}
          </h2>
          <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
            <span className="numeric">{items.length}</span> {items.length === 1 ? "item" : "items"}
            <span className="mx-1.5 text-[var(--border-strong)]">•</span>
            <span className="numeric font-semibold text-[var(--text-primary)]">{whole(totalCalories)}</span> kcal
          </p>
        </div>

        <motion.button
          type="button"
          whileTap={{ scale: 0.94 }}
          onClick={onToggle}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={`Add food to ${mealMeta[slot].label}`}
          className="shrink-0 rounded-full bg-[rgba(255,107,44,0.1)] px-3.5 py-2 text-xs font-bold text-[var(--tangerine-text)] transition-colors hover:bg-[rgba(255,107,44,0.17)] cursor-pointer"
        >
          + Add
        </motion.button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -7, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 480, damping: 32 }}
            className="absolute right-4 top-[68px] z-40 w-48 origin-top-right rounded-[18px] border border-[var(--border-strong)] bg-[var(--card)] p-1.5 shadow-[0_18px_45px_-12px_rgba(15,23,42,0.28)]"
          >
            {([
              ["photo", "📸", "AI Photo"],
              ["barcode", "🏷️", "Barcode"],
              ["search", "🔍", "Search"],
            ] as const).map(([action, emoji, label]) => (
              <button
                key={action}
                type="button"
                role="menuitem"
                onClick={() => chooseAction(action)}
                className="flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-left text-xs font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--hover)] cursor-pointer"
              >
                <span className="text-base" aria-hidden="true">{emoji}</span>
                {label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-3 min-h-[74px]">
        {items.length === 0 ? (
          <div className="flex min-h-[74px] items-center justify-center rounded-[16px] border border-dashed border-[var(--border-strong)] px-4 text-center text-[11px] leading-5 text-[var(--text-tertiary)]">
            Nothing logged yet. Add a photo, barcode, or searched food.
          </div>
        ) : (
          <div className="space-y-1">
            <AnimatePresence initial={false}>
              {items.map((item, itemIndex) => (
                <motion.div
                  layout
                  key={item.id}
                  data-testid="meal-card"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`group overflow-hidden ${
                    itemIndex > 0 ? "border-t border-[var(--border)]" : ""
                  }`}
                >
                  <div className="flex items-center gap-2 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-1.5">
                        <p className="line-clamp-2 text-xs font-semibold leading-snug text-[var(--text-primary)]" title={item.title}>
                          {item.title}
                        </p>
                        {item.verified && (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[rgba(16,185,129,0.16)] bg-[rgba(16,185,129,0.09)] px-1.5 py-0.5 text-[8px] font-bold text-[var(--emerald-text)]">
                            <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" aria-hidden="true">
                              <path d="m3 6.2 1.8 1.8L9.2 3.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            Verified
                          </span>
                        )}
                      </div>
                      <p className="numeric mt-1 truncate text-[9px] tracking-[-0.035em] text-[var(--text-secondary)]">
                        {whole(item.grams)} g · P {macro(item.protein)} · C {macro(item.carbs)} · F {macro(item.fat)}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <span className="numeric text-xs font-bold text-[var(--text-primary)]">{whole(item.calories)}</span>
                      <span className="ml-0.5 text-[9px] text-[var(--text-tertiary)]">kcal</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => onDelete(slot, item.id)}
                      className="grid h-8 w-7 shrink-0 place-items-center rounded-lg text-[var(--text-tertiary)] opacity-100 transition-all hover:bg-[rgba(244,63,94,0.09)] hover:text-[#F43F5E] focus:opacity-100 md:opacity-0 md:group-hover:opacity-100 cursor-pointer"
                      aria-label={`Delete ${item.title}`}
                      title="Delete item"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.article>
  );
}

export default function VibeDietDashboard({
  selectedDate,
  onSelectDate,
  dateHeading,
  dateLabel,
  onPrevDay,
  onNextDay,
  onClearDay,
  summary,
  meals,
  smartCombos = [],
  onAddWater,
  onDeleteMealItem,
  onTriggerAction,
  repeatMeals = [],
  onLogCombo,
}: VibeDietDashboardProps) {
  const [openMeal, setOpenMeal] = useState<MealSlot | null>(null);
  const [solverOpen, setSolverOpen] = useState(false);
  const [repeatDrawerOpen, setRepeatDrawerOpen] = useState(false);
  const ringId = `calorie-${useId().replace(/:/g, "")}`;
  const solverId = useId();

  const remaining = summary.caloriesTarget - summary.caloriesEaten;
  const remainingProtein = Math.max(0, summary.proteinTarget - summary.protein);
  const remainingCarbs = Math.max(0, summary.carbsTarget - summary.carbs);
  const remainingFat = Math.max(0, summary.fatTarget - summary.fat);

  const calorieProgress =
    summary.caloriesTarget > 0 ? clamp(summary.caloriesEaten / summary.caloriesTarget) : 0;
  const waterProgress =
    summary.waterTargetMl > 0 ? clamp(summary.waterMl / summary.waterTargetMl) : 0;

  const radius = 82;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="vibediet-canvas" data-testid="daily-diary-screen">
      <main className="mx-auto max-w-[1560px] px-4 pb-36 pt-6 sm:px-6 sm:pt-8 lg:px-8">
        {/* Top Header Command Bar */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5 flex flex-wrap items-center justify-between gap-3"
        >
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--tangerine-text)]">
              Daily overview
            </p>
            <div className="flex items-baseline gap-3">
              <h1 className="text-2xl font-extrabold tracking-[-0.045em] text-[var(--text-primary)] sm:text-[28px]">
                {dateHeading || "Today"}
              </h1>
              <span className="text-xs font-medium text-[var(--text-secondary)] sm:text-sm">{dateLabel}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-[13px] border border-[var(--border)] bg-[var(--card)] p-1 shadow-sm">
              <button
                type="button"
                onClick={onPrevDay}
                data-testid="prev-day-btn"
                className="grid h-8 w-8 place-items-center rounded-[9px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text-primary)] cursor-pointer"
                aria-label="Previous day"
              >
                <ArrowIcon direction="left" />
              </button>
              <div className="h-4 w-px bg-[var(--border)]" />
              {selectedDate && onSelectDate && (
                <>
                  <input
                    type="date"
                    data-testid="date-picker-input"
                    value={selectedDate}
                    onChange={(e) => onSelectDate(e.target.value)}
                    aria-label="Select diary date"
                    className="h-8 bg-transparent text-[11px] font-mono px-2 text-[var(--text-primary)] border-0 focus:outline-none cursor-pointer"
                  />
                  <div className="h-4 w-px bg-[var(--border)]" />
                </>
              )}
              <button
                type="button"
                onClick={onNextDay}
                data-testid="next-day-btn"
                className="grid h-8 w-8 place-items-center rounded-[9px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text-primary)] cursor-pointer"
                aria-label="Next day"
              >
                <ArrowIcon direction="right" />
              </button>
            </div>

            {/* Repeat Meals Library Drawer Toggle Button */}
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={() => setRepeatDrawerOpen((val) => !val)}
              data-testid="toggle-repeat-drawer-btn"
              className="h-10 rounded-[13px] border border-[var(--border)] bg-[var(--card)] px-3 text-[11px] font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text-primary)] flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <span>🔁</span>
              <span>Past Meals ({repeatMeals.length})</span>
            </motion.button>

            {/* Clear Day / Reset Demo Button */}
            <button
              type="button"
              onClick={onClearDay}
              data-testid="clear-demo-meals-btn"
              className="h-10 rounded-[13px] px-3 text-[11px] font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover)] hover:text-[#F43F5E] cursor-pointer flex items-center gap-1.5"
              title="Reset Day's Logged Meals and Water"
            >
              <span>🗑️</span>
              <span>Reset Demo / Clear Day</span>
            </button>
          </div>
        </motion.div>

        {/* Repeat Meals Library Expanded Drawer */}
        <AnimatePresence>
          {repeatDrawerOpen && (
            <motion.section
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-5 overflow-hidden apple-card p-4 sm:p-5"
            >
              <div className="mb-3 flex items-center justify-between border-b border-[var(--border)] pb-2.5">
                <h2 className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <span>🔁</span> One-Tap Repeat Meals Library
                </h2>
                <button
                  type="button"
                  onClick={() => setRepeatDrawerOpen(false)}
                  className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  ✕ Close
                </button>
              </div>

              {repeatMeals.length === 0 ? (
                <p className="rounded-[15px] bg-[var(--card-subtle)] px-4 py-5 text-center text-[11px] text-[var(--text-secondary)]">
                  No saved repeat meals yet. Meals you log often will appear here for 1-tap logging.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {repeatMeals.map((meal) => (
                    <div
                      key={meal.id}
                      className="apple-subcard flex items-center justify-between p-3"
                    >
                      <div>
                        <p className="text-xs font-bold text-[var(--text-primary)]">{meal.title}</p>
                        <p className="numeric mt-0.5 text-[10px] text-[var(--text-secondary)]">
                          {whole(meal.calories)} kcal · P {macro(meal.protein)}g · C {macro(meal.carbs)}g · F {macro(meal.fat)}g
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={meal.onCopy}
                        className="rounded-full bg-[rgba(14,165,233,0.12)] px-3 py-1.5 text-xs font-bold text-[#0284C7] hover:bg-[rgba(14,165,233,0.2)] transition cursor-pointer"
                      >
                        + Copy
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </motion.section>
          )}
        </AnimatePresence>

        {/* Bento Grid */}
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,42fr)_minmax(0,58fr)]">
          {/* Left Column: Energy Ring + Hydration + Smart Solver */}
          <div className="min-w-0 space-y-4">
            <motion.section
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 240, damping: 25 }}
              className="apple-card p-5 sm:p-6"
              aria-label="Calorie and macronutrient summary"
            >
              <div className="flex flex-col items-center">
                <div
                  className="relative h-[200px] w-[200px]"
                  role="img"
                  aria-label={`${whole(summary.caloriesEaten)} of ${whole(summary.caloriesTarget)} calories consumed`}
                >
                  <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
                    <defs>
                      <linearGradient id={ringId} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#FB923C" />
                        <stop offset="100%" stopColor="#38BDF8" />
                      </linearGradient>
                    </defs>
                    <circle
                      cx="100"
                      cy="100"
                      r={radius}
                      fill="none"
                      stroke="var(--active)"
                      strokeWidth="16"
                    />
                    <motion.circle
                      cx="100"
                      cy="100"
                      r={radius}
                      fill="none"
                      stroke={`url(#${ringId})`}
                      strokeWidth="16"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      initial={{ strokeDashoffset: circumference }}
                      animate={{ strokeDashoffset: circumference * (1 - calorieProgress) }}
                      transition={{ type: "spring", stiffness: 65, damping: 20 }}
                      className="drop-shadow-[0_0_12px_rgba(56,189,248,0.35)]"
                    />
                  </svg>

                  <div className="absolute inset-0 flex flex-col items-center justify-center pt-1">
                    <span className="numeric text-4xl sm:text-[48px] font-bold tabular-nums leading-none tracking-tight text-[var(--text-primary)]">
                      {whole(Math.abs(remaining))}
                    </span>
                    <span className="mt-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)]">
                      kcal {remaining >= 0 ? "remaining" : "over target"}
                    </span>
                  </div>
                </div>

                <div className="mt-5 grid w-full grid-cols-2 gap-2.5">
                  <div className="apple-subcard px-3 py-2.5 text-center">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
                      Daily Target
                    </p>
                    <p className="numeric mt-1 text-xs font-bold text-[var(--text-primary)]">
                      {whole(summary.caloriesTarget)} <span className="text-[9px] font-medium text-[var(--text-secondary)]">kcal</span>
                    </p>
                  </div>
                  <div className="apple-subcard px-3 py-2.5 text-center">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
                      Consumed
                    </p>
                    <p data-testid="calories-consumed" className="numeric mt-1 text-xs font-bold text-[var(--tangerine-text)]">
                      {whole(summary.caloriesEaten)} <span className="text-[9px] font-medium text-[var(--text-secondary)]">kcal</span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <MacroBar
                  label="Protein"
                  value={summary.protein}
                  target={summary.proteinTarget}
                  barClass="from-[#0EA5E9] to-[#38BDF8]"
                />
                <MacroBar
                  label="Carbs"
                  value={summary.carbs}
                  target={summary.carbsTarget}
                  barClass="from-[#FF6B2C] to-[#FF9248]"
                />
                <MacroBar
                  label="Fat"
                  value={summary.fat}
                  target={summary.fatTarget}
                  barClass="from-[#F43F5E] to-[#FB7185]"
                />
              </div>

              <div className="mt-5 whitespace-nowrap border-t border-[var(--border)] pt-4 text-center text-[10px] text-[var(--text-secondary)]">
                <span>Fiber <span className="numeric font-semibold text-[var(--text-primary)]">{macro(summary.fiber)} g</span></span>
                <span className="mx-2 text-[var(--text-tertiary)]">•</span>
                <span>Sugar <span className="numeric font-semibold text-[var(--text-primary)]">{macro(summary.sugar)} g</span></span>
                <span className="mx-2 text-[var(--text-tertiary)]">•</span>
                <span>Sodium <span className="numeric font-semibold text-[var(--text-primary)]">{whole(summary.sodium)} mg</span></span>
              </div>
            </motion.section>

            {/* Hydration Section */}
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06 }}
              className="apple-card flex items-center gap-3 p-4 sm:gap-4 sm:px-5"
              aria-label="Hydration"
            >
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[15px] bg-[rgba(14,165,233,0.1)]">
                <DropletIcon />
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-2">
                  <h2 className="text-xs font-bold text-[var(--text-primary)]">Hydration</h2>
                  <p className="numeric text-[10px] font-semibold text-[#0EA5E9]">
                    {whole(summary.waterMl)} <span className="text-[var(--text-tertiary)]">/ {whole(summary.waterTargetMl)} ml</span>
                  </p>
                </div>
                <div
                  className="h-2 overflow-hidden rounded-full bg-[rgba(14,165,233,0.1)]"
                  role="progressbar"
                  aria-label="Water consumed"
                  aria-valuemin={0}
                  aria-valuemax={summary.waterTargetMl}
                  aria-valuenow={summary.waterMl}
                >
                  <motion.div
                    data-testid="hydration-bar-inner"
                    className="h-full rounded-full bg-gradient-to-r from-[#0EA5E9] to-[#38BDF8]"
                    style={{ width: summary.waterMl <= 0 ? '0px' : `${Math.min(100, Math.max(0, (summary.waterTargetMl > 0 ? (summary.waterMl / summary.waterTargetMl) * 100 : 0)))}%` }}
                    initial={{ width: 0 }}
                    animate={{ width: summary.waterMl <= 0 ? '0px' : `${Math.min(100, Math.max(0, (summary.waterTargetMl > 0 ? (summary.waterMl / summary.waterTargetMl) * 100 : 0)))}%` }}
                    transition={summary.waterMl <= 0 ? { duration: 0 } : { type: "spring", stiffness: 100, damping: 22 }}
                  />
                </div>
              </div>
              <motion.button
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={() => onAddWater(250)}
                className="shrink-0 rounded-full bg-[rgba(14,165,233,0.1)] px-3 py-2 text-[10px] font-bold text-[#0284C7] transition-colors hover:bg-[rgba(14,165,233,0.17)] cursor-pointer"
              >
                + 250 ml
              </motion.button>
            </motion.section>

            {/* Smart Macro Solver Section */}
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="apple-card overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setSolverOpen((value) => !value)}
                data-testid="toggle-solver-drawer-btn"
                aria-expanded={solverOpen}
                aria-controls={solverId}
                className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-[var(--hover)] sm:px-5 cursor-pointer"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-gradient-to-br from-[rgba(14,165,233,0.12)] to-[rgba(255,107,44,0.12)] text-lg">
                  ✨
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-bold text-[var(--text-primary)]">Smart Macro Solver</span>
                  <span className="mt-0.5 block text-[10px] text-[var(--text-secondary)]">
                    Targeted combinations matched to your remaining macros
                  </span>
                </span>
                <motion.svg
                  viewBox="0 0 20 20"
                  fill="none"
                  animate={{ rotate: solverOpen ? 180 : 0 }}
                  className="h-4 w-4 shrink-0 text-[var(--text-tertiary)]"
                  aria-hidden="true"
                >
                  <path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                </motion.svg>
              </button>

              <AnimatePresence initial={false}>
                {solverOpen && (
                  <motion.div
                    id={solverId}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.24 }}
                    className="overflow-hidden border-t border-[var(--border)] p-3 sm:p-4"
                  >
                    <SmartMacroSolverWidget
                      remainingKcal={Math.max(0, remaining)}
                      remainingProtein={remainingProtein}
                      remainingCarbs={remainingCarbs}
                      remainingFat={remainingFat}
                      targetSlot="lunch"
                      hideDuplicateHeader={true}
                      onLogCombo={onLogCombo || (() => {})}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.section>
          </div>

          {/* Right Column: 4 Meal Cards */}
          <section className="grid min-w-0 items-start gap-5 sm:grid-cols-2" aria-label="Meals">
            {mealOrder.map((slot, index) => (
              <MealCard
                key={slot}
                slot={slot}
                items={meals[slot] ?? []}
                index={index}
                open={openMeal === slot}
                onToggle={() => setOpenMeal((current) => (current === slot ? null : slot))}
                onClose={() => setOpenMeal(null)}
                onDelete={onDeleteMealItem}
                onAction={onTriggerAction}
              />
            ))}
          </section>
        </div>
      </main>

      {/* Floating Action Dock */}
      <div
        data-testid="omnibar-dock"
        className="pointer-events-none fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex justify-center px-3"
      >
        <motion.nav
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 25, delay: 0.16 }}
          className="pointer-events-auto flex max-w-full items-center gap-1 rounded-full bg-slate-900/90 dark:bg-slate-800/85 backdrop-blur-2xl text-white border border-white/15 shadow-2xl px-3 py-2"
          aria-label="Quick food logging actions"
        >
          {/* AI Meal Scan Action */}
          <div className="flex items-center">
            <motion.button
              type="button"
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => onTriggerAction("photo")}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-white/10 sm:gap-2 sm:px-4 cursor-pointer"
            >
              <span className="text-base" aria-hidden="true">📷</span>
              AI Meal Scan
            </motion.button>
          </div>

          <div className="mx-0.5 h-5 w-px bg-white/20" />

          {/* Barcode Action */}
          <div className="flex items-center">
            <motion.button
              type="button"
              data-testid="open-barcode-scanner-btn"
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => onTriggerAction("barcode")}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-white/10 sm:gap-2 sm:px-4 cursor-pointer"
            >
              <span className="text-base" aria-hidden="true">🏷️</span>
              Scan Barcode
            </motion.button>
          </div>

          <div className="mx-0.5 h-5 w-px bg-white/20" />

          {/* Search Foods Action */}
          <div className="flex items-center">
            <motion.button
              type="button"
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => onTriggerAction("search")}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-white/10 sm:gap-2 sm:px-4 cursor-pointer"
            >
              <span className="text-base" aria-hidden="true">🔍</span>
              Search Foods
            </motion.button>
          </div>
        </motion.nav>
      </div>
    </div>
  );
}
