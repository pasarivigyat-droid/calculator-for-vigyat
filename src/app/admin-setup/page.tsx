"use client";

import React, { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { Calculator, ShieldCheck, Mail, Lock, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";

/**
 * Temporary Admin Setup Page
 * Allows the user to create their first admin account.
 */
export default function AdminSetupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      console.log(`[AdminSetup] Attempting to create admin with email: ${email}`);
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      console.log(`[AdminSetup] Success: ${userCredential.user.email} created.`);
      setSuccess(true);
      // Auto-redirect after 3s
      setTimeout(() => router.push("/login"), 3000);
    } catch (err: any) {
      setError(`Setup failed: ${err.message || 'Unknown error'}`);
      console.error("Setup Error Details:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-600 mb-4 shadow-lg">
            <Calculator className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Internal Admin Setup</h1>
          <p className="text-gray-500 text-sm">Create your first administrative account for Woodflex.</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2x border border-gray-100 p-8">
          {success ? (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 text-green-600 mb-4">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Admin Created Successfully!</h2>
              <p className="text-gray-500 text-sm mb-6">Redirecting in 3 seconds...</p>
              <button 
                onClick={() => router.push("/login")}
                className="w-full bg-[#2d221c] text-amber-500 font-bold py-3 rounded-xl hover:bg-black transition-all"
              >
                Launch Login Portal Now
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-600" /> Account Creation
              </h2>

              {error && (
                <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-red-600">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <p className="text-sm font-medium">{error}</p>
                </div>
              )}

              <form onSubmit={handleCreateAdmin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Email</label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
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
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-gray-50 border-0 rounded-2xl py-4 pl-12 pr-4 text-gray-900 focus:ring-2 focus:ring-amber-600 transition-all outline-none"
                      placeholder="At least 6 characters"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-amber-600 text-white font-bold py-4 rounded-2xl hover:bg-amber-700 transition-all flex items-center justify-center shadow-md disabled:opacity-50 mt-4 h-14"
                >
                  {loading ? (
                    <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <span>Initialize Admin Account</span>
                  )}
                </button>
              </form>
            </>
          )}
        </div>
        
        <p className="mt-8 text-center text-xs text-gray-400 font-medium">
          Once created, please delete this /admin-setup page for security.
        </p>
      </div>
    </div>
  );
}
