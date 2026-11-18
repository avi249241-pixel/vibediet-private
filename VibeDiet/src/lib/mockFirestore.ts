import { DaySummary, MealEntry, SupportTicket, UserBiometrics, WeightLogEntry } from '../types/index.js';
import { PhotoDraft } from '../shared/draftTypes.js';
import { DEFAULT_USER_BIOMETRICS, SEED_INITIAL_MEALS, SEED_REPEAT_MEALS, SEED_WEIGHT_LOGS } from '../data/mockData.js';
import { dateKey } from '../shared/physics/atwater.js';

export interface UserStoreBucket {
  days: Map<string, DaySummary>;
  meals: Map<string, MealEntry>;
  drafts: Map<string, PhotoDraft>;
  weights: WeightLogEntry[];
  repeatMeals: MealEntry[];
  biometrics?: UserBiometrics;
}

class InMemoryMockFirestore {
  private users = new Map<string, UserStoreBucket>();
  private supportTickets = new Map<string, SupportTicket>();

  constructor() {
    this.seedDefaultUser('demo-user-uid');
  }

  public getUserBucket(uid: string): UserStoreBucket {
    let bucket = this.users.get(uid);
    if (!bucket) {
      const initialMealsMap = new Map<string, MealEntry>();
      const today = dateKey();
      const isDemoUser = uid === 'demo-user-uid' || uid === 'guest-local-uid' || uid === 'demo-user';
      if (isDemoUser) {
        for (const m of SEED_INITIAL_MEALS) {
          initialMealsMap.set(m.id, { ...m, date: today });
        }
      }
      bucket = {
        days: new Map(),
        meals: initialMealsMap,
        drafts: new Map(),
        weights: [...SEED_WEIGHT_LOGS],
        repeatMeals: [...SEED_REPEAT_MEALS],
        biometrics: { ...DEFAULT_USER_BIOMETRICS },
      };
      this.users.set(uid, bucket);
      this.recomputeDay(uid, today);
    }
    return bucket;
  }

  public eraseUserBucket(uid: string): void {
    const bucket = this.users.get(uid);
    if (bucket) {
      bucket.days.clear();
      bucket.meals.clear();
      bucket.drafts.clear();
      bucket.weights = [];
      bucket.repeatMeals = [];
      bucket.biometrics = { ...DEFAULT_USER_BIOMETRICS };
    }
    this.users.delete(uid);
  }

  public seedDefaultUser(uid: string): void {
    this.users.delete(uid);
    this.getUserBucket(uid);
  }

  public recomputeDay(uid: string, date: string, overrideMeals?: MealEntry[]): DaySummary {
    const bucket = this.getUserBucket(uid);
    if (overrideMeals) {
      for (const meal of overrideMeals) {
        bucket.meals.set(meal.id, meal);
      }
    }

    const dayMeals = Array.from(bucket.meals.values()).filter((m) => m.date === date);
    const existingDay = bucket.days.get(date);

    const summary: DaySummary = {
      date,
      totalCalories: dayMeals.reduce((acc, m) => acc + m.totalCalories, 0),
      totalProtein: Number(dayMeals.reduce((acc, m) => acc + m.totalProtein, 0).toFixed(1)),
      totalCarbs: Number(dayMeals.reduce((acc, m) => acc + m.totalCarbs, 0).toFixed(1)),
      totalFat: Number(dayMeals.reduce((acc, m) => acc + m.totalFat, 0).toFixed(1)),
      totalFiber: Number(dayMeals.reduce((acc, m) => acc + m.totalFiber, 0).toFixed(1)),
      totalSugar: Number(dayMeals.reduce((acc, m) => acc + m.totalSugar, 0).toFixed(1)),
      totalSodium: Math.round(dayMeals.reduce((acc, m) => acc + m.totalSodium, 0)),
      waterMl: existingDay?.waterMl ?? 0,
      meals: dayMeals,
      updatedAt: new Date().toISOString(),
    };

    bucket.days.set(date, summary);
    return summary;
  }

  public async runTransaction<T>(fn: (store: this) => Promise<T> | T): Promise<T> {
    return await fn(this);
  }

  public createSupportTicket(ticket: SupportTicket): SupportTicket {
    this.supportTickets.set(ticket.id, ticket);
    return ticket;
  }

  public listSupportTickets(): SupportTicket[] {
    return Array.from(this.supportTickets.values()).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
  }

  public resolveSupportTicket(ticketId: string, adminUid: string): SupportTicket | null {
    const ticket = this.supportTickets.get(ticketId);
    if (!ticket) return null;
    ticket.status = 'resolved';
    ticket.resolvedAt = new Date().toISOString();
    ticket.resolvedBy = adminUid;
    this.supportTickets.set(ticketId, ticket);
    return ticket;
  }

  public getAllDraftsAcrossUsers(): PhotoDraft[] {
    const all: PhotoDraft[] = [];
    for (const bucket of this.users.values()) {
      for (const draft of bucket.drafts.values()) {
        all.push(draft);
      }
    }
    return all;
  }

  public resetForTests(): void {
    this.users.clear();
    this.supportTickets.clear();
    this.seedDefaultUser('demo-user-uid');
  }
}

export const mockDb = new InMemoryMockFirestore();
