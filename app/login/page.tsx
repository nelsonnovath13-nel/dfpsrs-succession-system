"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const suspended = searchParams.get("suspended");
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

    // Owners with an incomplete onboarding checklist land back on the wizard
    // instead of a dashboard that would otherwise look empty and unguided.
    const userId = data.user?.id;
    if (userId) {
      const { data: profile } = await supabase.from("dfp_profiles").select("role").eq("id", userId).maybeSingle();
      if (profile?.role === "owner") {
        const [{ count: properties }, { count: family }, { count: beneficiaries }, { count: executors }, { data: records }] =
          await Promise.all([
            supabase.from("dfp_properties").select("id", { count: "exact", head: true }).eq("owner_id", userId),
            supabase.from("dfp_family_members").select("id", { count: "exact", head: true }).eq("owner_id", userId),
            supabase.from("dfp_beneficiaries").select("id", { count: "exact", head: true }).eq("owner_id", userId),
            supabase.from("dfp_executors").select("id", { count: "exact", head: true }).eq("owner_id", userId).eq("status", "active"),
            supabase.from("dfp_succession_records").select("status").eq("owner_id", userId),
          ]);
        const isComplete =
          (properties ?? 0) > 0 &&
          (family ?? 0) > 0 &&
          (beneficiaries ?? 0) > 0 &&
          (executors ?? 0) > 0 &&
          (records ?? []).length > 0 &&
          (records ?? []).some((r) => r.status !== "draft");
        setLoading(false);
        router.refresh();
        router.push(isComplete ? "/owner/dashboard" : "/owner/onboarding");
        return;
      }
    }

    setLoading(false);
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
