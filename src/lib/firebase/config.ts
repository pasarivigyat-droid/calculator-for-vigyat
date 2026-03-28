import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// --- Hardened Initialization for Next.js Prerendering ---
// We only initialize Firebase if:
// 1. We are in the browser (client-side)
// 2. We have a valid API key (for server-side code that actually needs Firebase)
const shouldInitialize = typeof window !== "undefined" || !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;

if (shouldInitialize) {
  try {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);
    
    const databaseId = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID || "(default)";
    db = getFirestore(app, databaseId);
    storage = getStorage(app);
    
    if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
      console.log(`[Firebase] Initialized on client with Database ID: ${databaseId}`);
    }
  } catch (error) {
    console.error("Firebase initialization error:", error);
    // During build, we don't want to crash the process if possible
  }
} else {
  // During build if config is missing, we export null/proxy objects to prevent import-time crashes
  // These will never be used since Firebase operations are client-only in this app
  app = (null as unknown) as FirebaseApp;
  auth = (null as unknown) as Auth;
  db = (null as unknown) as Firestore;
  storage = (null as unknown) as FirebaseStorage;
}

export { app, auth, db, storage };
