import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { AuthContext } from './AuthContext.js';
import {
  DaySummary,
  FoodItemEntry,
  MealEntry,
  MealSlot,
  SupportTicket,
  UserBiometrics,
  WeightLogEntry,
} from '../types/index.js';
import { ClarifyingQuestion, PhotoDraft } from '../shared/draftTypes.js';
import {
  DEFAULT_USER_BIOMETRICS,
  SEED_INITIAL_MEALS,
  SEED_REPEAT_MEALS,
  SEED_WEIGHT_LOGS,
  buildDemoRecognizedItems,
  DEMO_INDIAN_FUSION_QUESTIONS,
} from '../data/mockData.js';
import {
  ACTIVITY_MULTIPLIERS,
  calculateMifflinStJeorBmr,
  calculateTargetCaloriesWithFloor,
  computeEwmaWeight,
  normalizeFoodItem,
  getLocalDateString,
  dateKey,
  deriveTargets,
} from '../utils/atwater.js';
import { parseNaturalLanguageMeal } from '../services/naturalLanguageMealParser.js';
import { enqueueOfflineMutation as enqueueMutation, flushOfflineQueue } from '../services/offlineSyncQueue.js';
import {
  queueMealDelta,
  queueWeightDelta,
  flushDeltaOutbox,
  pullRemoteDeltas,
  getLastSyncTimestamp,
  clearOutbox as clearDeltaOutbox,
} from '../services/cloudDeltaSync.js';

interface DietContextValue {
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  biometrics: UserBiometrics;
  updateBiometrics: (next: Partial<UserBiometrics>) => void;
  currentDay: DaySummary;
  repeatMeals: MealEntry[];
  weightLogs: WeightLogEntry[];
  activeDraft: PhotoDraft | null;
  supportTickets: SupportTicket[];
  addWaterMl: (deltaMl: number) => void;
  addManualMeal: (slot: MealSlot, title: string, items: Partial<FoodItemEntry>[]) => MealEntry;
  deleteMeal: (mealId: string) => void;
  clearDayMeals: (dateToClear?: string) => void;
  loadSampleDay: (dateToSeed?: string) => void;
  copyRepeatMealToToday: (mealId: string, targetSlot?: MealSlot) => void;
  startPhotoDraft: (
    slot: MealSlot,
    thumbnailDataUrl?: string,
    contextNote?: string,
    scanMode?: 'plate_vision' | 'nutrition_label_ocr',
    fullImageDataUrl?: string
  ) => PhotoDraft;
  updateDraftItemGrams: (itemId: string, newGrams: number) => void;
  applyServingMultiplier: (itemId: string, multiplier: number) => void;
  applyMacroDeltaChip: (
    itemId: string,
    deltaKcal: number,
    deltaFat: number,
    deltaCarbs?: number,
    deltaProt?: number
  ) => void;
  startTextDraft: (mealDescription: string, slotHint?: MealSlot) => Promise<PhotoDraft | null>;
  answerClarifyingQuestion: (questionId: string, optionId: string) => void;
  confirmActiveDraft: (overrideMultiplier?: number) => MealEntry | null;
  logScaleWeight: (date: string, weightKg: number) => WeightLogEntry;
  submitSupportTicket: (
    category: SupportTicket['category'],
    subject: string,
    message: string
  ) => SupportTicket;
  resolveSupportTicket: (ticketId: string) => void;
  eraseAllUserData: () => void;
}

const DietContext = createContext<DietContextValue | undefined>(undefined);

const VIBEDIET_STORAGE_KEY_V1 = 'vibediet_user_data_v1';

interface LocalPersistedData {
  meals?: MealEntry[];
  waterByDate?: Record<string, number>;
  repeatMeals?: MealEntry[];
  weightLogs?: WeightLogEntry[];
  biometrics?: UserBiometrics;
}

function loadPersistedData(): LocalPersistedData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(VIBEDIET_STORAGE_KEY_V1);
    if (!raw) return null;
    return JSON.parse(raw) as LocalPersistedData;
  } catch {
    return null;
  }
}

function savePersistedData(patch: Partial<LocalPersistedData>) {
  if (typeof window === 'undefined') return;
  try {
    const existing = loadPersistedData() || {};
    const merged = { ...existing, ...patch };
    localStorage.setItem(VIBEDIET_STORAGE_KEY_V1, JSON.stringify(merged));
  } catch {}
}

export const DietProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const auth = useContext(AuthContext);
  const token = auth?.token || 'uid:demo-user-uid';

  const todayStr = dateKey();
  const [selectedDate, setSelectedDateRaw] = useState<string>(todayStr);
  const setSelectedDate = (nextDate: string) => {
    const maxDate = dateKey();
    setSelectedDateRaw(nextDate > maxDate ? maxDate : nextDate);
  };

  const initialPersisted = useMemo(() => loadPersistedData(), []);

  const [biometrics, setBiometrics] = useState<UserBiometrics>(() => {
    const raw = initialPersisted?.biometrics || DEFAULT_USER_BIOMETRICS;
    const bmr = raw.bmr || calculateMifflinStJeorBmr(
      raw.gender || 'male',
      raw.weightKg || 76.4,
      raw.heightCm || 175,
      raw.age || 24
    );
    return {
      ...DEFAULT_USER_BIOMETRICS,
      ...raw,
      bmr,
      weightKg: Number(raw.weightKg) || 76.4,
      heightCm: Number(raw.heightCm) || 175,
      age: Number(raw.age) || 24,
    };
  });
  const [meals, setMeals] = useState<MealEntry[]>(() => {
    if (initialPersisted?.meals && Array.isArray(initialPersisted.meals) && initialPersisted.meals.length > 0) {
      return initialPersisted.meals;
    }
    return SEED_INITIAL_MEALS.map((m) => ({ ...m, date: todayStr }));
  });
  const [waterByDate, setWaterByDate] = useState<Record<string, number>>(() => {
    if (initialPersisted?.waterByDate) {
      const cleaned: Record<string, number> = {};
      for (const [d, val] of Object.entries(initialPersisted.waterByDate)) {
        if (typeof val === 'number' && Number.isFinite(val)) {
          cleaned[d] = Math.max(0, val);
        }
      }
      return cleaned;
    }
    return {};
  });
  const [repeatMeals, setRepeatMeals] = useState<MealEntry[]>(
    () => (initialPersisted?.repeatMeals && initialPersisted.repeatMeals.length > 0)
      ? initialPersisted.repeatMeals
      : SEED_REPEAT_MEALS
  );
  const [weightLogs, setWeightLogs] = useState<WeightLogEntry[]>(
    () => (initialPersisted?.weightLogs && initialPersisted.weightLogs.length > 0)
      ? initialPersisted.weightLogs
      : SEED_WEIGHT_LOGS
  );
  const [activeDraft, setActiveDraft] = useState<PhotoDraft | null>(null);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('dark') ||
        (typeof localStorage !== 'undefined' && localStorage.getItem('vibediet_theme') === 'dark')
        ? 'dark'
        : 'light';
    }
    return 'light';
  });

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', theme === 'dark');
    }
  }, [theme]);

  // Automatic LocalStorage sync on every state mutation
  useEffect(() => {
    savePersistedData({
      meals,
      waterByDate,
      repeatMeals,
      weightLogs,
      biometrics,
    });
  }, [meals, waterByDate, repeatMeals, weightLogs, biometrics]);

  // Flush offline sync queue when network connectivity restores
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleOnline = () => {
      flushDeltaOutbox(token).catch(() => {});
      flushOfflineQueue(async (mutation) => {
        try {
          if (mutation.type === 'LOG_MEAL') {
            const res = await fetch('/v1/meals/manual', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify(mutation.payload),
            });
            return res.ok;
          }
          if (mutation.type === 'LOG_WATER') {
            const res = await fetch(`/v1/days/${mutation.payload.date}/water`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ deltaMl: mutation.payload.deltaMl }),
            });
            return res.ok;
          }
          return true;
        } catch {
          return false;
        }
      });
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [token]);

  useEffect(() => {
    let isMounted = true;
    async function syncFromBackend() {
      try {
        // Hybrid Local-First Delta Sync: pull remote deltas to protect against ITP eviction
        pullRemoteDeltas(token, getLastSyncTimestamp())
          .then((deltaData) => {
            if (!isMounted || !deltaData) return;
            if (deltaData.meals && deltaData.meals.length > 0) {
              setMeals((prev) => {
                const map = new Map(prev.map((m) => [m.id, m]));
                for (const d of deltaData.meals) {
                  if (d.action === 'delete') {
                    map.delete(d.id);
                  } else if (!map.has(d.id)) {
                    map.set(d.id, {
                      id: d.id,
                      date: d.date,
                      slot: (d.slot as MealSlot) || 'lunch',
                      title: d.title || 'Synced Meal',
                      createdAt: d.updated_at || new Date().toISOString(),
                      items: [],
                      totalCalories: d.calories || 0,
                      minCalories: d.calories || 0,
                      maxCalories: d.calories || 0,
                      totalProtein: d.protein_g || 0,
                      totalCarbs: d.carbs_g || 0,
                      totalFat: d.fat_g || 0,
                      totalFiber: 0,
                      totalSugar: 0,
                      totalSodium: 0,
                      hasUnobservableFats: false,
                      hasAtwaterDiscrepancy: false,
                    });
                  }
                }
                return Array.from(map.values());
              });
            }
            if (deltaData.weights && deltaData.weights.length > 0) {
              setWeightLogs((prev) => {
                const map = new Map(prev.map((w) => [w.date, w]));
                for (const w of deltaData.weights) {
                  if (w.action === 'delete') {
                    map.delete(w.date);
                  } else if (!map.has(w.date)) {
                    map.set(w.date, {
                      id: w.id,
                      date: w.date,
                      weightKg: w.weight_kg,
                      smoothedWeightKg: w.weight_kg,
                      createdAt: w.updated_at || new Date().toISOString(),
                    });
                  }
                }
                return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
              });
            }
          })
          .catch(() => {});

        flushDeltaOutbox(token).catch(() => {});

        const [dayRes, weightsRes, repeatRes, bioRes] = await Promise.all([
          fetch(`/v1/days/${selectedDate}`, {
            headers: { Authorization: `Bearer ${token}` },
          }).then((r) => (r.ok ? r.json() : null)),
          fetch('/v1/weights', {
            headers: { Authorization: `Bearer ${token}` },
          }).then((r) => (r.ok ? r.json() : null)),
          fetch('/v1/repeat-meals', {
            headers: { Authorization: `Bearer ${token}` },
          }).then((r) => (r.ok ? r.json() : null)),
          fetch('/v1/biometrics', {
            headers: { Authorization: `Bearer ${token}` },
          }).then((r) => (r.ok ? r.json() : null)),
        ]);

        if (!isMounted) return;

        if (dayRes?.day) {
          const dayMeals = Array.isArray(dayRes.day.meals) ? dayRes.day.meals : [];
          setMeals((prev) => {
            const others = prev.filter((m) => m.date !== selectedDate);
            const currentLocal = prev.filter((m) => m.date === selectedDate);
            const mealMap = new Map<string, MealEntry>();
            const seenFingerprints = new Set<string>();
            const fingerprint = (m: MealEntry) =>
              `${m.date}|${m.slot}|${m.title}|${Math.round(m.totalCalories)}`;
            dayMeals.forEach((m: MealEntry) => {
              mealMap.set(m.id, m);
              seenFingerprints.add(fingerprint(m));
            });
            currentLocal.forEach((m) => {
              if (!mealMap.has(m.id) && !seenFingerprints.has(fingerprint(m))) {
                mealMap.set(m.id, m);
                seenFingerprints.add(fingerprint(m));
              }
            });
            return [...others, ...Array.from(mealMap.values())];
          });
          if (typeof dayRes.day.waterMl === 'number') {
            const water = Math.max(0, dayRes.day.waterMl);
            setWaterByDate((prev) => ({ ...prev, [selectedDate]: water }));
          }
        }

        if (weightsRes?.weights && weightsRes.weights.length > 0) {
          setWeightLogs((prev) => {
            const map = new Map<string, WeightLogEntry>();
            weightsRes.weights.forEach((w: WeightLogEntry) => map.set(w.date, w));
            prev.forEach((w) => {
              if (!map.has(w.date)) {
                map.set(w.date, w);
              }
            });
            return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
          });
        }

        if (repeatRes?.repeatMeals && repeatRes.repeatMeals.length > 0) {
          setRepeatMeals(repeatRes.repeatMeals);
        }

        if (bioRes?.biometrics) {
          setBiometrics((prev) => {
            const incoming = bioRes.biometrics;
            const targetCalories = incoming.targetCalories || prev.targetCalories || 2245;
            const derived = deriveTargets(targetCalories, incoming.macroSplit);
            const targetProtein = incoming.targetProtein || derived.protein;
            const targetFat = incoming.targetFat || derived.fat;
            const targetCarbs = incoming.targetCarbs || derived.carbs;
            const bmr = incoming.bmr || prev.bmr || calculateMifflinStJeorBmr(incoming.gender || prev.gender, incoming.weightKg || prev.weightKg, incoming.heightCm || prev.heightCm, incoming.age || prev.age);
            const baselineTdee = incoming.baselineTdee || prev.baselineTdee || Math.round(bmr * 1.55);
            return {
              ...prev,
              ...incoming,
              bmr,
              baselineTdee,
              adaptiveTdee: incoming.adaptiveTdee || prev.adaptiveTdee || baselineTdee,
              targetCalories,
              targetProtein,
              targetCarbs,
              targetFat,
              onboarded: incoming.onboarded ?? prev.onboarded ?? true,
            };
          });
        }
      } catch {
        // Silently preserve local offline/standalone state
      }
    }
    syncFromBackend();
    return () => {
      isMounted = false;
    };
  }, [selectedDate, token]);

  const currentDay: DaySummary = useMemo(() => {
    const dayMeals = meals.filter((m) => m.date === selectedDate);
    const allItems = dayMeals.flatMap((m) => m.items || []);

    const totalCalories = allItems.reduce((s, i) => s + (i.calories || 0), 0);
    const totalProtein = Number(allItems.reduce((s, i) => s + (i.protein || 0), 0).toFixed(1));
    const totalCarbs = Number(allItems.reduce((s, i) => s + (i.carbs || 0), 0).toFixed(1));
    const totalFat = Number(allItems.reduce((s, i) => s + (i.fat || 0), 0).toFixed(1));
    const totalFiber = Number(allItems.reduce((s, i) => s + (i.fiber || 0), 0).toFixed(1));
    const totalSugar = Number(allItems.reduce((s, i) => s + (i.sugar || 0), 0).toFixed(1));
    const totalSodium = Math.round(allItems.reduce((s, i) => s + (i.sodium || 0), 0));

    return {
      date: selectedDate,
      totalCalories,
      totalProtein,
      totalCarbs,
      totalFat,
      totalFiber,
      totalSugar,
      totalSodium,
      waterMl: waterByDate[selectedDate] ?? 0,
      meals: dayMeals,
      updatedAt: new Date().toISOString(),
    };
  }, [meals, selectedDate, waterByDate]);

  const updateBiometrics = (next: Partial<UserBiometrics>) => {
    setBiometrics((prev) => {
      const merged = { ...prev, ...next };
      const bmr = calculateMifflinStJeorBmr(
        merged.gender,
        merged.weightKg,
        merged.heightCm,
        merged.age
      );
      const baselineTdee = Math.round(bmr * ACTIVITY_MULTIPLIERS[merged.activityLevel]);
      const targetCalories = calculateTargetCaloriesWithFloor(
        baselineTdee,
        merged.gender,
        merged.goalMode
      );
      const derived = deriveTargets(targetCalories);
      const targetProtein = next.targetProtein ?? derived.protein;
      const targetFat = next.targetFat ?? derived.fat;
      const targetCarbs = next.targetCarbs ?? derived.carbs;

      return {
        ...merged,
        bmr,
        baselineTdee,
        adaptiveTdee: merged.adaptiveTdee || baselineTdee,
        targetCalories,
        targetProtein,
        targetCarbs,
        targetFat,
      };
    });

    fetch('/v1/biometrics', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(next),
    }).catch(() => {});
  };

  const addWaterMl = (deltaMl: number) => {
    setWaterByDate((prev) => ({
      ...prev,
      [selectedDate]: Math.max(0, (prev[selectedDate] ?? 0) + deltaMl),
    }));

    fetch(`/v1/days/${selectedDate}/water`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ deltaMl }),
    }).catch(() => {
      enqueueMutation('LOG_WATER', {
        date: selectedDate,
        deltaMl,
      });
    });
  };

  const addManualMeal = (
    slot: MealSlot,
    title: string,
    rawItems: Partial<FoodItemEntry>[]
  ): MealEntry => {
    const items = rawItems.map((i) =>
      normalizeFoodItem({ ...i, name: i.name || 'Custom Food Item' })
    );
    const meal: MealEntry = {
      id: `meal-${Date.now()}`,
      date: selectedDate,
      slot,
      title,
      createdAt: new Date().toISOString(),
      items,
      totalCalories: items.reduce((s, i) => s + i.calories, 0),
      minCalories: items.reduce((s, i) => s + i.minCalories, 0),
      maxCalories: items.reduce((s, i) => s + i.maxCalories, 0),
      totalProtein: Number(items.reduce((s, i) => s + i.protein, 0).toFixed(1)),
      totalCarbs: Number(items.reduce((s, i) => s + i.carbs, 0).toFixed(1)),
      totalFat: Number(items.reduce((s, i) => s + i.fat, 0).toFixed(1)),
      totalFiber: Number(items.reduce((s, i) => s + i.fiber, 0).toFixed(1)),
      totalSugar: Number(items.reduce((s, i) => s + i.sugar, 0).toFixed(1)),
      totalSodium: Math.round(items.reduce((s, i) => s + i.sodium, 0)),
      hasUnobservableFats: items.some((i) => i.cookingFatCategory === 'unobservable_unknown'),
      hasAtwaterDiscrepancy: items.some((i) => i.hasAtwaterDiscrepancy),
    };
    setMeals((prev) => [...prev, meal]);
    // Queue compact delta for hybrid local-first edge sync
    queueMealDelta(meal, 'upsert').catch(() => {});
    flushDeltaOutbox(token).catch(() => {});

    fetch('/v1/meals/manual', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        id: meal.id,
        date: selectedDate,
        slot,
        title,
        items,
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.meal?.id && data.meal.id !== meal.id) {
          setMeals((prev) =>
            prev.map((m) => (m.id === meal.id ? { ...m, id: data.meal.id } : m))
          );
        }
      })
      .catch(() => {
        enqueueMutation('LOG_MEAL', {
          date: selectedDate,
          slot,
          title,
          items,
        });
      });
    return meal;
  };

  const deleteMeal = (mealId: string) => {
    setMeals((prev) => prev.filter((m) => m.id !== mealId));
    queueMealDelta({ id: mealId, date: selectedDate }, 'delete').catch(() => {});
    flushDeltaOutbox(token).catch(() => {});
    fetch(`/v1/meals/${mealId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  };

  const clearDayMeals = (dateToClear?: string) => {
    const targetDate = dateToClear || selectedDate;
    const mealsToDelete = meals.filter((m) => m.date === targetDate);
    const currentWater = waterByDate[targetDate] || 0;
    setMeals((prev) => prev.filter((m) => m.date !== targetDate));
    setWaterByDate((prev) => ({ ...prev, [targetDate]: 0 }));
    if (currentWater > 0) {
      fetch(`/v1/days/${targetDate}/water`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ deltaMl: -currentWater }),
      }).catch(() => {});
    }
    for (const m of mealsToDelete) {
      fetch(`/v1/meals/${m.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
  };

  const loadSampleDay = (dateToSeed?: string) => {
    const targetDate = dateToSeed || selectedDate;
    const seeded = SEED_INITIAL_MEALS.map((m) => ({
      ...m,
      id: `seed-${m.slot}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      date: targetDate,
    }));
    setMeals((prev) => [...prev.filter((m) => m.date !== targetDate), ...seeded]);
    setWaterByDate((prev) => ({ ...prev, [targetDate]: 1750 }));
  };

  const copyRepeatMealToToday = (mealId: string, targetSlot?: MealSlot) => {
    const source = repeatMeals.find((m) => m.id === mealId) || meals.find((m) => m.id === mealId);
    if (!source) return;
    addManualMeal(targetSlot || source.slot, source.title, source.items);
    fetch('/v1/meals/copy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        sourceMealId: mealId,
        targetDate: selectedDate,
        targetSlot: targetSlot || source.slot,
      }),
    }).catch(() => {});
  };

  const startPhotoDraft = (
    slot: MealSlot,
    thumbnailDataUrl?: string,
    contextNote?: string,
    scanMode?: 'plate_vision' | 'nutrition_label_ocr',
    fullImageDataUrl?: string
  ): PhotoDraft => {
    const draftId = `draft-${Date.now()}`;
    const initialItems = buildDemoRecognizedItems();
    const isLabel = scanMode === 'nutrition_label_ocr' || (thumbnailDataUrl?.includes('label') ?? false);
    let recognizedItems = initialItems;
    let mealTitle = isLabel
      ? 'Packaged Protein Bar / Greek Yogurt (OCR Nutrition Label)'
      : 'Grilled Paneer / Chicken Tikka Bowl with Basmati Rice, Dal Makhani & Kachumber Salad';

    if (contextNote && contextNote.trim().length > 2 && !contextNote.includes('Indian-fusion bowl')) {
      const parsed = parseNaturalLanguageMeal(contextNote.trim(), slot, auth?.user?.uid);
      recognizedItems = parsed.recognizedItems;
      mealTitle = parsed.mealTitle || contextNote.trim();
    } else if (isLabel) {
      recognizedItems = [
        normalizeFoodItem({
          id: 'rec-ocr-1',
          name: 'High-Protein Almond Fudge Crunch Bar',
          grams: 60,
          tier: 2,
          tierSource: 'Vision OCR Nutrition Label',
          confidence: 0.98,
          reportedCalories: 210,
          protein: 20.0,
          carbs: 18.0,
          fat: 7.0,
          fiber: 9.0,
          sugar: 1.5,
          sodium: 140,
          cookingFatCategory: 'observable_low',
          scanMode: 'nutrition_label_ocr',
          servingMultiplier: 1.0,
        }),
      ];
    }

    const draft: PhotoDraft = {
      id: draftId,
      uid: auth?.user?.uid || 'user-local',
      date: selectedDate,
      slot,
      status: 'ready_for_review',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      imageBase64: fullImageDataUrl || thumbnailDataUrl,
      thumbnailDataUrl,
      contextNote,
      scanMode: isLabel ? 'nutrition_label_ocr' : 'plate_vision',
      servingMultiplier: 1.0,
      mealTitle,
      referenceAnchor: isLabel ? 'package_label' : 'indian_katori_150ml',
      recognizedItems,
      questions: DEMO_INDIAN_FUSION_QUESTIONS.map((q: ClarifyingQuestion) => ({
        ...q,
        options: q.options.map((o) => ({ ...o })),
      })),
      isDemoMode: true,
    };
    setActiveDraft(draft);

    if (thumbnailDataUrl || fullImageDataUrl) {
      const payloadImage = fullImageDataUrl || thumbnailDataUrl;
      fetch('/v1/ai/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          slot,
          date: selectedDate,
          imageBase64: payloadImage?.startsWith('data:image/')
            ? payloadImage
            : 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/',
          thumbnailDataUrl,
          contextNote,
          scanMode: draft.scanMode,
        }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.draft && Array.isArray(data.draft.recognizedItems) && data.draft.recognizedItems.length > 0) {
            // Preserve user's sample-meal demo preview when contextNote explicitly asks for demo Indian-fusion bowl
            if (contextNote && contextNote.includes('Indian-fusion bowl')) {
              setActiveDraft((prev) => (prev ? { ...prev, id: data.draftId || prev.id } : null));
            } else {
              setActiveDraft((prev) =>
                prev
                  ? {
                      ...prev,
                      ...data.draft,
                      id: data.draftId || data.draft.id || prev.id,
                      thumbnailDataUrl: prev.thumbnailDataUrl || data.draft.thumbnailDataUrl,
                    }
                  : null
              );
            }
          } else if (data?.draftId) {
            setActiveDraft((prev) => (prev ? { ...prev, id: data.draftId } : null));
          }
        })
        .catch(() => {});
    }

    return draft;
  };

  const updateDraftItemGrams = (itemId: string, newGrams: number) => {
    setActiveDraft((prev) => {
      if (!prev) return null;
      const targetGrams = Math.max(1, Math.round(newGrams));
      const items = prev.recognizedItems.map((item) => {
        if (item.id === itemId) {
          const ratio = targetGrams / (item.grams || 100);
          return normalizeFoodItem({
            ...item,
            grams: targetGrams,
            protein: Number((item.protein * ratio).toFixed(1)),
            carbs: Number((item.carbs * ratio).toFixed(1)),
            fat: Number((item.fat * ratio).toFixed(1)),
            fiber: Number(((item.fiber || 0) * ratio).toFixed(1)),
            sugar: Number(((item.sugar || 0) * ratio).toFixed(1)),
            sodium: Math.round((item.sodium || 0) * ratio),
            calories: undefined,
            minCalories: undefined,
            maxCalories: undefined,
            reportedCalories: Math.round(item.calories * ratio),
            tier: 3,
            tierSource: 'Personal Portion Calibration Memory',
          });
        }
        return item;
      });
      return {
        ...prev,
        recognizedItems: items,
        updatedAt: new Date().toISOString(),
      };
    });
  };

  const applyServingMultiplier = (itemId: string, multiplier: number) => {
    setActiveDraft((prev) => {
      if (!prev) return null;
      const mult = Math.max(0.1, multiplier);
      const items = prev.recognizedItems.map((item) => {
        if (item.id === itemId) {
          const baseServingGrams = (item as any).baseServingGrams || item.grams || 100;
          const targetGrams = Math.max(1, Math.round(baseServingGrams * mult));
          const ratio = targetGrams / (item.grams || 100);
          return normalizeFoodItem({
            ...item,
            grams: targetGrams,
            protein: Number((item.protein * ratio).toFixed(1)),
            carbs: Number((item.carbs * ratio).toFixed(1)),
            fat: Number((item.fat * ratio).toFixed(1)),
            fiber: Number(((item.fiber || 0) * ratio).toFixed(1)),
            sugar: Number(((item.sugar || 0) * ratio).toFixed(1)),
            sodium: Math.round((item.sodium || 0) * ratio),
            calories: undefined,
            minCalories: undefined,
            maxCalories: undefined,
            reportedCalories: Math.round(item.calories * ratio),
          } as any);
        }
        return item;
      });
      return {
        ...prev,
        servingMultiplier: mult,
        recognizedItems: items,
        updatedAt: new Date().toISOString(),
      };
    });
  };

  const applyMacroDeltaChip = (
    itemId: string,
    _deltaKcal: number,
    deltaFat: number,
    deltaCarbs: number = 0,
    deltaProt: number = 0
  ) => {
    setActiveDraft((prev) => {
      if (!prev) return null;
      const items = prev.recognizedItems.map((item) => {
        if (item.id === itemId) {
          return normalizeFoodItem({
            ...item,
            fat: Math.max(0, Number((item.fat + deltaFat).toFixed(1))),
            carbs: Math.max(0, Number((item.carbs + deltaCarbs).toFixed(1))),
            protein: Math.max(0, Number((item.protein + deltaProt).toFixed(1))),
            reportedCalories: 0,
          });
        }
        return item;
      });
      return {
        ...prev,
        recognizedItems: items,
        updatedAt: new Date().toISOString(),
      };
    });
  };

  const startTextDraft = async (
    mealDescription: string,
    slotHint?: MealSlot
  ): Promise<PhotoDraft | null> => {
    const slot = slotHint || 'lunch';
    try {
      const res = await fetch('/v1/ai/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          mealDescription,
          slot,
          slotHint: slot,
          date: selectedDate,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data?.draft) {
          setActiveDraft(data.draft);
          return data.draft;
        }
      }
    } catch (err) {
      console.warn('[DietContext] Failed to call /v1/ai/analyze:', err);
    }

    const fallbackDraft = parseNaturalLanguageMeal(mealDescription, slot, auth?.user?.uid || 'user-local');
    setActiveDraft(fallbackDraft);
    return fallbackDraft;
  };

  const answerClarifyingQuestion = (questionId: string, optionId: string) => {
    setActiveDraft((prev) => {
      if (!prev) return null;
      const questions = prev.questions.map((q) => ({ ...q, options: [...q.options] }));
      const items = [...prev.recognizedItems];
      const q = questions.find((item) => item.id === questionId);
      if (q) {
        const prevOpt = q.options.find((o) => o.id === q.selectedOptionId);
        const nextOpt = q.options.find((o) => o.id === optionId);
        if (nextOpt && items.length > 0) {
          q.selectedOptionId = optionId;
          const targetIndex = q.targetItemId
            ? items.findIndex((i) => i.id === q.targetItemId)
            : 0;
          const finalIndex = targetIndex !== -1 ? targetIndex : 0;
          const targetItem = items[finalIndex];
          const fatDiff = nextOpt.fatDeltaGrams - (prevOpt?.fatDeltaGrams || 0);
          const carbDiff = nextOpt.carbDeltaGrams - (prevOpt?.carbDeltaGrams || 0);
          const protDiff = nextOpt.proteinDeltaGrams - (prevOpt?.proteinDeltaGrams || 0);
          items[finalIndex] = normalizeFoodItem({
            ...targetItem,
            fat: Math.max(0, targetItem.fat + fatDiff),
            carbs: Math.max(0, targetItem.carbs + carbDiff),
            protein: Math.max(0, targetItem.protein + protDiff),
            reportedCalories: 0,
          });
        }
      }
      return {
        ...prev,
        questions,
        recognizedItems: items,
        updatedAt: new Date().toISOString(),
      };
    });
  };

  const confirmActiveDraft = (overrideMultiplier?: number): MealEntry | null => {
    if (!activeDraft) return null;
    const mult = overrideMultiplier && overrideMultiplier > 0
      ? overrideMultiplier
      : (activeDraft.servingMultiplier || 1);

    const targetTotalCalories = Math.round(
      activeDraft.recognizedItems.reduce((sum, i) => sum + i.calories, 0) * mult
    );

    // Largest-remainder calorie allocation so every scaled item stays within ±0.5 kcal
    // and the committed meal total matches the previewed total to the exact calorie.
    const scaledCalories: number[] = (() => {
      if (mult === 1) return activeDraft.recognizedItems.map((i) => i.calories);
      const exacts = activeDraft.recognizedItems.map((i, idx) => {
        const raw = i.calories * mult;
        const floor = Math.floor(raw);
        return { idx, raw, floor, rem: raw - floor };
      });
      const floorSum = exacts.reduce((s, e) => s + e.floor, 0);
      let remainder = targetTotalCalories - floorSum;
      const result = exacts.map((e) => e.floor);
      const byRem = [...exacts].sort((a, b) => b.rem - a.rem || b.raw - a.raw);
      for (let k = 0; k < byRem.length && remainder > 0; k++) {
        result[byRem[k].idx] += 1;
        remainder -= 1;
      }
      return result;
    })();

    const finalItems = activeDraft.recognizedItems.map((item, idx) => {
      if (mult === 1) return item;
      return normalizeFoodItem({
        ...item,
        grams: Math.max(1, Math.round(item.grams * mult)),
        protein: Number((item.protein * mult).toFixed(1)),
        carbs: Number((item.carbs * mult).toFixed(1)),
        fat: Number((item.fat * mult).toFixed(1)),
        fiber: Number(((item.fiber || 0) * mult).toFixed(1)),
        sugar: Number(((item.sugar || 0) * mult).toFixed(1)),
        sodium: Math.round((item.sodium || 0) * mult),
        calories: undefined,
        minCalories: undefined,
        maxCalories: undefined,
        reportedCalories: scaledCalories[idx],
      });
    });

    const meal = addManualMeal(
      activeDraft.slot,
      activeDraft.mealTitle || 'AI Vision Logged Meal',
      finalItems
    );
    const draftToConfirm = activeDraft;
    setActiveDraft(null);

    fetch(`/v1/drafts/${draftToConfirm.id}/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        mealId: meal.id,
        date: draftToConfirm.date || selectedDate,
        slot: draftToConfirm.slot,
        title: draftToConfirm.mealTitle,
        items: finalItems,
      }),
    }).catch(() => {});

    return meal;
  };

  const logScaleWeight = (date: string, weightKg: number): WeightLogEntry => {
    const prev = weightLogs[weightLogs.length - 1];
    const smoothedWeightKg = computeEwmaWeight(weightKg, prev?.smoothedWeightKg, 0.12);
    const entry: WeightLogEntry = {
      id: `w-${Date.now()}`,
      date,
      weightKg,
      smoothedWeightKg,
      createdAt: new Date().toISOString(),
    };
    setWeightLogs((list) => {
      const idx = list.findIndex((item) => item.date === date);
      if (idx >= 0) {
        const copy = [...list];
        copy[idx] = entry;
        return copy;
      }
      return [...list, entry];
    });
    updateBiometrics({ weightKg });
    // Queue compact delta for hybrid local-first edge sync
    queueWeightDelta(entry, 'upsert').catch(() => {});
    flushDeltaOutbox(token).catch(() => {});

    fetch('/v1/weights', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        date,
        weightKg,
      }),
    }).catch(() => {});

    return entry;
  };

  const submitSupportTicket = (
    category: SupportTicket['category'],
    subject: string,
    message: string
  ): SupportTicket => {
    const ticket: SupportTicket = {
      id: `TKT-${Date.now().toString().slice(-6)}`,
      uid: auth?.user?.uid || 'demo-user-uid',
      category,
      subject,
      message,
      status: 'open',
      createdAt: new Date().toISOString(),
    };
    setSupportTickets((prev) => [ticket, ...prev]);

    fetch('/v1/support', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        category,
        subject,
        message,
      }),
    }).catch(() => {});

    return ticket;
  };

  const resolveSupportTicket = (ticketId: string) => {
    setSupportTickets((prev) =>
      prev.map((t) =>
        t.id === ticketId
          ? { ...t, status: 'resolved', resolvedAt: new Date().toISOString(), resolvedBy: 'admin' }
          : t
      )
    );
  };

  const eraseAllUserData = () => {
    setMeals([]);
    setWaterByDate({});
    setActiveDraft(null);
    setWeightLogs([]);
    setRepeatMeals([]);
    setSupportTickets([]);
    clearDeltaOutbox().catch(() => {});
    try {
      localStorage.removeItem(VIBEDIET_STORAGE_KEY_V1);
      localStorage.removeItem('vibediet_diary_state_v3');
      localStorage.removeItem('vibediet_onboarding');
      localStorage.removeItem('vibediet_water');
      localStorage.removeItem('vibediet_biometrics');
    } catch {}
    fetch('/v1/user/data', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  };

  return (
    <DietContext.Provider
      value={{
        selectedDate,
        setSelectedDate,
        biometrics,
        updateBiometrics,
        currentDay,
        repeatMeals,
        weightLogs,
        activeDraft,
        supportTickets,
        addWaterMl,
        addManualMeal,
        deleteMeal,
        clearDayMeals,
        loadSampleDay,
        copyRepeatMealToToday,
        startPhotoDraft,
        updateDraftItemGrams,
        applyServingMultiplier,
        applyMacroDeltaChip,
        startTextDraft,
        answerClarifyingQuestion,
        confirmActiveDraft,
        logScaleWeight,
        submitSupportTicket,
        resolveSupportTicket,
        eraseAllUserData,
      }}
    >
      {children}
    </DietContext.Provider>
  );
};

export function useDiet(): DietContextValue {
  const ctx = useContext(DietContext);
  if (!ctx) throw new Error('useDiet must be used within DietProvider');
  return ctx;
}
