/**
 * VibeDiet DataStore Service Module
 * Supports isolated test runs via process.env.VIBEDIET_DATA_DIR.
 */
import { dataStore, getFirestoreDb, isUsingRealFirestore, deleteAtomicTenantFile } from '../lib/dataStore.js';
import { getDataDir, setDataDir } from '../persistence/postgresRepository.js';

export { dataStore, getFirestoreDb, isUsingRealFirestore, getDataDir, setDataDir, deleteAtomicTenantFile };
export const VIBEDIET_DATA_DIR = process.env.VIBEDIET_DATA_DIR;
export default dataStore;
