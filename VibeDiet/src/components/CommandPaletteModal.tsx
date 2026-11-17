import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useDiet } from '../context/DietContext.js';
import { useAuth } from '../context/AuthContext.js';
import { ActiveTab } from './Navigation.js';
import { COLOR_TOKENS, SPRING_PRESETS } from '../client/design-system/tokens.js';
import { getAllPortionCalibrations } from '../services/portionMemory.js';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTab: (tab: ActiveTab) => void;
  onShowToast?: (msg: string, type?: 'info' | 'success' | 'water') => void;
}

interface PaletteItem {
  id: string;
  category: 'action' | 'navigation' | 'meal';
  title: string;
  subtitle?: string;
  icon: string;
  shortcut?: string;
  action: () => void;
  badge?: string;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  onSelectTab,
  onShowToast,
}) => {
  const { user } = useAuth();
  const {
    repeatMeals,
    copyRepeatMealToToday,
    addManualMeal,
    addWaterMl,
    clearDayMeals,
  } = useDiet();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input whenever opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      window.setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Global Escape keydown listener
  useEffect(() => {
    if (!isOpen) return;
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isOpen, onClose]);

  // Pull portion calibrations from Stream 2's portionMemory if available
  const portionCalibrations = useMemo(() => {
    try {
      const uid = user?.uid || 'demo-user-uid';
      return getAllPortionCalibrations(uid);
    } catch {
      return [];
    }
  }, [user?.uid]);

  // Build the complete command catalog
  const allItems: PaletteItem[] = useMemo(() => {
    const items: PaletteItem[] = [
      // 1. Quick Actions
      {
        id: 'action-photo-scan',
        category: 'action',
        title: 'Snap / Paste Meal Photo',
        subtitle: 'Camera, photo upload, or clipboard image',
        icon: '📸',
        shortcut: 'S',
        action: () => {
          onSelectTab('photo');
          onClose();
        },
      },
      {
        id: 'action-voice-meal',
        category: 'action',
        title: 'Log Voice / Natural Language Meal',
        subtitle: 'Describe your meal in English or Hinglish',
        icon: '🎙️',
        shortcut: 'N',
        action: () => {
          onSelectTab('photo');
          onClose();
          window.setTimeout(() => {
            document.querySelector<HTMLInputElement>('[data-testid="dictate-meal-input"]')?.focus();
          }, 80);
        },
      },
      {
        id: 'action-water-250',
        category: 'action',
        title: 'Add +250ml Hydration',
        subtitle: 'Quick log 1 glass of fresh water',
        icon: '💧',
        shortcut: 'W',
        badge: '+250ml',
        action: () => {
          addWaterMl(250);
          onShowToast?.('+250ml Water Logged (Hydration Saved)', 'water');
          onClose();
        },
      },
      {
        id: 'action-clear-demo',
        category: 'action',
        title: 'Clear Today Meals / Start Fresh',
        subtitle: 'Wipe current day meals and drafts',
        icon: '🗑️',
        action: () => {
          clearDayMeals();
          onShowToast?.('Today meals reset', 'info');
          onClose();
        },
      },

      // 2. Navigation
      {
        id: 'nav-today',
        category: 'navigation',
        title: 'Go to Today Diary',
        subtitle: 'Macro rings, 4-slot timeline, and hydration',
        icon: '✨',
        shortcut: '1',
        action: () => {
          onSelectTab('diary');
          onClose();
        },
      },
      {
        id: 'nav-photo',
        category: 'navigation',
        title: 'Go to AI Meal Scan',
        subtitle: 'Visual meal recognition and camera scanner',
        icon: '📸',
        shortcut: '2',
        action: () => {
          onSelectTab('photo');
          onClose();
        },
      },
      {
        id: 'nav-manual',
        category: 'navigation',
        title: 'Go to Food Search & USDA Catalog',
        subtitle: 'Search 400k+ USDA & barcode verified foods',
        icon: '🔍',
        shortcut: '3',
        action: () => {
          onSelectTab('manual');
          onClose();
        },
      },
      {
        id: 'nav-coach',
        category: 'navigation',
        title: 'Go to Metabolism & Adaptive TDEE',
        subtitle: 'BMR calculations, scale weight & Smart Solver',
        icon: '🧬',
        shortcut: '4',
        action: () => {
          onSelectTab('coach');
          onClose();
        },
      },
      {
        id: 'nav-profile',
        category: 'navigation',
        title: 'Go to User Profile & Data Portability',
        subtitle: 'GDPR export, billing, and biometrics',
        icon: '👤',
        shortcut: '5',
        action: () => {
          onSelectTab('profile');
          onClose();
        },
      },
    ];

    // 3. 1-Tap Frequent & Calibrated Meals
    repeatMeals.forEach((meal) => {
      items.push({
        id: `meal-repeat-${meal.id}`,
        category: 'meal',
        title: `1-Tap Repeat: ${meal.title}`,
        subtitle: `${meal.totalCalories} kcal · P ${meal.totalProtein}g · C ${meal.totalCarbs}g · F ${meal.totalFat}g`,
        icon: '🔁',
        badge: `${meal.totalCalories} kcal`,
        action: () => {
          copyRepeatMealToToday(meal.id);
          onShowToast?.(`Logged repeat meal: "${meal.title}"`, 'success');
          onClose();
        },
      });
    });

    // 4. Portion calibrations from Stream 2
    portionCalibrations.forEach((cal) => {
      items.push({
        id: `meal-calibrated-${cal.foodKey}`,
        category: 'meal',
        title: `Portion Memory: ${cal.foodName}`,
        subtitle: `Calibrated baseline: ${cal.calibratedGrams}g ${cal.oilModifier ? `(${cal.oilModifier})` : ''}`,
        icon: '⚖️',
        badge: `${cal.calibratedGrams}g`,
        action: () => {
          addManualMeal('lunch', cal.foodName, [
            {
              name: cal.foodName,
              grams: cal.calibratedGrams,
              tier: 1,
            },
          ]);
          onShowToast?.(`Logged calibrated portion: ${cal.foodName} (${cal.calibratedGrams}g)`, 'success');
          onClose();
        },
      });
    });

    return items;
  }, [
    repeatMeals,
    portionCalibrations,
    onSelectTab,
    onClose,
    addWaterMl,
    clearDayMeals,
    copyRepeatMealToToday,
    addManualMeal,
    onShowToast,
  ]);

  // Fuzzy filter
  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allItems;
    return allItems.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        (item.subtitle && item.subtitle.toLowerCase().includes(q)) ||
        (item.shortcut && item.shortcut.toLowerCase() === q)
    );
  }, [allItems, query]);

  // Keyboard navigation inside the palette
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].action();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  // Keep selected item scrolled into view
  useEffect(() => {
    const listEl = listRef.current;
    if (!listEl) return;
    const selectedEl = listEl.querySelector<HTMLElement>(`[data-palette-index="${selectedIndex}"]`);
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  useEffect(() => {
    if (!isOpen) return;
    const handleGlobalEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleGlobalEscape);
    return () => window.removeEventListener('keydown', handleGlobalEscape);
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div
        className="fixed inset-0 z-0 bg-slate-950/65 backdrop-blur-md"
        onClick={onClose}
        data-testid="command-palette-backdrop"
      />
      <div
        className="relative z-10 w-full max-w-xl rounded-3xl border border-slate-200/80 dark:border-white/[0.12] overflow-hidden shadow-2xl flex flex-col max-h-[80vh] bg-white/95 dark:bg-[#121622]/95 backdrop-blur-2xl text-slate-900 dark:text-white"
        data-testid="command-palette-modal"
      >
            {/* Search Input Bar */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 dark:border-white/[0.08]">
              <span className="text-base text-slate-400">🔍</span>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Type a command, meal, food, or shortcut..."
                data-testid="command-palette-input"
                className="flex-1 bg-transparent text-sm text-[#0F172A] dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none font-medium"
              />
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500 dark:text-zinc-400 bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.08] px-2 py-0.5 rounded-md">
                <span>ESC to close</span>
              </div>
            </div>

            {/* Results List */}
            <div
              ref={listRef}
              className="flex-1 overflow-y-auto py-2 px-3 divide-y divide-transparent space-y-1"
            >
              {filteredItems.length === 0 ? (
                <div className="p-8 text-center text-slate-400 dark:text-zinc-500 text-xs">
                  No commands or meals matching &ldquo;{query}&rdquo;
                </div>
              ) : (
                filteredItems.map((item, idx) => {
                  const isSelected = idx === selectedIndex;
                  return (
                    <div
                      key={item.id}
                      data-palette-index={idx}
                      data-testid={`palette-item-${item.id}`}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      onClick={item.action}
                      className={`flex items-center justify-between px-3.5 py-2.5 rounded-2xl cursor-pointer transition select-none ${
                        isSelected
                          ? 'bg-sky-50 dark:bg-gradient-to-r dark:from-[#38BDF8]/20 dark:to-[#38BDF8]/5 text-[#0F172A] dark:text-white border border-[#0EA5E9]/30 dark:border-[#38BDF8]/30 shadow-sm'
                          : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-base flex-shrink-0">{item.icon}</span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate text-[#0F172A] dark:text-white">
                            {item.title}
                          </p>
                          {item.subtitle && (
                            <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                              {item.subtitle}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                        {item.badge && (
                          <span
                            className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-orange-50 dark:bg-[#FF6B2C]/20 text-[#FF6B2C] border border-[#FF6B2C]/30"
                          >
                            {item.badge}
                          </span>
                        )}
                        {item.shortcut && (
                          <kbd
                            className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-white/[0.08] text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-white/[0.1]"
                          >
                            {item.shortcut}
                          </kbd>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom Keyboard Guide Bar */}
            <div className="px-5 py-3 border-t border-slate-100 dark:border-white/[0.08] bg-slate-50/80 dark:bg-black/40 flex flex-wrap items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400">
              <div className="flex items-center gap-3">
                <span>
                  <strong className="text-slate-700 dark:text-zinc-300">↑↓</strong> Navigate
                </span>
                <span>
                  <strong className="text-slate-700 dark:text-zinc-300">↵</strong> Select
                </span>
                <span>
                  <strong className="text-slate-700 dark:text-zinc-300">⌘K</strong> Palette
                </span>
              </div>
              <div className="flex items-center gap-2 text-[#0EA5E9] dark:text-[#38BDF8] font-semibold">
                <span>⚡ Quick Actions</span>
              </div>
            </div>
          </div>
        </div>,
        document.body
      );
};
