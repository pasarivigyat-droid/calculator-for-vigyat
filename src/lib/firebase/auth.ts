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
export const signIn = async (email: string, pass: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, pass);
    return userCredential.user;
  } catch (error: any) {
    console.error("Auth: Sign In failed", error.message);
    throw error;
  }
};

/**
 * Sign out the current user.
 */
export const signOut = async () => {
  try {
    await firebaseSignOut(auth);
  } catch (error: any) {
    console.error("Auth: Sign Out failed", error.message);
    throw error;
  }
};

/**
 * Listen for auth state changes.
 */
export const subscribeToAuthChanges = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};
