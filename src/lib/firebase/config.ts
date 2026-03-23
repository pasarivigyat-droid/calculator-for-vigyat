import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBExn4ybqBzJ3WqqzY1fxQ0yMJNarTMnuY",
  authDomain: "gen-lang-client-0825859469.firebaseapp.com",
  projectId: "gen-lang-client-0825859469",
  storageBucket: "gen-lang-client-0825859469.firebasestorage.app",
  messagingSenderId: "133613288502",
  appId: "1:133613288502:web:b48a008398b50b65552c97"
};

// Initialize Firebase
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

// NOTE: We are using a specific database ID as defined in the project applet config.
// Using "(default)" would connect to the wrong database.
const db = getFirestore(app, "ai-studio-d6a74ed0-4234-45c9-83e9-64ba6c0a1096");

const storage = getStorage(app);

console.log(`[FirebaseConfig] Intialized with Database ID: ai-studio-d6a74ed0-4234-45c9-83e9-64ba6c0a1096`);

export { app, auth, db, storage };
