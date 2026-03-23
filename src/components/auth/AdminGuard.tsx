"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

/**
 * Higher-Order Component / Wrapper to protect admin routes.
 * Redirects to /login if the user is not authenticated.
 */
export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      console.log("[AdminGuard] No user found, redirecting to login.");
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-800"></div>
      </div>
    );
  }

  // If we have a user, render the protected content
  return user ? <>{children}</> : null;
}
