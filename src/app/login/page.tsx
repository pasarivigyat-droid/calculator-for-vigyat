"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { signIn } from "@/lib/firebase/auth";
import { Calculator, Lock, Mail, AlertCircle } from "lucide-react";

/**
 * Admin Login Page
 * Styled to match the Woodflex brand.
 */
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // Redirect to dashboard if user is already logged in
  useEffect(() => {
    if (!authLoading && user) {
      router.push("/");
    }
  }, [user, authLoading, router]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await signIn(email, password);
      router.push("/");
    } catch (err: any) {
      setError(err.message || "Login failed. Please check your credentials.");
      console.error("Login Error:", err);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-800"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#2d221c] flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-amber-600 mb-4 shadow-xl">
            <Calculator className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Woodflex Admin</h1>
          <p className="text-amber-200/60 font-medium">Furniture Costing & Quoting Engine</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-white/10">
          <div className="p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Lock className="w-5 h-5 text-amber-600" /> Administrative Sign In
            </h2>

            {error && (
              <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-red-600">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}

            <form onSubmit={handleSignIn} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Email Address</label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-amber-600 transition-colors" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-gray-50 border-0 rounded-2xl py-4 pl-12 pr-4 text-gray-900 focus:ring-2 focus:ring-amber-600 transition-all outline-none"
                    placeholder="admin@woodflex.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Password</label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-amber-600 transition-colors" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-gray-50 border-0 rounded-2xl py-4 pl-12 pr-4 text-gray-900 focus:ring-2 focus:ring-amber-600 transition-all outline-none"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#2d221c] text-amber-500 font-bold py-4 rounded-2xl hover:bg-black transition-all flex items-center justify-center shadow-lg disabled:opacity-50 mt-4 group"
              >
                {loading ? (
                  <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <span>Access Admin Dashboard</span>
                )}
              </button>
            </form>
          </div>

          <div className="bg-gray-50 px-8 py-5 text-center text-xs text-gray-500 font-medium">
            Internal Use Only. Restricted Access. 
          </div>
        </div>
      </div>
    </div>
  );
}
