import { 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut, 
  onAuthStateChanged,
  User
} from "firebase/auth";
import { auth } from "./config";

/**
 * Sign in with email and password.
 */
/**
 * Listen for auth state changes.
 */
export const subscribeToAuthChanges = (callback: (user: User | null) => void) => {
  if (!auth) {
    console.warn("🔥 [Auth] subscribeToAuthChanges: Firebase Auth is NOT initialized.");
    callback(null);
    return () => {}; 
  }
  return onAuthStateChanged(auth, callback);
};

export const signIn = async (email: string, pass: string) => {
  if (!auth) throw new Error("Firebase Auth is not initialized. Please check your configuration.");
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, pass);
    return userCredential.user;
  } catch (error: any) {
    console.error("Auth: Sign In failed", error.message);
    throw error;
  }
};

export const signOut = async () => {
  if (!auth) throw new Error("Firebase Auth is not initialized. Please check your configuration.");
  try {
    await firebaseSignOut(auth);
  } catch (error: any) {
    console.error("Auth: Sign Out failed", error.message);
    throw error;
  }
};
