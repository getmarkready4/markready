"use client";

import { useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "magic" | "password";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
    </svg>
  );
}

function LoginForm() {
  const [mode, setMode] = useState<Mode>("magic");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const searchParams = useSearchParams();
  const router = useRouter();

  const urlError = searchParams.get("error");
  const errorMessage =
    urlError === "auth_failed"
      ? "Login link expired or already used. Please try again."
      : urlError === "invalid_link"
        ? "Invalid login link. Please try again."
        : "";

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError("");
    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (oauthError) {
      setError(oauthError.message);
      setGoogleLoading(false);
    }
    // On success the browser navigates away — no need to reset loading
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    const supabase = createClient();

    if (mode === "magic") {
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      setLoading(false);
      if (signInError) {
        setError(signInError.message);
      } else {
        setMessage("Check your email for a login link.");
        setEmail("");
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (signInError) {
        setError(signInError.message);
      } else {
        router.push("/score");
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#FAF8F3] px-4">
      <div className="mb-8 text-center">
        <span className="font-serif text-2xl font-semibold text-[#23282B]">MarkReady</span>
        <p className="text-sm text-[#5B6266] mt-1">Examiner-level IELTS feedback</p>
      </div>

      <div className="w-full max-w-sm bg-white border border-[#E4DFD3] rounded-2xl p-8">
        <h1 className="font-serif text-xl font-semibold text-[#23282B] mb-6">Sign in</h1>

        {errorMessage && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {errorMessage}
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-4 p-3 bg-[#F0F7F4] border border-[#C2DDD6] text-[#1F5C4E] rounded-lg text-sm">
            {message}
          </div>
        )}

        {/* Google */}
        <button
          onClick={handleGoogleSignIn}
          disabled={googleLoading || loading}
          className="w-full flex items-center justify-center gap-3 border border-[#E4DFD3] rounded-lg py-2.5 text-sm font-medium text-[#23282B] hover:bg-[#FAF8F3] disabled:opacity-50 transition-colors mb-5"
        >
          <GoogleIcon />
          {googleLoading ? "Redirecting…" : "Continue with Google"}
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px bg-[#E4DFD3]" />
          <span className="text-xs text-[#9BA3A8]">or</span>
          <div className="flex-1 h-px bg-[#E4DFD3]" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-[#23282B] mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading || googleLoading}
              className="w-full px-3 py-2 border border-[#E4DFD3] rounded-lg text-[#23282B] placeholder-[#9BA3A8] focus:outline-none focus:ring-2 focus:ring-[#1F5C4E]/30 focus:border-[#1F5C4E] disabled:opacity-50 text-sm"
              placeholder="you@example.com"
            />
          </div>

          {mode === "password" && (
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[#23282B] mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading || googleLoading}
                className="w-full px-3 py-2 border border-[#E4DFD3] rounded-lg text-[#23282B] placeholder-[#9BA3A8] focus:outline-none focus:ring-2 focus:ring-[#1F5C4E]/30 focus:border-[#1F5C4E] disabled:opacity-50 text-sm"
                placeholder="••••••••"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading || googleLoading}
            className="w-full bg-[#1F5C4E] text-white py-2.5 rounded-lg hover:bg-[#154136] disabled:opacity-50 font-medium text-sm transition-colors"
          >
            {loading
              ? mode === "magic" ? "Sending…" : "Signing in…"
              : mode === "magic" ? "Send login link" : "Sign in"}
          </button>
        </form>

        <div className="mt-5 text-center">
          {mode === "magic" ? (
            <button
              onClick={() => { setMode("password"); setError(""); setMessage(""); }}
              className="text-sm text-[#1F5C4E] hover:text-[#154136] hover:underline"
            >
              Sign in with password instead
            </button>
          ) : (
            <button
              onClick={() => { setMode("magic"); setError(""); setMessage(""); }}
              className="text-sm text-[#1F5C4E] hover:text-[#154136] hover:underline"
            >
              Send me a magic link instead
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FAF8F3]" />}>
      <LoginForm />
    </Suspense>
  );
}
