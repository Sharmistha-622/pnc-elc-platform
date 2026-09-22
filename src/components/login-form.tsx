"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Loader2 } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export function LoginForm() {
  const [isSocialLoading, setIsSocialLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setIsSocialLoading(true);
    setError(null);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      console.error("Google Auth Error:", err);
      setError(err.message || "Failed to connect to Google.");
      toast.error("Google sign in failed");
      setIsSocialLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center bg-transparent py-4">
      {/* Container 10% bigger: max-w-[465px] */}
      <div className="w-full max-w-[465px] bg-white dark:bg-slate-900 rounded-lg shadow-xl border border-slate-100 dark:border-slate-800/80 p-10 sm:p-12 flex flex-col items-center text-center transition-all duration-300">
        <Toaster />

        {/* Brand Icon */}
        <div className="w-12 h-12 rounded-lg bg-sky-500 text-white flex items-center justify-center shadow-lg shadow-sky-500/20 mb-5">
          <i className="fa-solid fa-user-group text-xl"></i>
        </div>

        {/* Heading */}
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Welcome
        </h1>

        {/* Subtitle */}
        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1.5">
          Access NG with your account
        </p>

        {/* Error Alert */}
        {error && (
          <div className="w-full mt-4 p-2.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-lg flex items-start gap-2 text-left">
            <i className="fa-solid fa-circle-exclamation text-rose-500 mt-0.5 text-xs"></i>
            <p className="text-xs font-semibold text-rose-700 dark:text-rose-400 leading-tight">{error}</p>
          </div>
        )}

        {/* Sign in with Google Button */}
        <button
          onClick={handleGoogleLogin}
          disabled={isSocialLoading}
          className="w-full mt-7 flex items-center justify-center gap-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 py-3.5 px-4 rounded-lg font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50/80 dark:hover:bg-slate-700/50 transition-all active:scale-[0.99] disabled:opacity-50 shadow-xs"
        >
          {isSocialLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
              <span className="text-sm">Connecting...</span>
            </div>
          ) : (
            <>
              <svg viewBox="0 0 24 24" width="18" height="18" className="shrink-0">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span className="text-sm">Sign in with Google</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
