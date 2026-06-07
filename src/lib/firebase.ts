import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseAppletConfig from '../../firebase-applet-config.json';

// Helper to determine variables in both client (Vite) and server/SSR (Node/Vercel) contexts
const getEnvValue = (key: string, fallback: string = ''): string => {
  if (typeof process !== 'undefined' && process.env) {
    if (process.env[`VITE_FIREBASE_${key}`]) return process.env[`VITE_FIREBASE_${key}`] as string;
    if (process.env[`FIREBASE_${key}`]) return process.env[`FIREBASE_${key}`] as string;
  }
  const meta = import.meta as any;
  if (typeof import.meta !== 'undefined' && meta && meta.env) {
    if (meta.env[`VITE_FIREBASE_${key}`]) return meta.env[`VITE_FIREBASE_${key}`] as string;
  }
  return fallback;
};

const firebaseConfig = {
  apiKey: getEnvValue('API_KEY', firebaseAppletConfig.apiKey),
  authDomain: getEnvValue('AUTH_DOMAIN', 'gen-lang-client-0597692683.firebaseapp.com'),
  projectId: 'gen-lang-client-0597692683',
  storageBucket: getEnvValue('STORAGE_BUCKET', 'gen-lang-client-0597692683.appspot.com'),
  messagingSenderId: getEnvValue('MESSAGING_SENDER_ID', firebaseAppletConfig.messagingSenderId),
  appId: getEnvValue('APP_ID', firebaseAppletConfig.appId)
};

const app = initializeApp(firebaseConfig);

// Initialize Firestore explicitly targeting the custom database ID string
export const db = getFirestore(app, 'ai-studio-396542db-a5b7-4b73-a209-846a866b09ab');
export const auth = getAuth(app);
export default app;

