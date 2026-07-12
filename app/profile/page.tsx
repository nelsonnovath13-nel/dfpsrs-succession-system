"use client";

import { useEffect, useState } from "react";
import { User as UserIcon, Camera, Fingerprint, Trash2 } from "lucide-react";
import { startRegistration } from "@simplewebauthn/browser";
import DashboardShell from "@/components/DashboardShell";
import { LanguageToggle, useLanguage } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { withTimeout } from "@/lib/withTimeout";

type Passkey = { id: string; nickname: string | null; device_type: string | null; created_at: string; last_used_at: string | null };

type Role = "owner" | "witness" | "leader" | "admin" | "beneficiary" | "legal" | "auditor" | "executor";

export default function ProfilePage() {
  const supabase = createClient();
  const { lang } = useLanguage();
  const sw = lang === "sw";

  const [role, setRole] = useState<Role | null>(null);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [registeringPasskey, setRegisteringPasskey] = useState(false);
  const [passkeyMsg, setPasskeyMsg] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await withTimeout(supabase.auth.getUser(), 15000, { data: { user: null } } as any);
      if (!user) {
        setLoading(false);
        return;
      }
      setEmail(user.email ?? "");
      // national_id is no longer selectable via a plain table read (closed a cross-user PII
      // exposure) -- this RPC returns only the caller's own profile, including that field.
      const { data: profile } = await withTimeout(supabase.rpc("dfp_get_my_profile"), 15000, { data: null } as any);
      if (profile) {
        setFullName(profile.full_name ?? "");
        setPhoneNumber(profile.phone_number ?? "");
        setNationalId(profile.national_id ?? "");
        setRole(profile.role);
        setAvatarPath(profile.avatar_path ?? null);
        if (profile.avatar_path) {
          const { data: signed } = await supabase.storage.from("dfp-documents").createSignedUrl(profile.avatar_path, 3600);
          if (signed) setAvatarUrl(signed.signedUrl);
        }
      }
      const { data: pk } = await supabase
        .from("dfp_webauthn_credentials")
        .select("id, nickname, device_type, created_at, last_used_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setPasskeys(pk ?? []);

      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadPasskeys() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: pk } = await supabase
      .from("dfp_webauthn_credentials")
      .select("id, nickname, device_type, created_at, last_used_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setPasskeys(pk ?? []);
  }

  async function handleRegisterPasskey() {
    setPasskeyMsg(null);
    setRegisteringPasskey(true);
    try {
      const optionsRes = await fetch("/api/webauthn/register/options", { method: "POST" });
      const options = await optionsRes.json();
      if (!optionsRes.ok) throw new Error(options.error ?? "Could not start passkey registration");

      const nickname =
        typeof window !== "undefined" && /iphone|ipad|mac/i.test(navigator.userAgent)
          ? "Face ID / Touch ID"
          : /android/i.test(navigator.userAgent)
          ? "Android fingerprint"
          : "Windows Hello / device passkey";

      const attResp = await startRegistration({ optionsJSON: options });

      const verifyRes = await fetch("/api/webauthn/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: attResp, nickname }),
      });
      const verifyJson = await verifyRes.json();
      if (!verifyRes.ok || !verifyJson.verified) throw new Error(verifyJson.error ?? "Could not verify this device");

      setPasskeyMsg({ type: "ok", text: sw ? "Kifaa chako kimesajiliwa kama njia ya kuingia." : "This device has been registered as a passkey." });
      await loadPasskeys();
    } catch (e: any) {
      setPasskeyMsg({
        type: "error",
        text:
          e?.name === "NotAllowedError"
            ? sw
              ? "Usajili umeghairiwa au kifaa hakina alama ya kidole/uso."
              : "Registration was cancelled, or this device has no fingerprint/face sensor set up."
            : e.message ?? (sw ? "Imeshindikana kusajili kifaa." : "Could not register this device."),
      });
    } finally {
      setRegisteringPasskey(false);
    }
  }

  async function handleDeletePasskey(id: string) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("dfp_webauthn_credentials").delete().eq("id", id).eq("user_id", user.id);
    await loadPasskeys();
  }

  async function handlePhotoChange(file: File) {
    setUploadingPhoto(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setUploadingPhoto(false);
      return;
    }
    const path = `${user.id}/avatar/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from("dfp-documents").upload(path, file, { upsert: false });
    if (uploadError) {
      setUploadingPhoto(false);
      setProfileMsg({ type: "error", text: uploadError.message });
      return;
    }
    const previousPath = avatarPath;
    const { error: updateError } = await supabase.from("dfp_profiles").update({ avatar_path: path }).eq("id", user.id);
    if (updateError) {
      setUploadingPhoto(false);
      setProfileMsg({ type: "error", text: updateError.message });
      return;
    }
    if (previousPath) {
      await supabase.storage.from("dfp-documents").remove([previousPath]);
    }
    setAvatarPath(path);
    const { data: signed } = await supabase.storage.from("dfp-documents").createSignedUrl(path, 3600);
    if (signed) setAvatarUrl(signed.signedUrl);
    setUploadingPhoto(false);
    setProfileMsg({ type: "ok", text: sw ? "Picha imehifadhiwa." : "Photo saved." });
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setProfileMsg(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }
    const { error } = await supabase
      .from("dfp_profiles")
      .update({ full_name: fullName, phone_number: phoneNumber || null })
      .eq("id", user.id);
    setSaving(false);
    setProfileMsg(
      error
        ? { type: "error", text: error.message }
        : { type: "ok", text: sw ? "Taarifa zimehifadhiwa." : "Your details have been saved." }
    );
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    if (newPassword.length < 6) {
      setPwMsg({ type: "error", text: sw ? "Neno la siri lazima liwe na herufi 6 au zaidi." : "Password must be at least 6 characters." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwMsg({ type: "error", text: sw ? "Maneno ya siri hayafanani." : "Passwords do not match." });
      return;
    }
    setPwSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPwSaving(false);
    if (error) {
      setPwMsg({ type: "error", text: error.message });
      return;
    }
    setNewPassword("");
    setConfirmPassword("");
    setPwMsg({ type: "ok", text: sw ? "Neno la siri limebadilishwa." : "Your password has been changed." });
  }

  if (loading || !role) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-neutralDark">{sw ? "Inapakia…" : "Loading…"}</p>
      </div>
    );
  }

  return (
    <DashboardShell role={role}>
      <h1 className="text-xl font-semibold text-primary mb-6">{sw ? "Wasifu Wangu" : "My Profile"}</h1>

      <div className="max-w-xl space-y-6">
        <form onSubmit={handleSaveProfile} className="card space-y-4">
          <h2 className="font-semibold text-primary text-sm uppercase tracking-wide">
            {sw ? "Taarifa Binafsi" : "Personal Details"}
          </h2>
          {profileMsg && (
            <div
              role="alert"
              className={`text-sm px-3 py-2 border ${
                profileMsg.type === "ok" ? "bg-white text-secondary border-secondary" : "bg-white text-danger border-danger"
              }`}
            >
              {profileMsg.text}
            </div>
          )}
          <div>
            <label className="label">{sw ? "Picha ya Wasifu (kwa Cheti)" : "Profile Photo (for Certificates)"}</label>
            <div className="flex items-center gap-4">
              <span className="w-20 h-24 border-2 border-gray-300 bg-neutralLight flex items-center justify-center overflow-hidden shrink-0">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={sw ? "Picha ya wasifu" : "Profile photo"} className="w-full h-full object-cover" />
                ) : (
                  <UserIcon size={28} className="text-inkSoft" aria-hidden="true" />
                )}
              </span>
              <div>
                <label className="btn-outline text-sm cursor-pointer inline-flex items-center gap-2">
                  <Camera size={16} aria-hidden="true" />
                  {uploadingPhoto ? (sw ? "Inapakia…" : "Uploading…") : sw ? "Badilisha Picha" : "Upload Photo"}
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png"
                    className="hidden"
                    disabled={uploadingPhoto}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handlePhotoChange(file);
                    }}
                  />
                </label>
                <p className="text-xs text-inkSoft mt-1">
                  {sw
                    ? "Tumia picha ya rasmi, kama ya pasipoti — itaonekana kwenye vyeti vyako vya urithi vitakapochapishwa."
                    : "Use a formal, passport-style photo — it will appear on your succession certificates when printed."}
                </p>
              </div>
            </div>
          </div>
          <div>
            <label className="label">{sw ? "Barua Pepe" : "Email"}</label>
            <input className="input-field bg-gray-100" value={email} disabled readOnly />
          </div>
          <div>
            <label className="label">{sw ? "Jina Kamili" : "Full Name"}</label>
            <input required className="input-field" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div>
            <label className="label">{sw ? "Namba ya Simu" : "Phone Number"}</label>
            <input className="input-field" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
          </div>
          {nationalId && (
            <div>
              <label className="label">{sw ? "Namba ya NIDA" : "National ID"}</label>
              <input className="input-field bg-gray-100" value={nationalId} disabled readOnly />
            </div>
          )}
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? (sw ? "Inahifadhi…" : "Saving…") : sw ? "Hifadhi Taarifa" : "Save Details"}
          </button>
        </form>

        <form onSubmit={handleChangePassword} className="card space-y-4" id="security">
          <h2 className="font-semibold text-primary text-sm uppercase tracking-wide">
            {sw ? "Usalama — Badilisha Neno la Siri" : "Security — Change Password"}
          </h2>
          {pwMsg && (
            <div
              role="alert"
              className={`text-sm px-3 py-2 border ${
                pwMsg.type === "ok" ? "bg-white text-secondary border-secondary" : "bg-white text-danger border-danger"
              }`}
            >
              {pwMsg.text}
            </div>
          )}
          <div>
            <label className="label">{sw ? "Neno Jipya la Siri" : "New Password"}</label>
            <input
              type="password"
              className="input-field"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={6}
            />
          </div>
          <div>
            <label className="label">{sw ? "Thibitisha Neno la Siri" : "Confirm Password"}</label>
            <input
              type="password"
              className="input-field"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={6}
            />
          </div>
          <button type="submit" disabled={pwSaving} className="btn-primary">
            {pwSaving ? (sw ? "Inabadilisha…" : "Changing…") : sw ? "Badilisha Neno la Siri" : "Change Password"}
          </button>
        </form>

        <div className="card space-y-4">
          <h2 className="font-semibold text-primary text-sm uppercase tracking-wide flex items-center gap-2">
            <Fingerprint size={16} aria-hidden="true" /> {sw ? "Alama ya Kidole / Passkey" : "Fingerprint / Passkey"}
          </h2>
          <p className="text-sm text-inkSoft">
            {sw
              ? "Sajili kifaa hiki (alama ya kidole, uso, au PIN ya kifaa) kama njia ya ziada, ya haraka na salama ya kuthibitisha ni wewe — kwa mfano wakati wa kufungua Hazina ya Familia kama mtu wa kuaminika. Hii haichukui nafasi ya neno la siri."
              : "Register this device's fingerprint, face, or device PIN as an extra, fast, secure way to prove it's really you — for example when unlocking a Family Vault as a trusted contact. This does not replace your password."}
          </p>
          {passkeyMsg && (
            <div
              role="alert"
              className={`text-sm px-3 py-2 border ${
                passkeyMsg.type === "ok" ? "bg-white text-secondary border-secondary" : "bg-white text-danger border-danger"
              }`}
            >
              {passkeyMsg.text}
            </div>
          )}
          {passkeys.length > 0 && (
            <div className="border border-gray-300 divide-y divide-gray-200">
              {passkeys.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-3 py-2">
                  <div>
                    <p className="text-sm text-ink">{p.nickname ?? (sw ? "Kifaa" : "Device")}</p>
                    <p className="text-xs text-inkSoft">
                      {sw ? "Imesajiliwa" : "Registered"} {new Date(p.created_at).toLocaleDateString()}
                      {p.last_used_at && ` • ${sw ? "Ilitumika mara ya mwisho" : "Last used"} ${new Date(p.last_used_at).toLocaleDateString()}`}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeletePasskey(p.id)}
                    className="text-danger"
                    aria-label={sw ? "Ondoa kifaa hiki" : "Remove this device"}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <button onClick={handleRegisterPasskey} disabled={registeringPasskey} className="btn-outline text-sm inline-flex items-center gap-2">
            <Fingerprint size={16} aria-hidden="true" />
            {registeringPasskey ? (sw ? "Inasajili…" : "Registering…") : sw ? "Sajili Kifaa Hiki" : "Register This Device"}
          </button>
        </div>

        <div className="card space-y-3">
          <h2 className="font-semibold text-primary text-sm uppercase tracking-wide">{sw ? "Lugha" : "Language"}</h2>
          <LanguageToggle />
        </div>
      </div>
    </DashboardShell>
  );
}
