import { createRequire } from 'node:module';
import type admin from 'firebase-admin';
import { mockDb } from './mockFirestore.js';
import {
  DaySummary,
  MealEntry,
  SupportTicket,
  UserBiometrics,
  WeightLogEntry,
} from '../types/index.js';
import { PhotoDraft } from '../shared/draftTypes.js';
import { env } from '../config/env.js';
import { DEFAULT_USER_BIOMETRICS } from '../data/mockData.js';
import {
  FirestoreBiometricsSchema,
  FirestoreDaySummarySchema,
  FirestoreMealSchema,
  FirestorePhotoDraftSchema,
  FirestoreSupportTicketSchema,
  FirestoreWeightLogSchema,
} from '../schemas/v1.js';
import {
  getPostgresPool,
  isUsingPostgres,
  postgresRepository,
  readAtomicTenantFile,
  writeAtomicTenantFile,
  deleteAtomicTenantFile,
  getDataDir,
  setDataDir,
  TenantFileStore,
} from '../persistence/postgresRepository.js';
import { PortionCalibration, normalizeFoodKey } from '../services/portionMemory.js';

const requireModule = createRequire(import.meta.url);

let firestoreInstance: admin.firestore.Firestore | null = null;
let isRealFirestoreActive = false;
let initAttempted = false;

// Attempt PostgreSQL initialization asynchronously
getPostgresPool().catch(() => {});

/**
 * Initializes Firebase Admin SDK using standardized environment variables.
 * Gracefully falls back to local MockFirestore/Postgres if not present.
 */
export function getFirestoreDb(): admin.firestore.Firestore | null {
  if (initAttempted) return firestoreInstance;
  initAttempted = true;

  const projectId = env.FIREBASE_PROJECT_ID;
  const serviceAccountKey = env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const googleAppCreds = env.GOOGLE_APPLICATION_CREDENTIALS;
  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;

  if (!projectId && !serviceAccountKey && !googleAppCreds && !emulatorHost) {
    isRealFirestoreActive = false;
    return null;
  }

  try {
    const admin = requireModule('firebase-admin');
    if (admin.apps.length === 0) {
      if (serviceAccountKey) {
        let creds: any;
        try {
          creds = JSON.parse(serviceAccountKey);
        } catch {
          creds = serviceAccountKey;
        }
        admin.initializeApp({
          credential: admin.credential.cert(creds),
          projectId: projectId || creds.project_id,
        });
      } else if (googleAppCreds) {
        admin.initializeApp({
          credential: admin.credential.applicationDefault(),
          projectId,
        });
      } else if (emulatorHost) {
        admin.initializeApp({
          projectId: projectId || 'demo-project',
        });
      } else {
        isRealFirestoreActive = false;
        return null;
      }
    }

    if (admin.apps.length > 0) {
      firestoreInstance = admin.firestore();
      isRealFirestoreActive = true;
      console.log(
        `[Firebase Admin] Cloud Firestore connected for project: ${
          admin.app().options.projectId || 'default'
        }`
      );
      return firestoreInstance;
    }
  } catch (err: any) {
    console.warn(
      `[Firebase Admin] Cloud Firestore initialization bypassed (${
        err?.message || err
      }). Falling back to local/postgres store.`
    );
  }

  isRealFirestoreActive = false;
  return null;
}

export function isUsingRealFirestore(): boolean {
  if (!initAttempted) {
    getFirestoreDb();
  }
  return isRealFirestoreActive && firestoreInstance !== null;
}

/**
 * Helper to sync in-memory user bucket with atomic disk file
 */
function syncTenantToDisk(uid: string): void {
  try {
    const bucket = mockDb.getUserBucket(uid);
    const tenantData: TenantFileStore = {
      userId: uid,
      meals: Object.fromEntries(bucket.meals.entries()),
      days: Object.fromEntries(bucket.days.entries()),
      drafts: Object.fromEntries(bucket.drafts.entries()),
      weights: bucket.weights,
      repeatMeals: bucket.repeatMeals,
      biometrics: bucket.biometrics,
      portionCalibrations: {},
    };
    writeAtomicTenantFile(uid, tenantData);
  } catch {}
}

/**
 * Unified DataStore abstraction with STRICT SCHEMA VALIDATION on all mutations.
 * Enforces multi-tenant user isolation partitioned by userId, supporting PostgreSQL,
 * Cloud Firestore, and Atomic Disk persistence.
 */
export const dataStore = {
  getDataDir(): string {
    return getDataDir();
  },
  setDataDir(dir: string | null): void {
    setDataDir(dir);
  },
  // DRAFTS: /users/{uid}/drafts/{draftId}
  async getDraft(uid: string, draftId: string): Promise<PhotoDraft | null> {
    if (isUsingPostgres()) {
      const pgDraft = await postgresRepository.getDraft(uid, draftId);
      if (pgDraft) return pgDraft;
    }

    const db = getFirestoreDb();
    if (db) {
      try {
        const snap = await db.collection('users').doc(uid).collection('drafts').doc(draftId).get();
        if (snap.exists) {
          const raw = snap.data();
          return FirestorePhotoDraftSchema.parse(raw) as PhotoDraft;
        }
      } catch (err) {
        console.warn(`[dataStore.getDraft] Firestore read failed, falling back to mockDb:`, err);
      }
    }
    return mockDb.getUserBucket(uid).drafts.get(draftId) || null;
  },

  async saveDraft(uid: string, draft: PhotoDraft): Promise<void> {
    const validated = FirestorePhotoDraftSchema.parse(draft) as PhotoDraft;

    if (isUsingPostgres()) {
      await postgresRepository.saveDraft(uid, validated);
    }

    const db = getFirestoreDb();
    if (db) {
      try {
        const cleanData = JSON.parse(JSON.stringify(validated));
        await db
          .collection('users')
          .doc(uid)
          .collection('drafts')
          .doc(validated.id)
          .set(cleanData, { merge: true });
      } catch (err) {
        console.warn(`[dataStore.saveDraft] Firestore write failed:`, err);
      }
    }

    mockDb.getUserBucket(uid).drafts.set(validated.id, validated);
    syncTenantToDisk(uid);
  },

  async getAllDraftsAcrossUsers(): Promise<PhotoDraft[]> {
    if (isUsingPostgres()) {
      const pgDrafts = await postgresRepository.getAllDrafts();
      if (pgDrafts.length > 0) return pgDrafts;
    }

    const db = getFirestoreDb();
    if (db) {
      try {
        const snap = await db.collectionGroup('drafts').get();
        if (!snap.empty) {
          return snap.docs
            .map((d) => {
              const res = FirestorePhotoDraftSchema.safeParse(d.data());
              return res.success ? (res.data as PhotoDraft) : null;
            })
            .filter((d): d is PhotoDraft => d !== null);
        }
      } catch (err) {
        console.warn(`[dataStore.getAllDraftsAcrossUsers] Firestore query failed:`, err);
      }
    }
    return mockDb.getAllDraftsAcrossUsers();
  },

  // MEALS: /users/{uid}/meals/{mealId}
  async getMeal(uid: string, mealId: string): Promise<MealEntry | null> {
    if (isUsingPostgres()) {
      const pgMeal = await postgresRepository.getMeal(uid, mealId);
      if (pgMeal) return pgMeal;
    }

    const db = getFirestoreDb();
    if (db) {
      try {
        const snap = await db.collection('users').doc(uid).collection('meals').doc(mealId).get();
        if (snap.exists) {
          const raw = snap.data();
          return FirestoreMealSchema.parse(raw) as MealEntry;
        }
      } catch (err) {
        console.warn(`[dataStore.getMeal] Firestore read failed:`, err);
      }
    }
    return mockDb.getUserBucket(uid).meals.get(mealId) || null;
  },

  async saveMeal(uid: string, meal: MealEntry): Promise<void> {
    const validated = FirestoreMealSchema.parse(meal) as MealEntry;

    if (isUsingPostgres()) {
      await postgresRepository.saveMeal(uid, validated);
    }

    const db = getFirestoreDb();
    if (db) {
      try {
        const cleanData = JSON.parse(JSON.stringify(validated));
        await db
          .collection('users')
          .doc(uid)
          .collection('meals')
          .doc(validated.id)
          .set(cleanData, { merge: true });
      } catch (err) {
        console.warn(`[dataStore.saveMeal] Firestore write failed:`, err);
      }
    }

    mockDb.getUserBucket(uid).meals.set(validated.id, validated);
    syncTenantToDisk(uid);
  },

  async deleteMeal(uid: string, mealId: string): Promise<void> {
    if (isUsingPostgres()) {
      await postgresRepository.deleteMeal(uid, mealId);
    }

    const db = getFirestoreDb();
    if (db) {
      try {
        await db.collection('users').doc(uid).collection('meals').doc(mealId).delete();
      } catch (err) {
        console.warn(`[dataStore.deleteMeal] Firestore delete failed:`, err);
      }
    }

    mockDb.getUserBucket(uid).meals.delete(mealId);
    syncTenantToDisk(uid);
  },

  async listMealsForDate(uid: string, date: string): Promise<MealEntry[]> {
    if (isUsingPostgres()) {
      const pgMeals = await postgresRepository.listMealsForDate(uid, date);
      if (pgMeals.length > 0) return pgMeals;
    }

    const db = getFirestoreDb();
    if (db) {
      try {
        const snap = await db
          .collection('users')
          .doc(uid)
          .collection('meals')
          .where('date', '==', date)
          .get();
        if (!snap.empty) {
          return snap.docs
            .map((d) => {
              const res = FirestoreMealSchema.safeParse(d.data());
              return res.success ? (res.data as MealEntry) : null;
            })
            .filter((m): m is MealEntry => m !== null);
        }
      } catch (err) {
        console.warn(`[dataStore.listMealsForDate] Firestore query failed:`, err);
      }
    }
    return Array.from(mockDb.getUserBucket(uid).meals.values()).filter((m) => m.date === date);
  },

  // DAYS: /users/{uid}/days/{date}
  async getDaySummary(uid: string, date: string): Promise<DaySummary> {
    const todayStr = new Date().toISOString().split('T')[0];
    if (isUsingPostgres()) {
      const pgDay = await postgresRepository.getDaySummary(uid, date);
      if (pgDay) {
        if (date !== todayStr && pgDay.waterMl === 1750 && (!pgDay.meals || pgDay.meals.length === 0)) {
          pgDay.waterMl = 0;
          await postgresRepository.saveDaySummary(uid, date, pgDay).catch(() => {});
        }
        return pgDay;
      }
    }

    const db = getFirestoreDb();
    if (db) {
      try {
        const snap = await db.collection('users').doc(uid).collection('days').doc(date).get();
        if (snap.exists) {
          const raw = snap.data();
          const parsed = FirestoreDaySummarySchema.safeParse(raw);
          if (parsed.success) {
            return parsed.data as DaySummary;
          }
        }
      } catch (err) {
        console.warn(`[dataStore.getDaySummary] Firestore read failed:`, err);
      }
    }
    return this.recomputeDay(uid, date);
  },

  async recomputeDay(uid: string, date: string): Promise<DaySummary> {
    const dayMeals = await this.listMealsForDate(uid, date);
    const existingBucketDay = mockDb.getUserBucket(uid).days.get(date);

    const summary: DaySummary = {
      date,
      totalCalories: dayMeals.reduce((acc, m) => acc + m.totalCalories, 0),
      totalProtein: Number(dayMeals.reduce((acc, m) => acc + m.totalProtein, 0).toFixed(1)),
      totalCarbs: Number(dayMeals.reduce((acc, m) => acc + m.totalCarbs, 0).toFixed(1)),
      totalFat: Number(dayMeals.reduce((acc, m) => acc + m.totalFat, 0).toFixed(1)),
      totalFiber: Number(dayMeals.reduce((acc, m) => acc + m.totalFiber, 0).toFixed(1)),
      totalSugar: Number(dayMeals.reduce((acc, m) => acc + m.totalSugar, 0).toFixed(1)),
      totalSodium: Math.round(dayMeals.reduce((acc, m) => acc + m.totalSodium, 0)),
      waterMl: (date === new Date().toISOString().split('T')[0] ? (existingBucketDay?.waterMl ?? 1750) : (existingBucketDay?.waterMl ?? 0)),
      meals: dayMeals,
      updatedAt: new Date().toISOString(),
    };

    const validated = FirestoreDaySummarySchema.parse(summary) as DaySummary;

    if (isUsingPostgres()) {
      await postgresRepository.saveDaySummary(uid, date, validated);
    }

    const db = getFirestoreDb();
    if (db) {
      try {
        const cleanData = JSON.parse(JSON.stringify(validated));
        await db
          .collection('users')
          .doc(uid)
          .collection('days')
          .doc(date)
          .set(cleanData, { merge: true });
      } catch (err) {
        console.warn(`[dataStore.recomputeDay] Firestore write failed:`, err);
      }
    }

    mockDb.getUserBucket(uid).days.set(date, validated);
    syncTenantToDisk(uid);
    return validated;
  },

  async updateWater(uid: string, date: string, deltaMl: number): Promise<DaySummary> {
    const existing = await this.getDaySummary(uid, date);
    const updatedWater = Math.max(0, (existing.waterMl ?? 0) + deltaMl);
    const updated: DaySummary = {
      ...existing,
      waterMl: updatedWater,
      updatedAt: new Date().toISOString(),
    };

    const validated = FirestoreDaySummarySchema.parse(updated) as DaySummary;

    if (isUsingPostgres()) {
      await postgresRepository.saveDaySummary(uid, date, validated);
    }

    const db = getFirestoreDb();
    if (db) {
      try {
        const cleanData = JSON.parse(JSON.stringify(validated));
        await db
          .collection('users')
          .doc(uid)
          .collection('days')
          .doc(date)
          .set(cleanData, { merge: true });
      } catch (err) {
        console.warn(`[dataStore.updateWater] Firestore write failed:`, err);
      }
    }

    mockDb.getUserBucket(uid).days.set(date, validated);
    syncTenantToDisk(uid);
    return validated;
  },

  // WEIGHTS: /users/{uid}/weights/{weightId}
  async getWeights(uid: string): Promise<WeightLogEntry[]> {
    if (isUsingPostgres()) {
      const pgWeights = await postgresRepository.getWeights(uid);
      if (pgWeights.length > 0) return pgWeights;
    }

    const db = getFirestoreDb();
    if (db) {
      try {
        const snap = await db
          .collection('users')
          .doc(uid)
          .collection('weights')
          .orderBy('date', 'asc')
          .get();
        if (!snap.empty) {
          return snap.docs
            .map((d) => {
              const res = FirestoreWeightLogSchema.safeParse(d.data());
              return res.success ? (res.data as WeightLogEntry) : null;
            })
            .filter((w): w is WeightLogEntry => w !== null);
        }
      } catch (err) {
        console.warn(`[dataStore.getWeights] Firestore query failed:`, err);
      }
    }
    return mockDb.getUserBucket(uid).weights;
  },

  async saveWeight(uid: string, entry: WeightLogEntry): Promise<WeightLogEntry[]> {
    const validated = FirestoreWeightLogSchema.parse(entry) as WeightLogEntry;

    if (isUsingPostgres()) {
      await postgresRepository.saveWeight(uid, validated);
    }

    const db = getFirestoreDb();
    if (db) {
      try {
        const cleanData = JSON.parse(JSON.stringify(validated));
        await db
          .collection('users')
          .doc(uid)
          .collection('weights')
          .doc(validated.id)
          .set(cleanData, { merge: true });
      } catch (err) {
        console.warn(`[dataStore.saveWeight] Firestore write failed:`, err);
      }
    }

    const bucket = mockDb.getUserBucket(uid);
    const existingIdx = bucket.weights.findIndex((w) => w.date === validated.date);
    if (existingIdx >= 0) {
      bucket.weights[existingIdx] = validated;
    } else {
      bucket.weights.push(validated);
    }
    syncTenantToDisk(uid);
    return bucket.weights;
  },

  // REPEAT MEALS: /users/{uid}/repeatMeals/{repeatId}
  async getRepeatMeals(uid: string): Promise<MealEntry[]> {
    if (isUsingPostgres()) {
      const pgRepeat = await postgresRepository.getRepeatMeals(uid);
      if (pgRepeat.length > 0) return pgRepeat;
    }

    const db = getFirestoreDb();
    if (db) {
      try {
        const snap = await db.collection('users').doc(uid).collection('repeatMeals').get();
        if (!snap.empty) {
          return snap.docs
            .map((d) => {
              const res = FirestoreMealSchema.safeParse(d.data());
              return res.success ? (res.data as MealEntry) : null;
            })
            .filter((m): m is MealEntry => m !== null);
        }
      } catch (err) {
        console.warn(`[dataStore.getRepeatMeals] Firestore query failed:`, err);
      }
    }
    return mockDb.getUserBucket(uid).repeatMeals;
  },

  async saveRepeatMeal(uid: string, meal: MealEntry): Promise<MealEntry[]> {
    const validated = FirestoreMealSchema.parse(meal) as MealEntry;

    if (isUsingPostgres()) {
      await postgresRepository.saveRepeatMeal(uid, validated);
    }

    const db = getFirestoreDb();
    if (db) {
      try {
        const cleanData = JSON.parse(JSON.stringify(validated));
        await db
          .collection('users')
          .doc(uid)
          .collection('repeatMeals')
          .doc(validated.id)
          .set(cleanData, { merge: true });
      } catch (err) {
        console.warn(`[dataStore.saveRepeatMeal] Firestore write failed:`, err);
      }
    }

    const bucket = mockDb.getUserBucket(uid);
    bucket.repeatMeals.unshift(validated);
    syncTenantToDisk(uid);
    return bucket.repeatMeals;
  },

  // PORTION CALIBRATIONS (Strictly partitioned per userId)
  async getPortionCalibration(uid: string, foodName: string): Promise<PortionCalibration | null> {
    const foodKey = normalizeFoodKey(foodName);
    if (isUsingPostgres()) {
      const pgCal = await postgresRepository.getPortionCalibration(uid, foodKey);
      if (pgCal) return pgCal;
    }
    const tenantFile = readAtomicTenantFile(uid);
    if (tenantFile?.portionCalibrations?.[foodKey]) {
      return tenantFile.portionCalibrations[foodKey];
    }
    return null;
  },

  async savePortionCalibration(
    uid: string,
    calibration: PortionCalibration
  ): Promise<PortionCalibration> {
    if (isUsingPostgres()) {
      await postgresRepository.savePortionCalibration(uid, calibration);
    }
    const tenantFile = readAtomicTenantFile(uid) || {
      userId: uid,
      meals: {},
      days: {},
      drafts: {},
      weights: [],
      repeatMeals: [],
      portionCalibrations: {},
    };
    tenantFile.portionCalibrations[calibration.foodKey] = calibration;
    writeAtomicTenantFile(uid, tenantFile);
    return calibration;
  },

  async getAllPortionCalibrations(uid: string): Promise<PortionCalibration[]> {
    if (isUsingPostgres()) {
      const pgAll = await postgresRepository.getAllPortionCalibrations(uid);
      if (pgAll.length > 0) return pgAll;
    }
    const tenantFile = readAtomicTenantFile(uid);
    if (tenantFile?.portionCalibrations) {
      return Object.values(tenantFile.portionCalibrations);
    }
    return [];
  },

  async clearUserPortionCalibrations(uid: string): Promise<void> {
    const tenantFile = readAtomicTenantFile(uid);
    if (tenantFile) {
      tenantFile.portionCalibrations = {};
      writeAtomicTenantFile(uid, tenantFile);
    }
  },

  // SUPPORT TICKETS: /supportTickets/{ticketId}
  async createSupportTicket(ticket: SupportTicket): Promise<SupportTicket> {
    const validated = FirestoreSupportTicketSchema.parse(ticket) as SupportTicket;

    if (isUsingPostgres()) {
      await postgresRepository.createSupportTicket(validated);
    }

    const db = getFirestoreDb();
    if (db) {
      try {
        const cleanData = JSON.parse(JSON.stringify(validated));
        await db.collection('supportTickets').doc(validated.id).set(cleanData);
      } catch (err) {
        console.warn(`[dataStore.createSupportTicket] Firestore write failed:`, err);
      }
    }
    return mockDb.createSupportTicket(validated);
  },

  async listSupportTickets(): Promise<SupportTicket[]> {
    if (isUsingPostgres()) {
      const pgTickets = await postgresRepository.listSupportTickets();
      if (pgTickets.length > 0) return pgTickets;
    }

    const db = getFirestoreDb();
    if (db) {
      try {
        const snap = await db
          .collection('supportTickets')
          .orderBy('createdAt', 'desc')
          .get();
        if (!snap.empty) {
          return snap.docs
            .map((d) => {
              const res = FirestoreSupportTicketSchema.safeParse(d.data());
              return res.success ? (res.data as SupportTicket) : null;
            })
            .filter((t): t is SupportTicket => t !== null);
        }
      } catch (err) {
        console.warn(`[dataStore.listSupportTickets] Firestore query failed:`, err);
      }
    }
    return mockDb.listSupportTickets();
  },

  async resolveSupportTicket(
    ticketId: string,
    adminUid: string
  ): Promise<SupportTicket | null> {
    if (isUsingPostgres()) {
      await postgresRepository.resolveSupportTicket(ticketId, adminUid);
    }

    const db = getFirestoreDb();
    if (db) {
      try {
        const now = new Date().toISOString();
        await db.collection('supportTickets').doc(ticketId).update({
          status: 'resolved',
          resolvedAt: now,
          resolvedBy: adminUid,
        });
      } catch (err) {
        console.warn(`[dataStore.resolveSupportTicket] Firestore update failed:`, err);
      }
    }
    return mockDb.resolveSupportTicket(ticketId, adminUid);
  },

  // BIOMETRICS: /users/{uid}/biometrics/profile
  async getBiometrics(uid: string): Promise<UserBiometrics> {
    if (isUsingPostgres()) {
      const pgBio = await postgresRepository.getBiometrics(uid);
      if (pgBio) return pgBio;
    }

    const db = getFirestoreDb();
    if (db) {
      try {
        const snap = await db.collection('users').doc(uid).collection('biometrics').doc('profile').get();
        if (snap.exists) {
          const parsed = FirestoreBiometricsSchema.safeParse(snap.data());
          if (parsed.success) {
            return parsed.data as UserBiometrics;
          }
        }
      } catch (err) {
        console.warn(`[dataStore.getBiometrics] Firestore read failed:`, err);
      }
    }
    const bucket = mockDb.getUserBucket(uid);
    return bucket.biometrics || { ...DEFAULT_USER_BIOMETRICS };
  },

  async saveBiometrics(uid: string, biometrics: UserBiometrics): Promise<UserBiometrics> {
    const validated = FirestoreBiometricsSchema.parse(biometrics) as UserBiometrics;

    if (isUsingPostgres()) {
      await postgresRepository.saveBiometrics(uid, validated);
    }

    const db = getFirestoreDb();
    if (db) {
      try {
        const cleanData = JSON.parse(JSON.stringify(validated));
        await db
          .collection('users')
          .doc(uid)
          .collection('biometrics')
          .doc('profile')
          .set(cleanData, { merge: true });
      } catch (err) {
        console.warn(`[dataStore.saveBiometrics] Firestore write failed:`, err);
      }
    }

    const bucket = mockDb.getUserBucket(uid);
    bucket.biometrics = validated;
    syncTenantToDisk(uid);
    return validated;
  },

  // GDPR / DPDP USER DATA PORTABILITY & FULL ERASURE
  async exportUserData(uid: string): Promise<Record<string, any>> {
    const biometrics = await this.getBiometrics(uid);
    const weights = await this.getWeights(uid);
    const repeatMeals = await this.getRepeatMeals(uid);
    const allTickets = await this.listSupportTickets();
    const userTickets = allTickets.filter((t) => t.uid === uid);

    let days: DaySummary[] = [];
    let meals: MealEntry[] = [];

    const db = getFirestoreDb();
    if (db) {
      try {
        const daysSnap = await db.collection('users').doc(uid).collection('days').get();
        days = daysSnap.docs
          .map((d) => {
            const res = FirestoreDaySummarySchema.safeParse(d.data());
            return res.success ? (res.data as DaySummary) : null;
          })
          .filter((d): d is DaySummary => d !== null);

        const mealsSnap = await db.collection('users').doc(uid).collection('meals').get();
        meals = mealsSnap.docs
          .map((d) => {
            const res = FirestoreMealSchema.safeParse(d.data());
            return res.success ? (res.data as MealEntry) : null;
          })
          .filter((m): m is MealEntry => m !== null);
      } catch (err) {
        console.warn(`[dataStore.exportUserData] Firestore read failed:`, err);
      }
    }

    if (days.length === 0) {
      const bucket = mockDb.getUserBucket(uid);
      days = Array.from(bucket.days.values());
      meals = Array.from(bucket.meals.values());
    }

    return {
      exportedAt: new Date().toISOString(),
      compliance: 'GDPR / DPDP Article 20 / Section 12 Portability Standard',
      uid,
      biometrics,
      days,
      meals,
      weights,
      repeatMeals,
      supportTickets: userTickets,
    };
  },

  async eraseUserData(uid: string): Promise<void> {
    if (isUsingPostgres()) {
      await postgresRepository.eraseUserData(uid);
    }

    const db = getFirestoreDb();
    if (db) {
      try {
        const subcollections = ['days', 'meals', 'drafts', 'weights', 'repeatMeals', 'biometrics', 'healthMetrics'];
        for (const sub of subcollections) {
          const snap = await db.collection('users').doc(uid).collection(sub).get();
          const batch = db.batch();
          for (const doc of snap.docs) {
            batch.delete(doc.ref);
          }
          if (!snap.empty) {
            await batch.commit();
          }
        }
        await db.collection('users').doc(uid).delete().catch(() => {});
        console.log(`[dataStore.eraseUserData] Wiped all Cloud Firestore records for user ${uid}`);
      } catch (err) {
        console.warn(`[dataStore.eraseUserData] Firestore purge failed:`, err);
      }
    }

    mockDb.eraseUserBucket(uid);
    deleteAtomicTenantFile(uid);
    await this.clearUserPortionCalibrations(uid);
    console.log(`[dataStore.eraseUserData] Wiped in-memory bucket and disk storage for user ${uid}`);
  },
};

export { getDataDir, setDataDir, deleteAtomicTenantFile };
