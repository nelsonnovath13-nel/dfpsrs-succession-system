# Database Reference — dfpsrs-succession-system (Supabase project nqrhqpwfmprtwhfmlrcz)

This file is a REFERENCE ONLY. The actual database already exists live on Supabase.
It is provided so a new AI assistant (or Nelson) can understand the schema without
needing to re-run migrations. DO NOT re-run these as fresh migrations against the
live project — they have already been applied.

Project ref: nqrhqpwfmprtwhfmlrcz
Org: uqivytdlwjtrbuvhkyqn (Nexova)
URL: https://nqrhqpwfmprtwhfmlrcz.supabase.co

## Tables (all prefixed dfp_, schema public, RLS enabled on all)
- dfp_profiles (id, full_name, phone_number, national_id, role[owner|witness|leader|admin|beneficiary|legal|auditor], is_suspended)
- dfp_properties (id, owner_id, property_number [auto PR-YYYY-######], name, category, ownership_type, estimated_value, location, description, status)
- dfp_property_documents (id, property_id, file_path, file_name, category, uploaded_by)
- dfp_beneficiaries (id, owner_id, full_name, relationship, phone_number, national_id, linked_user_id)
- dfp_family_members (id, owner_id, full_name, relationship_type[father|mother|spouse|child|dependent|extended], phone_number, national_id, date_of_birth)
- dfp_succession_records (id, owner_id, title, instructions, status[draft|submitted|witness_review|local_leader_review|legal_review|verified|rejected|archived], submitted_at, finalized_at)
- dfp_property_allocations (id, succession_record_id, property_id, beneficiary_id, share_percentage) -- trigger enforces sum <= 100% per property
- dfp_witnesses (succession_record_id, witness_user_id)
- dfp_leaders (succession_record_id, leader_user_id)
- dfp_legal_officers (succession_record_id, legal_officer_id)
- dfp_verifications (id, succession_record_id, verifier_id, verifier_role[witness|leader|legal], decision[pending|approved|rejected], comment, decided_at)
- dfp_notifications (id, user_id, title, message, is_read)
- dfp_audit_logs (id, user_id, action, reference_table, created_at) -- auto-populated via triggers
- dfp_beneficiary_confirmations (id, succession_record_id, beneficiary_id, status[pending|accepted|declined], responded_at)
- dfp_public_verifications (id, succession_record_id, public_token, content_hash) -- powers the /verify/[token] QR page

## Key functions (SECURITY DEFINER, search_path=public)
- dfp_handle_new_user() -- trigger, auto-creates profile row on signup
- dfp_auto_confirm_email() -- trigger, auto-confirms email so users can sign in immediately (demo-only shortcut, see Known Limitations)
- dfp_check_allocation_total() -- trigger, blocks allocations exceeding 100% per property
- dfp_write_audit() -- generic audit trigger attached to key tables
- dfp_submit_succession_record(p_record_id uuid) -- RPC called from the "New Succession Record" form; creates witness/leader verification rows, sends notifications
- dfp_process_verification_decision() -- trigger on dfp_verifications; advances dfp_succession_records.status through the workflow as each verifier decides
- dfp_create_legal_verifications() -- trigger on dfp_succession_records; when status flips to legal_review, creates the pending legal verification rows
- dfp_finalize_record(p_record_id uuid) -- called when a record reaches "verified"; creates beneficiary confirmations, notifications, and the dfp_public_verifications row (QR)
- dfp_get_public_verification(p_token text) -- RPC, granted to anon, powers the public /verify/[token] page (returns only status/title/finalized_at/content_hash, never private data)

## Status workflow
draft -> submitted -> witness_review -> local_leader_review -> [legal_review if a legal officer is assigned] -> verified
(any stage) -> rejected is possible if a verifier rejects

## Storage
Bucket: dfp-documents (private). Policies: owner can read/write their own property's docs;
witness/leader/legal assigned to a record's succession chain can read docs for properties in that record.

## RLS pattern
Every table's SELECT/INSERT/UPDATE/DELETE policies check auth.uid() against owner_id / verifier_id /
linked_user_id, or check dfp_profiles.role for admin/auditor blanket read access. Auditor role is
READ-ONLY across dfp_audit_logs, dfp_succession_records, dfp_properties, dfp_verifications.

## Phase 1 additions (2026-07-11) — Family Tree/Executor, Death Verification/Release,
## Estate Dashboard, Disputes/Legal/Versioning

Applied live via Supabase MCP (project nqrhqpwfmprtwhfmlrcz), not a local migration file. Additive
only — no existing columns/tables removed or renamed. Full plan: see the ERD/schema/role-matrix/
security-review writeup delivered alongside this change (chat history), replicated in summary below.

**New columns:**
- `dfp_family_members.parent_member_id uuid null references dfp_family_members(id)` — builds
  family tree hierarchy (a member's parent row; null = root, e.g. father/mother/spouse of owner).
- `dfp_succession_records.is_locked boolean default false` — set true by trigger once status
  reaches `verified`; blocks further UI edits (enforce via UI; no RLS-level UPDATE block was
  added in Phase 1, see Known Limitations below).
- `dfp_succession_records.current_version int default 1` — maintained by
  `dfp_create_version_snapshot()` trigger.

**Role:** `dfp_profiles.role` check constraint now also allows `'executor'` (8th role).

**New tables:** `dfp_executors`, `dfp_death_verifications`, `dfp_death_verification_steps`,
`dfp_succession_record_versions`, `dfp_disputes`, `dfp_dispute_evidence`, `dfp_dispute_notes`,
`dfp_legal_flags`. See migration history in Supabase (`phase1_new_tables_and_columns`) for exact
column lists — mirrors the shape of `dfp_verifications`/`dfp_witnesses`/`dfp_property_documents`
for consistency (status/decision enums as varchar check constraints, `owner_id`/`verifier_id`
foreign keys to `dfp_profiles`).

**New functions/triggers (SECURITY DEFINER, search_path=public, EXECUTE revoked from
public/anon/authenticated except where noted):**
- `dfp_report_death(p_owner_id)` — RPC, granted to `authenticated`. Caller must be admin, or a
  witness/leader already assigned to that owner's succession record(s). Creates the
  `dfp_death_verifications` row + witness/leader `dfp_death_verification_steps` rows.
- `dfp_advance_death_verification()` — trigger on `dfp_death_verification_steps` UPDATE, advances
  `dfp_death_verifications.status` through witness_confirmed → leader_confirmed →
  (legal_reviewed if a legal officer is assigned) → confirmed, mirroring
  `dfp_process_verification_decision()`.
- `dfp_finalize_death_and_release(p_death_verification_id)` — trigger-only (not directly
  callable). Sets `released_at`, notifies linked beneficiaries/executors.
- `dfp_lock_record_on_verified()` — trigger (BEFORE UPDATE on `dfp_succession_records`), sets
  `is_locked = true` when status flips to `verified`.
- `dfp_create_version_snapshot()` — trigger (BEFORE INSERT/UPDATE on `dfp_succession_records`),
  writes a `dfp_succession_record_versions` snapshot row on every create/edit.
- `dfp_restore_version(p_record_id, p_version_number)` — RPC, granted to `authenticated`. Owner
  only, blocked if `is_locked = true`.
- `dfp_estate_completeness(p_owner_id)` — RPC, granted to `authenticated`. Returns
  `{score int, missing jsonb}` computed from properties/documents/beneficiary confirmations/
  witnesses/leader/executor presence.
- Audit triggers (`dfp_write_audit`) attached to `dfp_executors`, `dfp_death_verifications`,
  `dfp_death_verification_steps`, `dfp_disputes`, `dfp_dispute_notes`, `dfp_legal_flags`.

**Death-verification content gate:** a new `dfp_succession_death_gate_read` SELECT policy on
`dfp_succession_records` grants executors read access to an owner's records once
`dfp_death_verifications.status = 'released'`. **Known limitation:** this is additive to, not a
replacement for, the pre-existing `dfp_succession_beneficiary_read` policy, which already grants
beneficiaries unconditional read access regardless of death-verification state (that policy
predates this feature and was left untouched to avoid breaking the existing beneficiary flow for
owners who never start a death-verification workflow). If a hard "no content before release" gate
for beneficiaries is required, `dfp_succession_beneficiary_read` needs to be tightened in a future
migration — flagged here, not done in Phase 1.

**Record locking is RLS-enforced, not just UI-hidden:** `dfp_succession_owner_all` (the old
blanket owner ALL policy) was split into `dfp_succession_owner_read/insert/delete` (unrestricted)
and `dfp_succession_owner_update` (blocked when `is_locked = true`), plus a separate
`dfp_succession_admin_update` policy so admins can unlock records. A direct table update by the
owner cannot bypass the lock even if the UI's disabled state were circumvented.
