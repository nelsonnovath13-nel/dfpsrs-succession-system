import { createBrowserClient } from "@supabase/ssr";

// These are the public URL + anon key for the DFPSRS Supabase project.
// The anon key is safe to expose client-side by design — all access control
// is enforced by Row Level Security policies on the database, not by hiding this key.
export const SUPABASE_URL = "https://nqrhqpwfmprtwhfmlrcz.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xcmhxcHdmbXBydHdoZm1scmN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3MDM2NDgsImV4cCI6MjA5OTI3OTY0OH0.xzdb9a4IPWyh_NzYOQ76EoKBowX4_1Z3GSfrZEwosoQ";

export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
