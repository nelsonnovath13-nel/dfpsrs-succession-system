# Digital Family Property & Succession Records System — Project Handoff

Read this file FIRST before touching any code. It tells you exactly what this project
is, what's built, what's not, and how to keep working on it safely.

## 1. What this is

A real, deployed web app (not a mockup) for Tanzania: it lets a person record their
family property and their intended succession plan while they're alive, and get it
verified through a multi-party workflow: 2+ family witnesses → a Local Government
Leader → optionally a Legal Officer. Verified records get a public QR-code
verification page that proves authenticity without exposing private data.

Built for: Nelson, a BCS student at IAA Arusha, for a client/university project
(a BIT Year 3 student's final year project), on Nelson's freelance agency "Nexova"
tooling. Original academic deliverable was a Kiswahili SRS document; Nelson then
asked for the actual working system to be built and deployed, which this is.

## 2. Live infrastructure (already running — do not recreate)

- **Database:** Supabase project `nqrhqpwfmprtwhfmlrcz` ("dfpsrs-succession-system"),
  org `uqivytdlwjtrbuvhkyqn` ("Nexova"). URL: `https://nqrhqpwfmprtwhfmlrcz.supabase.co`
  Anon key is already embedded in `lib/supabase/client.ts` — do not regenerate it
  unless you're rotating keys on purpose.
- **Hosting:** Vercel project `dfpsrs-succession-system`, team
  `team_tCVftLOUyAMkD1ymnZY6djg0`. Production URL:
  `https://dfpsrs-succession-system.vercel.app`
- **Schema:** already fully applied to the live database. See
  `database/schema_notes.md` in this zip for the full table/function reference.
  Do NOT re-run it as a fresh migration — it already exists. Only write NEW
  migrations for NEW changes.

## 3. Tech stack

Next.js 14 (App Router) + TypeScript + Tailwind CSS + Supabase (Postgres, Auth,
Storage, RLS). No ORM — direct Supabase client calls (`lib/supabase/client.ts` for
browser, `lib/supabase/server.ts` for server components). `middleware.ts` handles
auth/role-based route protection. `lib/i18n.tsx` provides English/Kiswahili
bilingual support via a `LanguageProvider` + `useLanguage()` hook + `<LanguageToggle />`.

## 4. Design system (already established — follow it, don't reinvent)

Formal government-register look, NOT a startup/SaaS look:
- Colors: primary `#0F3D66` (navy), secondary `#1E5631` (green), neutral grays.
  Defined in `tailwind.config.ts`.
- Square/rectangular elements, thin borders (`border border-gray-300` etc.), NOT
  rounded-xl/shadow-heavy cards. See `.card`, `.btn-primary`, `.badge` etc. in
  `app/globals.css` — reuse these classes, don't invent new button styles.
- NO emoji anywhere in the UI. Use text labels or simple monochrome symbols (✓, ✕)
  only where already established (e.g. `components/ui.tsx` VerificationTimeline).
- Every dashboard page is wrapped in `<DashboardShell role="...">` — this gives the
  header, sidebar nav, language toggle, sign-out. Don't build your own page chrome.
- Printable reports use a `no-print` CSS class on anything that shouldn't appear
  when the browser print dialog is used (see `app/owner/reports/page.tsx`).

## 5. Roles (7 total)

owner, witness, leader, legal, admin, auditor, beneficiary — each has its own
route prefix (`/owner/*`, `/witness/*`, etc.) enforced by `middleware.ts`, and its
own nav items defined in `components/DashboardShell.tsx`'s `buildNav()`.
Registration currently allows open self-selection of any role (flagged in the UI
as "demo note" — in real production this should be invitation-only for
witness/leader/legal/admin/auditor).

## 6. What's fully built and working

- Full auth (signup/login/logout), auto-email-confirmation so demo users don't
  wait on real email delivery (see Known Limitations — revisit before real launch)
- Property Registry (CRUD, auto property number, ownership type, document uploads
  to private Storage bucket)
- Family Structure Registry (father/mother/spouse/child/dependent/extended)
- Beneficiary Registry, with optional linking to a real registered "beneficiary"
  account by phone number
- Succession Record builder: allocate properties to beneficiaries by %, pick 2+
  witnesses, 1 leader, optional legal officer
- Full verification workflow with status timeline, witness/leader/legal review
  screens (shared `components/VerificationReview.tsx`), approve/reject with
  required comment on rejection
- QR-code public verification page (`/verify/[token]`) — shows authenticity only,
  never private data
- Printable reports: Estate Summary, Property Registry, Beneficiary Report
  (owner); Compliance Report (admin)
- Admin: user management (suspend/reactivate), system-wide audit logs, dashboard
- Auditor: read-only dashboard mirroring admin's audit view
- Beneficiary: view + accept/decline their named role once a record is verified
- Bilingual EN/SW toggle (core chrome + status labels + landing/help/terms/privacy
  pages — not 100% of every micro-copy string in every form)
- Static Help Center, Terms & Conditions, Privacy Policy pages (bilingual)

## 7. What is NOT built yet (be honest with Nelson about this, don't claim it's done)

- Digital signature drawing pad — currently a checkbox + comment + timestamp
  stands in for a "signature"
- PDF certificate export — reports are print-via-browser only (window.print()),
  no server-generated PDF
- SMS notifications — only in-app `dfp_notifications` table, no SMS gateway
  wired up
- Document version history
- Dispute Management module (was in the original design doc's Section 13 "Tier 2"
  list, never built)
- Death Verification / Emergency Access workflow (also Tier 2, never built)
- Other Tier 2 modules from the original design doc (Trusted Contacts UI, Property
  Valuation trend charts, Risk Detection Engine, Geo-mapping, Evidence Vault, AI
  Insights) — none of these exist beyond being mentioned in the academic design
  document
- Full exhaustive bilingual coverage of every single form label
- Real production SMTP email — currently bypassed via `dfp_auto_confirm_email`
  trigger for demo convenience

## 8. Known limitations / things to fix before real-world launch

- Email auto-confirm trigger should be removed and real email verification wired
  up before this handles real people's real property records
- Open role self-registration should be locked down (invite-only for
  witness/leader/legal/admin/auditor)
- No automated tests exist
- No rate limiting on auth endpoints beyond Supabase defaults

## 9. How deployment actually works here (important!)

There is no GitHub repo connected — the Vercel project is deployed by uploading
the full file tree directly via Vercel's deploy API in one shot. This means:
**every deploy must include ALL project files, every time** — there is no
incremental/partial deploy. If you (or an AI assistant) only send a subset of
files, you will get a broken/incomplete production deployment missing routes.

If you want a saner workflow going forward: connect this Vercel project to a
GitHub repo (push this zip's contents to a new repo, then link it in the Vercel
dashboard) so future deploys are normal `git push` deploys instead of full-tree
uploads. This is the single biggest quality-of-life improvement to make next.

## 10. Local development

```
npm install
npm run dev
```

Needs no `.env` — Supabase URL/anon key are hardcoded in `lib/supabase/client.ts`
(this is fine, the anon key is meant to be public; RLS does the real security
work). To build for production locally: `npm run build`.

## 11. File map

See `database/schema_notes.md` for the DB. For the app itself:
```
app/
  page.tsx                      landing page
  login/, register/             auth
  help/, terms/, privacy/       static bilingual pages
  verify/[token]/               public QR verification page
  owner/                        property owner's whole app
  witness/ leader/ legal/       verifier dashboards + review pages
  admin/                        admin dashboard, users, audit logs, reports
  auditor/                      read-only audit dashboard
  beneficiary/                  beneficiary dashboard
components/
  DashboardShell.tsx            page chrome (header/sidebar) for every dashboard
  VerificationReview.tsx        shared witness/leader/legal review screen
  ui.tsx                        StatCard, StatusBadge, VerificationTimeline
lib/
  i18n.tsx                      bilingual dictionary + provider + toggle
  supabase/client.ts server.ts  Supabase client setup
middleware.ts                   auth + role-based route protection
```
