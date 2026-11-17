import { MealEntry, UserBiometrics, WeightLogEntry } from '../../types/index.js';
import { PhotoDraft } from '../../shared/draftTypes.js';

export interface VibeDietRepository {
  getUserBucket(uid: string): any;
  saveMeal(uid: string, meal: MealEntry): Promise<void>;
  deleteMeal(uid: string, mealId: string): Promise<boolean>;
  getDraft(uid: string, draftId: string): Promise<PhotoDraft | null>;
  saveDraft(uid: string, draft: PhotoDraft): Promise<void>;
  getWeightLogs(uid: string): Promise<WeightLogEntry[]>;
  saveWeightLog(uid: string, log: WeightLogEntry): Promise<void>;
  getBiometrics(uid: string): Promise<UserBiometrics>;
  saveBiometrics(uid: string, bio: UserBiometrics): Promise<void>;
  eraseUserData(uid: string): Promise<void>;
}
