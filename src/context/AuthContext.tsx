"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User } from "firebase/auth";
import { subscribeToAuthChanges, signOut as firebaseSignOut } from "@/lib/firebase/auth";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Global Authentication Provider
 * Manages the logged-in state of the admin user.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Subscribe to auth state changes from Firebase
    const unsubscribe = subscribeToAuthChanges((firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
      console.log(`[AuthContext] State change: ${firebaseUser ? 'Logged In (' + firebaseUser.email + ')' : 'Logged Out'}`);
    });

    return () => unsubscribe();
  }, []);

  const signOut = async () => {
    try {
      await firebaseSignOut();
      setUser(null);
    } catch (error) {
      console.error("AuthContext: Sign Out failed", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to use authentication context.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
