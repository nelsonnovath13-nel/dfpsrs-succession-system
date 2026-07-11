"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getNextOnboardingHref } from "@/lib/onboarding";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const suspended = searchParams.get("suspended");
  const timedOut = searchParams.get("timeout");
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }

    // Owners with an incomplete onboarding checklist land back on the wizard instead of a
    // dashboard that would otherwise look empty and unguided. This check is best-effort only:
    // any failure or slowness here must never block the user from reaching the app at all.
    try {
      const userId = data.user?.id;
      if (userId) {
        const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000));
        const profileQuery = supabase.from("dfp_profiles").select("role").eq("id", userId).maybeSingle();
        const result = await Promise.race([profileQuery, timeout]);
        const role = result?.data?.role;

        if (role === "owner") {
          // Resume exactly where they left off (the first genuinely incomplete step),
          // not always back at the start of the wizard. Falls back to the dashboard on
          // any failure/timeout rather than blocking sign-in.
          const next = await getNextOnboardingHref(supabase, userId, "/owner/dashboard");
          router.refresh();
          router.push(next ?? "/owner/dashboard");
          return;
        }
      }
    } catch {
      // Fall through to the generic redirect below.
    } finally {
      setLoading(false);
    }

    router.refresh();
    router.push("/");
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-surface">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="mx-auto mb-3 h-12 w-12 border-2 bg-primary flex items-center justify-center text-white font-bold">
            URT
          </div>
          <h1 className="text-xl font-semibold text-neutralDark">Sign in to your account</h1>
        </div>
        <form onSubmit={handleSubmit} className="card space-y-4">
          {suspended && (
            <div className="bg-amber-50 text-amber-800 text-sm border px-3 py-2 border border-amber-700">
              Your account has been suspended. Contact a system administrator.
            </div>
          )}
          {timedOut && (
            <div className="bg-amber-50 text-amber-800 text-sm border px-3 py-2 border border-amber-700">
              You were signed out after 15 minutes of inactivity, to keep your family&apos;s
              records secure. Please sign in again.
            </div>
          )}
          {error && (
            <div role="alert" className="bg-white text-red-800 text-sm px-3 py-2 border border-red-800">
              {error}
            </div>
          )}
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              required
              className="input-field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              type="password"
              required
              className="input-field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
        <p className="text-center text-sm text-neutralDark mt-4">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-primary font-medium">
            Create one
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
