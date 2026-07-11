import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Always re-derives the next incomplete onboarding step from real data, rather than trusting
 * a URL flag that's lost the moment a user enters through any link other than the wizard's own
 * (dashboard quick actions, a list page's own "add" button, the sidebar, etc.). Returns null
 * once every step is genuinely complete.
 */
export async function getNextOnboardingHref(
  supabase: SupabaseClient,
  ownerId: string,
  fallback: string | null = null
): Promise<string | null> {
  try {
    const [{ count: properties }, { count: family }, { count: beneficiaries }, { count: executors }, { data: records }] =
      await Promise.all([
        supabase.from("dfp_properties").select("id", { count: "exact", head: true }).eq("owner_id", ownerId),
        supabase.from("dfp_family_members").select("id", { count: "exact", head: true }).eq("owner_id", ownerId),
        supabase.from("dfp_beneficiaries").select("id", { count: "exact", head: true }).eq("owner_id", ownerId),
        supabase.from("dfp_executors").select("id", { count: "exact", head: true }).eq("owner_id", ownerId).eq("status", "active"),
        supabase.from("dfp_succession_records").select("status").eq("owner_id", ownerId),
      ]);

    if ((properties ?? 0) === 0) return "/owner/properties/new?onboarding=1";
    if ((family ?? 0) === 0) return "/owner/family?onboarding=1";
    if ((beneficiaries ?? 0) === 0) return "/owner/beneficiaries?onboarding=1";
    if ((executors ?? 0) === 0) return "/owner/executors?onboarding=1";

    const hasSubmittedRecord = (records ?? []).some((r) => r.status !== "draft");
    if (!hasSubmittedRecord) return "/owner/succession-plans/new?onboarding=1";

    return null;
  } catch (err) {
    // A flaky count query must never trap the user on the page they just submitted —
    // fall back to whatever the caller knows is the sane next step for its own context.
    console.error("getNextOnboardingHref failed, using fallback", err);
    return fallback;
  }
}
