import { getFirestoreDb, isUsingRealFirestore, dataStore } from './dataStore.js';
import { mockDb } from './mockFirestore.js';

export { getFirestoreDb, isUsingRealFirestore, dataStore };

export function getAdminFirestore() {
  const db = getFirestoreDb();
  return db || mockDb;
}
