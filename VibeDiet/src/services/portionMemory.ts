export interface PortionCalibration {
  foodKey: string; // Normalized lowercase food name (e.g. "dal tadka", "phulka roti")
  foodName: string;
  calibratedGrams: number;
  oilModifier?: string;
  updatedAt: string;
}

// In-memory store per user uid for sub-millisecond retrieval during inference
const userPortionCalibrations = new Map<string, Map<string, PortionCalibration>>();

export function normalizeFoodKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

export function savePortionCalibration(
  uid: string,
  foodName: string,
  grams: number,
  oilModifier?: string
): PortionCalibration {
  let userMap = userPortionCalibrations.get(uid);
  if (!userMap) {
    userMap = new Map();
    userPortionCalibrations.set(uid, userMap);
  }

  const foodKey = normalizeFoodKey(foodName);
  const calibration: PortionCalibration = {
    foodKey,
    foodName,
    calibratedGrams: Math.max(1, Math.round(grams)),
    oilModifier,
    updatedAt: new Date().toISOString(),
  };

  userMap.set(foodKey, calibration);
  return calibration;
}

export function getPortionCalibration(uid: string, foodName: string): PortionCalibration | null {
  const foodKey = normalizeFoodKey(foodName);
  const userMap = userPortionCalibrations.get(uid);
  if (userMap?.has(foodKey)) {
    return userMap.get(foodKey)!;
  }
  return null;
}

export function getAllPortionCalibrations(uid: string): PortionCalibration[] {
  const userMap = userPortionCalibrations.get(uid);
  if (!userMap) return [];
  return Array.from(userMap.values());
}

export function clearUserPortionCalibrations(uid: string): void {
  userPortionCalibrations.delete(uid);
}
