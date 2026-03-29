import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth, onAuthStateChanged, User } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";

const sanitize = (val: string | undefined) => val?.trim().replace(/^["'](.+)["']$/, '$1');

const firebaseConfig = {
  apiKey: sanitize(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
  authDomain: sanitize(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
  projectId: sanitize(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
  storageBucket: sanitize(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: sanitize(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
  appId: sanitize(process.env.NEXT_PUBLIC_FIREBASE_APP_ID)
};

// --- Hardened Initialization for Next.js Prerendering ---
// We only initialize Firebase if:
// 1. We are in the browser (client-side) AND we have a valid API key
// 2. We are on the server but have a valid API key (for server-side functions)
const isBrowser = typeof window !== "undefined";
const hasConfig = !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const shouldInitialize = (isBrowser && hasConfig) || hasConfig;

// Initialize variables with null to prevent "undefined" crashes
let app: FirebaseApp = null as unknown as FirebaseApp;
let auth: Auth = null as unknown as Auth;
let db: Firestore = null as unknown as Firestore;
let storage: FirebaseStorage = null as unknown as FirebaseStorage;

if (shouldInitialize) {
  try {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);
    
    const databaseId = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID || "(default)";
    db = getFirestore(app, databaseId);
    storage = getStorage(app);
    
    if (process.env.NODE_ENV !== 'production' && isBrowser) {
      console.log(`[Firebase] SUCCESS: Initialized with Database ID: ${databaseId}`);
    }
  } catch (error: any) {
    if (isBrowser) {
       console.error("🔥 [Firebase] Initialization CRITICAL FAILURE!", error.message);
       console.warn("Please check your .env.local file or Netlify environment variables.");
    }
  }
} else {
  if (isBrowser && !hasConfig) {
      console.warn("⚠️ [Firebase] Initialization SKIPPED: NEXT_PUBLIC_FIREBASE_API_KEY is missing.");
      console.warn("This usually means environment variables are not correctly set in your .env.local file or on your hosting provider (like Netlify).");
      
      const missingKeys = [];
      if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) missingKeys.push("API_KEY");
      if (!process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN) missingKeys.push("AUTH_DOMAIN");
      if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) missingKeys.push("PROJECT_ID");
      
      if (missingKeys.length > 0) {
        console.warn(`🔥 Missing Required Keys: ${missingKeys.join(", ")}`);
      }
  }
}

export { app, auth, db, storage };
