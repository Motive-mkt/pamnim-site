import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseAppletConfig from '../../firebase-applet-config.json';

// Utility to fetch variables securely, prioritising standard raw process.env key (Vercel Node environment)
// or standard Vite configuration (import.meta.env.*) in production, falling back to local playground settings.
const getEnvValue = (key, fallback = '') => {
  // Check standard process.env keys (useful for fullstack Node/Vercel SSR processes)
  if (typeof process !== 'undefined' && process.env) {
    if (process.env[`VITE_FIREBASE_${key}`]) return process.env[`VITE_FIREBASE_${key}`];
    if (process.env[`FIREBASE_${key}`]) return process.env[`FIREBASE_${key}`];
  }
  // Check standard client-side Vite variables (VITE_ prefixed)
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    if (import.meta.env[`VITE_FIREBASE_${key}`]) return import.meta.env[`VITE_FIREBASE_${key}`];
  }
  return fallback;
};

const firebaseConfig = {
  apiKey: getEnvValue('API_KEY', firebaseAppletConfig.apiKey),
  authDomain: getEnvValue('AUTH_DOMAIN', firebaseAppletConfig.authDomain),
  projectId: getEnvValue('PROJECT_ID', firebaseAppletConfig.projectId),
  storageBucket: getEnvValue('STORAGE_BUCKET', firebaseAppletConfig.storageBucket),
  messagingSenderId: getEnvValue('MESSAGING_SENDER_ID', firebaseAppletConfig.messagingSenderId),
  appId: getEnvValue('APP_ID', firebaseAppletConfig.appId)
};

const databaseId = getEnvValue('DATABASE_ID', firebaseAppletConfig.firestoreDatabaseId);

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app, databaseId);
export const auth = getAuth(app);
export default app;
