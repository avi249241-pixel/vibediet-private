export interface FirebaseClientConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
}

export const firebaseClientConfig: FirebaseClientConfig = {
  apiKey: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_API_KEY) || 'demo-local-key',
  authDomain: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN) || 'vibediet-local.firebaseapp.com',
  projectId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_PROJECT_ID) || 'vibediet-local',
};
