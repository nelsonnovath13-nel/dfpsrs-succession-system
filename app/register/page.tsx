"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const ROLES = [
  { value: "owner", label: "Property Owner", desc: "Register and manage your family's property and succession plan." },
  { value: "beneficiary", label: "Beneficiary", desc: "Confirm your role once a family member names you in a verified succession record." },
  { value: "executor", label: "Estate Executor", desc: "Track an estate's succession progress once a property owner appoints and links you." },
  { value: "witness", label: "Family Witness", desc: "Review and confirm succession records you're asked to witness." },
  { value: "leader", label: "Local Government Leader", desc: "Give leader-level verification on succession records in your area." },
  { value: "legal", label: "Legal Officer", desc: "Conduct legal review of succession records referred for legal verification." },
  { value: "admin", label: "System Administrator", desc: "Oversee users and system-wide administration." },
  { value: "auditor", label: "System Auditor", desc: "Read-only access to audit logs and compliance records." },
];

export default function RegisterPage() {
  const supabase = createClient();
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("owner");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, phone_number: phone, role },
      },
    });

    if (signUpError) {
      setLoading(false);
      setError(signUpError.message);
      return;
    }

    // The account is auto-confirmed server-side (see dfp_auto_confirm_email trigger),
    // so we can sign the user straight in instead of making them wait on an email link.
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      setError("Account created. Please sign in.");
      router.push("/login");
      return;
    }
    router.refresh();
    router.push("/");
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-10 bg-surface">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <div className="mx-auto mb-3 h-12 w-12 border-2 bg-primary flex items-center justify-center text-white font-bold">
            URT
          </div>
          <h1 className="text-xl font-semibold text-neutralDark">Create your account</h1>
        </div>
        <form onSubmit={handleSubmit} className="card space-y-4">
          {error && (
            <div role="alert" className="bg-white text-red-800 text-sm px-3 py-2 border border-red-800">
              {error}
            </div>
          )}

          <div>
            <label className="label">I am registering as</label>
            <div className="grid grid-cols-1 gap-2">
              {ROLES.map((r) => (
                <label
                  key={r.value}
                  className={`flex items-start gap-3 border border p-3 cursor-pointer transition ${
                    role === r.value ? "border-primary bg-primary/5" : "border-gray-200"
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={r.value}
                    checked={role === r.value}
                    onChange={() => setRole(r.value)}
                    className="mt-1"
                  />
                  <span>
                    <span className="block text-sm font-medium text-neutralDark">{r.label}</span>
                    <span className="block text-xs text-neutralDark">{r.desc}</span>
                  </span>
                </label>
              ))}
            </div>
            <p className="text-xs text-neutralDark mt-1">
              Demo note: open role selection is for evaluation purposes. In production, Witness,
              Leader, and Admin accounts should be created by invitation only.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Full Name</label>
              <input required className="input-field" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div>
              <label className="label">Phone Number</label>
              <input required className="input-field" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+255…" />
            </div>
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" required className="input-field" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label">Password</label>
            <input type="password" required minLength={6} className="input-field" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Creating account…" : "Create Account"}
          </button>
        </form>
        <p className="text-center text-sm text-neutralDark mt-4">
          Already have an account?{" "}
          <Link href="/login" className="text-primary font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
