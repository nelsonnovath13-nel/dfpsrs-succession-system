"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Fingerprint } from "lucide-react";
import { startAuthentication } from "@simplewebauthn/browser";
import { createClient } from "@/lib/supabase/client";
import { getNextOnboardingHref } from "@/lib/onboarding";
import { useLanguage, LanguageToggle } from "@/lib/i18n";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const suspended = searchParams.get("suspended");
  const timedOut = searchParams.get("timeout");
  const noProfile = searchParams.get("no_profile");
  const justRegistered = searchParams.get("registered");
  const supabase = createClient();
  const { lang } = useLanguage();
  const sw = lang === "sw";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState<string | null>(null);
  const [needsPasskey, setNeedsPasskey] = useState(false);
  const [verifyingPasskey, setVerifyingPasskey] = useState(false);
  const [pendingDest, setPendingDest] = useState<string | null>(null);

  async function finishLogin(dest: string) {
    router.refresh();
    router.push(dest);
  }

  async function resolveDestination(userId: string) {
    // Owners with an incomplete onboarding checklist land back on the wizard instead of a
    // dashboard that would otherwise look empty and unguided. This check is best-effort only:
    // any failure or slowness here must never block the user from reaching the app at all.
    try {
      const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000));
      const profileQuery = supabase.from("dfp_profiles").select("role").eq("id", userId).maybeSingle();
      const result = await Promise.race([profileQuery, timeout]);
      const role = result?.data?.role;
      if (role === "owner") {
        const next = await getNextOnboardingHref(supabase, userId, "/owner/dashboard");
        return next ?? "/owner/dashboard";
      }
    } catch {
      // Fall through to the generic destination below.
    }
    return "/";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setUnconfirmed(false);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      if (/email not confirmed/i.test(error.message)) {
        setUnconfirmed(true);
      } else {
        setError(error.message);
      }
      return;
    }

    const userId = data.user?.id;
    const dest = userId ? await resolveDestination(userId) : "/";

    // If this account has a registered device passkey, require it as a second step before
    // finishing sign-in -- the password alone got them this far, but a stronger account
    // already opted into fingerprint/Face ID verification too.
    if (userId) {
      const { count } = await supabase.from("dfp_webauthn_credentials").select("id", { count: "exact", head: true }).eq("user_id", userId);
      if ((count ?? 0) > 0) {
        setPendingDest(dest);
        setNeedsPasskey(true);
        setLoading(false);
        return;
      }
    }

    setLoading(false);
    await finishLogin(dest);
  }

  async function handleResend() {
    setResending(true);
    setResendMsg(null);
    const { error: resendError } = await supabase.auth.resend({ type: "signup", email });
    setResending(false);
    setResendMsg(
      resendError
        ? resendError.message
        : sw
        ? "Barua pepe ya uthibitisho imetumwa tena. Angalia pia folda ya Spam/Junk."
        : "Confirmation email resent. Please also check your Spam/Junk folder."
    );
  }

  async function handlePasskeyStep() {
    setVerifyingPasskey(true);
    setError(null);
    try {
      const optionsRes = await fetch("/api/webauthn/authenticate/options", { method: "POST" });
      const options = await optionsRes.json();
      if (!optionsRes.ok) throw new Error(options.error ?? (sw ? "Imeshindikana kuanzisha uthibitisho." : "Could not start passkey verification."));

      const authResp = await startAuthentication({ optionsJSON: options });

      const verifyRes = await fetch("/api/webauthn/authenticate/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: authResp }),
      });
      const verifyJson = await verifyRes.json();
      if (!verifyRes.ok || !verifyJson.verified) throw new Error(verifyJson.error ?? (sw ? "Alama ya kidole haikuthibitishwa." : "Fingerprint could not be verified."));

      await finishLogin(pendingDest ?? "/");
    } catch (e: any) {
      setError(
        e?.name === "NotAllowedError"
          ? sw
            ? "Uthibitisho umeghairiwa."
            : "Verification was cancelled."
          : e.message ?? (sw ? "Imeshindikana kuthibitisha." : "Could not verify.")
      );
    } finally {
      setVerifyingPasskey(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-surface">
      <div className="w-full max-w-md">
        <div className="flex justify-end mb-3">
          <LanguageToggle />
        </div>
        <div className="text-center mb-6">
          <img src="/nembo.png" alt="URT" className="mx-auto mb-3 h-12 w-12 object-contain" />
          <h1 className="text-xl font-semibold text-neutralDark">{sw ? "Ingia kwenye Akaunti Yako" : "Sign in to your account"}</h1>
        </div>
        {needsPasskey ? (
          <div className="card space-y-4">
            <p className="text-sm font-medium text-ink flex items-center gap-2">
              <Fingerprint size={18} className="text-primary" aria-hidden="true" />
              {sw ? "Hatua ya Pili: Alama ya Kidole" : "Second Step: Fingerprint"}
            </p>
            <p className="text-xs text-inkSoft">
              {sw
                ? "Neno la siri ni sahihi. Akaunti hii ina kifaa kilichosajiliwa - thibitisha kwa alama ya kidole, uso, au PIN ya kifaa ili kumaliza kuingia."
                : "Your password was correct. This account has a registered device — verify with your fingerprint, face, or device PIN to finish signing in."}
            </p>
            {error && <div role="alert" className="bg-white text-red-800 border border-red-800 text-sm px-3 py-2">{error}</div>}
            <button onClick={handlePasskeyStep} disabled={verifyingPasskey} className="btn-primary w-full inline-flex items-center justify-center gap-2">
              <Fingerprint size={16} aria-hidden="true" />
              {verifyingPasskey ? (sw ? "Inathibitisha…" : "Verifying…") : sw ? "Thibitisha" : "Verify"}
            </button>
            <button
              type="button"
              onClick={() => {
                setNeedsPasskey(false);
                setPendingDest(null);
              }}
              className="btn-outline w-full text-sm"
            >
              {sw ? "Rudi Nyuma" : "Back"}
            </button>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="card space-y-4">
          {suspended && (
            <div className="bg-amber-50 text-amber-800 text-sm px-3 py-2 border border-amber-700">
              {sw ? "Akaunti yako imesimamishwa. Wasiliana na msimamizi wa mfumo." : "Your account has been suspended. Contact a system administrator."}
            </div>
          )}
          {timedOut && (
            <div className="bg-amber-50 text-amber-800 text-sm px-3 py-2 border border-amber-700">
              {sw
                ? "Ulitolewa nje baada ya dakika 15 za kutofanya kitu, kulinda usalama wa kumbukumbu za familia yako. Tafadhali ingia tena."
                : "You were signed out after 15 minutes of inactivity, to keep your family's records secure. Please sign in again."}
            </div>
          )}
          {noProfile && (
            <div className="bg-amber-50 text-amber-800 text-sm px-3 py-2 border border-amber-700">
              {sw
                ? "Hatujaweza kupata wasifu wa akaunti yako. Tafadhali ingia tena, au wasiliana na msaada kama hili litaendelea kutokea."
                : "We could not find your account profile. Please sign in again, or contact support if this keeps happening."}
            </div>
          )}
          {justRegistered && (
            <div className="bg-green-50 text-secondary text-sm px-3 py-2 border border-secondary">
              {sw ? "Akaunti yako imeundwa. Tafadhali ingia hapa chini." : "Your account has been created. Please sign in below."}
            </div>
          )}
          {unconfirmed && (
            <div role="alert" className="bg-amber-50 text-amber-800 border border-amber-700 text-sm px-3 py-2 space-y-2">
              <p>
                {sw
                  ? "Barua pepe yako bado haijathibitishwa. Angalia barua pepe yako (na folda ya Spam/Junk) kwa kiungo cha uthibitisho."
                  : "Your email hasn't been confirmed yet. Check your inbox (and Spam/Junk folder) for the confirmation link."}
              </p>
              {resendMsg && <p className="text-secondary">{resendMsg}</p>}
              <button type="button" onClick={handleResend} disabled={resending} className="btn-outline text-xs">
                {resending ? (sw ? "Inatuma…" : "Resending…") : sw ? "Tuma Tena Barua Pepe ya Uthibitisho" : "Resend Confirmation Email"}
              </button>
            </div>
          )}
          {error && (
            <div role="alert" className="bg-white text-red-800 text-sm px-3 py-2 border border-red-800">
              {error}
            </div>
          )}
          <div>
            <label className="label">{sw ? "Barua Pepe" : "Email"}</label>
            <input
              type="email"
              required
              className="input-field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="label">{sw ? "Neno la Siri" : "Password"}</label>
            <input
              type="password"
              required
              className="input-field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? (sw ? "Inaingia…" : "Signing in…") : sw ? "Ingia" : "Sign In"}
          </button>
        </form>
        )}
        <p className="text-center text-sm text-neutralDark mt-4">
          {sw ? "Huna akaunti?" : "Don't have an account?"}{" "}
          <Link href="/register" className="text-primary font-medium">
            {sw ? "Fungua moja" : "Create one"}
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
