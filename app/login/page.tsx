"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Fingerprint, Mail, Phone } from "lucide-react";
import { startAuthentication } from "@simplewebauthn/browser";
import { createClient } from "@/lib/supabase/client";
import { getNextOnboardingHref } from "@/lib/onboarding";
import { useLanguage, LanguageToggle } from "@/lib/i18n";

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.87-3.04.87-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.73A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.19.29-1.73V4.94H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.06l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.59-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.94l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const suspended = searchParams.get("suspended");
  const timedOut = searchParams.get("timeout");
  const noProfile = searchParams.get("no_profile");
  const justRegistered = searchParams.get("registered");
  const oauthFailed = searchParams.get("error") === "oauth_failed";
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

  const [mode, setMode] = useState<"email" | "phone">("email");
  const [googleLoading, setGoogleLoading] = useState(false);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);

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

    // Routed through a server endpoint (not a direct client-side signInWithPassword) so failed
    // attempts can be tracked server-side and an account locked out after repeated failures --
    // a client-reported failure count cannot be trusted.
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const result = await res.json();

    if (!res.ok) {
      setLoading(false);
      if (result.error === "email_not_confirmed") {
        setUnconfirmed(true);
      } else if (result.error === "locked_out") {
        const minutes = Math.ceil((result.retryAfterSeconds ?? 900) / 60);
        setError(
          sw
            ? `Majaribio mengi ya kuingia yaliyoshindwa. Tafadhali subiri kama dakika ${minutes} kisha jaribu tena.`
            : `Too many failed login attempts. Please wait about ${minutes} minute(s) and try again.`
        );
      } else if (result.error === "rate_limited") {
        setError(sw ? "Maombi mengi kwa sasa. Tafadhali subiri kidogo kisha jaribu tena." : "Too many requests right now. Please wait a moment and try again.");
      } else {
        setError(sw ? "Barua pepe au neno la siri si sahihi." : "Incorrect email or password.");
      }
      return;
    }

    const userId = result.userId as string | undefined;
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

  async function handleGoogleLogin() {
    setGoogleLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/api/auth/callback` },
    });
    // Browser navigates away to Google -- no further client code runs on success.
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setPhoneError(null);
    setPhoneLoading(true);
    const { error: otpError } = await supabase.auth.signInWithOtp({ phone });
    setPhoneLoading(false);
    if (otpError) {
      setPhoneError(
        /sms|phone provider|unsupported/i.test(otpError.message)
          ? sw
            ? "Uthibitishaji wa simu haujawezeshwa kwenye mfumo huu bado. Tumia barua pepe au Google kwa sasa."
            : "Phone verification isn't enabled on this system yet. Please use Email or Google for now."
          : otpError.message
      );
      return;
    }
    setOtpSent(true);
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setPhoneError(null);
    setPhoneLoading(true);
    const { data, error: verifyError } = await supabase.auth.verifyOtp({ phone, token: otp, type: "sms" });
    setPhoneLoading(false);
    if (verifyError) {
      setPhoneError(sw ? "Namba ya uthibitisho si sahihi au imeisha muda." : "Incorrect or expired verification code.");
      return;
    }
    const userId = data.user?.id;
    const dest = userId ? await resolveDestination(userId) : "/";
    if (userId) {
      const { count } = await supabase.from("dfp_webauthn_credentials").select("id", { count: "exact", head: true }).eq("user_id", userId);
      if ((count ?? 0) > 0) {
        setPendingDest(dest);
        setNeedsPasskey(true);
        return;
      }
    }
    await finishLogin(dest);
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
        <>
          <div className="card space-y-4 mb-3">
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
            {oauthFailed && (
              <div role="alert" className="bg-white text-red-800 border border-red-800 text-sm px-3 py-2">
                {sw
                  ? "Kuingia kwa Google hakukufanikiwa. Jaribu tena, au tumia Barua Pepe."
                  : "Google sign-in didn't complete. Please try again, or use Email instead."}
              </div>
            )}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={googleLoading}
              className="btn-outline w-full inline-flex items-center justify-center gap-2"
            >
              <GoogleIcon />
              {googleLoading ? (sw ? "Inaelekeza…" : "Redirecting…") : sw ? "Endelea na Google" : "Continue with Google"}
            </button>
            <div className="flex items-center gap-3 text-xs text-inkSoft">
              <span className="flex-1 border-t border-gray-200" />
              {sw ? "au" : "or"}
              <span className="flex-1 border-t border-gray-200" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => { setMode("email"); setPhoneError(null); }}
                className={`inline-flex items-center justify-center gap-2 text-sm py-2.5 border ${mode === "email" ? "border-primary bg-primary/5 text-primary font-medium" : "border-gray-300 text-inkSoft"}`}
              >
                <Mail size={15} aria-hidden="true" /> {sw ? "Barua Pepe" : "Email"}
              </button>
              <button
                type="button"
                onClick={() => { setMode("phone"); setError(null); }}
                className={`inline-flex items-center justify-center gap-2 text-sm py-2.5 border ${mode === "phone" ? "border-primary bg-primary/5 text-primary font-medium" : "border-gray-300 text-inkSoft"}`}
              >
                <Phone size={15} aria-hidden="true" /> {sw ? "Namba ya Simu" : "Phone Number"}
              </button>
            </div>
          </div>

        {mode === "phone" ? (
          <form onSubmit={otpSent ? handleVerifyOtp : handleSendOtp} className="card space-y-4">
            <p className="text-xs text-inkSoft">
              {sw
                ? "Kidokezo: uthibitishaji wa simu unahitaji huduma ya SMS iliyowezeshwa upande wa mfumo. Kama hujaona ujumbe, tumia Barua Pepe au Google kwa sasa."
                : "Note: phone verification requires an SMS provider to be enabled on the backend. If you don't receive a code, please use Email or Google for now."}
            </p>
            {phoneError && <div role="alert" className="bg-white text-red-800 border border-red-800 text-sm px-3 py-2">{phoneError}</div>}
            {!otpSent ? (
              <div>
                <label className="label">{sw ? "Namba ya Simu" : "Phone Number"}</label>
                <input
                  type="tel"
                  required
                  placeholder="+255…"
                  className="input-field"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            ) : (
              <div>
                <label className="label">{sw ? "Namba ya Uthibitisho (OTP)" : "Verification Code (OTP)"}</label>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  className="input-field text-center text-lg tracking-widest"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  maxLength={6}
                />
                <button type="button" onClick={() => setOtpSent(false)} className="text-xs text-primary underline mt-1">
                  {sw ? "Badilisha namba ya simu" : "Change phone number"}
                </button>
              </div>
            )}
            <button type="submit" disabled={phoneLoading} className="btn-primary w-full">
              {phoneLoading ? (sw ? "Inatuma…" : "Sending…") : otpSent ? (sw ? "Thibitisha" : "Verify") : sw ? "Tuma Namba ya Uthibitisho" : "Send Verification Code"}
            </button>
          </form>
        ) : (
        <form onSubmit={handleSubmit} className="card space-y-4">
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
        </>
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
