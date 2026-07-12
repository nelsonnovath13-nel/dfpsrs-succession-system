"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useLanguage, LanguageToggle } from "@/lib/i18n";

const ROLES = [
  { value: "owner", en: "Property Owner", sw: "Mmiliki wa Mali", desc_en: "Register and manage your family's property and succession plan.", desc_sw: "Sajili na simamia mali ya familia yako na mpango wa urithi." },
  { value: "beneficiary", en: "Beneficiary", sw: "Mnufaika", desc_en: "Confirm your role once a family member names you in a verified succession record.", desc_sw: "Thibitisha jukumu lako mara mwanafamilia atakapokutaja kwenye kumbukumbu ya urithi iliyothibitishwa." },
  { value: "executor", en: "Estate Executor", sw: "Msimamizi wa Mirathi", desc_en: "Track an estate's succession progress once a property owner appoints and links you.", desc_sw: "Fuatilia maendeleo ya urithi mara mmiliki wa mali atakapokuteua na kukuunganisha." },
  { value: "witness", en: "Family Witness", sw: "Shahidi wa Familia", desc_en: "Review and confirm succession records you're asked to witness.", desc_sw: "Pitia na thibitisha kumbukumbu za urithi ulizoombwa kushuhudia." },
  { value: "leader", en: "Local Government Leader", sw: "Kiongozi wa Serikali za Mitaa", desc_en: "Give leader-level verification on succession records in your area.", desc_sw: "Toa uthibitisho wa kiongozi kwenye kumbukumbu za urithi katika eneo lako." },
  { value: "legal", en: "Legal Officer", sw: "Afisa Sheria", desc_en: "Conduct legal review of succession records referred for legal verification.", desc_sw: "Fanya mapitio ya kisheria ya kumbukumbu za urithi zilizopelekwa kwa uthibitisho wa kisheria." },
  { value: "admin", en: "System Administrator", sw: "Msimamizi wa Mfumo", desc_en: "Oversee users and system-wide administration.", desc_sw: "Simamia watumiaji na uendeshaji wa mfumo mzima." },
  { value: "auditor", en: "System Auditor", sw: "Mkaguzi wa Mfumo", desc_en: "Read-only access to audit logs and compliance records.", desc_sw: "Ufikiaji wa kusoma tu wa kumbukumbu za ukaguzi na uzingatiaji." },
];

export default function RegisterPage() {
  const supabase = createClient();
  const router = useRouter();
  const { lang } = useLanguage();
  const sw = lang === "sw";
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("owner");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, phone_number: phone, role },
      },
    });

    setLoading(false);

    const duplicateMsg = sw
      ? "Barua pepe hii tayari imesajiliwa. Tafadhali ingia badala yake, au tumia barua pepe nyingine."
      : "This email is already registered. Please sign in instead, or use a different email.";

    if (signUpError) {
      if (/already registered|already exists|user_already_exists/i.test(signUpError.message)) {
        setError(duplicateMsg);
      } else {
        setError(signUpError.message);
      }
      return;
    }

    // Supabase does not always return an error for a duplicate email (to avoid leaking which
    // emails are registered) — instead it returns a user with an empty `identities` array.
    // That is the documented way to detect "this email is already taken" in that case.
    if (signUpData.user && signUpData.user.identities && signUpData.user.identities.length === 0) {
      setError(duplicateMsg);
      return;
    }

    // With real email confirmation enabled, Supabase returns a user but no session until the
    // confirmation link is clicked -- signing in immediately would just fail with "Email not
    // confirmed", so send them to a dedicated waiting screen instead of straight to /login.
    if (signUpData.user && !signUpData.session) {
      setAwaitingConfirmation(true);
      return;
    }

    router.push("/login?registered=1");
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

  if (awaitingConfirmation) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6 py-10 bg-surface">
        <div className="w-full max-w-md text-center">
          <img src="/nembo.png" alt="URT" className="mx-auto mb-4 h-12 w-12 object-contain" />
          <div className="card space-y-4">
            <h1 className="text-lg font-semibold text-neutralDark">
              {sw ? "Thibitisha Barua Pepe Yako" : "Confirm Your Email"}
            </h1>
            <p className="text-sm text-neutralDark">
              {sw
                ? `Tumetuma kiungo cha uthibitisho kwa ${email}. Bofya kiungo hicho ili kuamilisha akaunti yako, kisha rudi hapa uingie.`
                : `We've sent a confirmation link to ${email}. Click that link to activate your account, then come back here to sign in.`}
            </p>
            <p className="text-xs text-inkSoft">
              {sw
                ? "Haujaipata? Angalia folda ya Spam/Junk, au tuma tena hapa chini."
                : "Didn't get it? Check your Spam/Junk folder, or resend it below."}
            </p>
            {resendMsg && <div role="status" className="text-xs text-secondary bg-white border border-secondary px-3 py-2">{resendMsg}</div>}
            <button onClick={handleResend} disabled={resending} className="btn-outline text-sm w-full">
              {resending ? (sw ? "Inatuma…" : "Resending…") : sw ? "Tuma Tena Barua Pepe" : "Resend Confirmation Email"}
            </button>
            <Link href="/login" className="text-primary text-sm font-medium block">
              {sw ? "Nenda kwenye Ukurasa wa Kuingia" : "Go to Sign In"}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-10 bg-surface">
      <div className="w-full max-w-lg">
        <div className="flex justify-end mb-3">
          <LanguageToggle />
        </div>
        <div className="text-center mb-6">
          <img src="/nembo.png" alt="URT" className="mx-auto mb-3 h-12 w-12 object-contain" />
          <h1 className="text-xl font-semibold text-neutralDark">{sw ? "Fungua Akaunti Yako" : "Create your account"}</h1>
        </div>
        <form onSubmit={handleSubmit} className="card space-y-4">
          {error && (
            <div role="alert" className="bg-white text-red-800 text-sm px-3 py-2 border border-red-800">
              {error}
            </div>
          )}

          <div>
            <label className="label">{sw ? "Ninajisajili kama" : "I am registering as"}</label>
            <div className="grid grid-cols-1 gap-2">
              {ROLES.map((r) => (
                <label
                  key={r.value}
                  className={`flex items-start gap-3 border p-3 cursor-pointer transition ${
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
                    <span className="block text-sm font-medium text-neutralDark">{sw ? r.sw : r.en}</span>
                    <span className="block text-xs text-neutralDark">{sw ? r.desc_sw : r.desc_en}</span>
                  </span>
                </label>
              ))}
            </div>
            <p className="text-xs text-neutralDark mt-1">
              {sw
                ? "Kumbuka: uchaguzi huru wa jukumu ni kwa ajili ya tathmini. Kwenye uzalishaji, akaunti za Shahidi, Kiongozi, na Msimamizi zinapaswa kuundwa kwa mwaliko tu."
                : "Demo note: open role selection is for evaluation purposes. In production, Witness, Leader, and Admin accounts should be created by invitation only."}
            </p>
            <p className="text-xs text-inkSoft mt-2 bg-neutralLight border border-gray-200 px-3 py-2">
              {sw
                ? "Unamuongeza mtoto au mwanafamilia asiye na barua pepe? Huhitaji kumfungulia akaunti hapa — Mmiliki wa Mali anamuongeza moja kwa moja kutoka Sajili ya Muundo wa Familia ndani ya programu. Fomu hii ni kwa ajili ya watu watakaoingia (login) wenyewe tu."
                : "Adding a child or family member who does not have an email address? You do not need to create an account for them here — the Property Owner adds them directly from the Family Structure Registry inside the app. This form is only for people who will sign in themselves."}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{sw ? "Jina Kamili" : "Full Name"}</label>
              <input required className="input-field" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div>
              <label className="label">{sw ? "Namba ya Simu" : "Phone Number"}</label>
              <input required className="input-field" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+255…" />
            </div>
          </div>
          <div>
            <label className="label">{sw ? "Barua Pepe" : "Email"}</label>
            <input type="email" required className="input-field" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label">{sw ? "Neno la Siri" : "Password"}</label>
            <input type="password" required minLength={6} className="input-field" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? (sw ? "Inafungua akaunti…" : "Creating account…") : sw ? "Fungua Akaunti" : "Create Account"}
          </button>
        </form>
        <p className="text-center text-sm text-neutralDark mt-4">
          {sw ? "Una akaunti tayari?" : "Already have an account?"}{" "}
          <Link href="/login" className="text-primary font-medium">
            {sw ? "Ingia" : "Sign in"}
          </Link>
        </p>
      </div>
    </main>
  );
}
