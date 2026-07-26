# VerexaHQ Tax CRM

A standalone tax practice management platform for tax firms — client
management, tax intake collection, staff review workflows, and document
request tracking, built on Next.js and Supabase.

> ⚠️ **Repository separation**
>
> **This repository belongs only to VerexaHQ Tax CRM and must not be
> connected to the VerexaHQ CRM Supabase project.**
>
> This application is completely separate from the existing VerexaHQ CRM
> (bookkeeping/business-services) application and its Supabase project. Do
> not reuse that project's database, credentials, environment variables,
> Vercel project, or application code in this repository, and do not point
> this repository's environment variables at it.
>
> | | This app (VerexaHQ Tax CRM) | Do NOT use here |
> |---|---|---|
> | Supabase project | **VerexaHQ Tax Office** | VerexaHQ CRM |
> | Supabase project ref | **`aewqbffscdrziiwfomyf`** | `euxfopzgdmlmgcmmjvic` |
> | Supabase URL | `https://aewqbffscdrziiwfomyf.supabase.co` | — |
> | GitHub repo | `simplykryssie-blip/VerexaHQ-Tax-CRM` | `simplykryssie-blip/VerexaHQ` |

## Architecture overview

- **Framework**: Next.js (App Router) + TypeScript + React, Server
  Components by default, Server Actions for mutations.
- **Styling**: Tailwind CSS v4 with a light, teal/green-accented brand theme
  (see `app/globals.css`).
- **Data**: Supabase Postgres, accessed through `@supabase/ssr` with three
  client variants:
  - `lib/supabase/client.ts` — browser client (publishable key only).
  - `lib/supabase/server.ts` — server client for Server Components, Server
    Actions, and Route Handlers (session-scoped, subject to RLS).
  - `lib/supabase/admin.ts` — service-role client, server-only, used only
    where genuinely necessary. Never imported from client code.
  - `lib/supabase/types.ts` — generated database types (see below).
- **Auth**: Supabase SSR auth with session-refresh middleware
  (`middleware.ts` + `lib/supabase/middleware.ts`).
- **Authorization**: every workspace-scoped page/action resolves the
  current workspace from the authenticated user's own `workspace_members`
  rows (`lib/auth/workspace.ts`) — never from a client-supplied ID — and
  checks the user's role before allowing staff actions. Row-Level Security
  in Postgres is the first layer of defense; these server-side checks are
  an additional layer, not a replacement.
- **Validation**: Zod schemas in `lib/validation/*`, enforced in Server
  Actions (`lib/actions/*`) regardless of client-side form validation.
- **Business logic**: intake review/compliance/document-generation logic
  lives in existing Postgres functions (`submit_intake`,
  `validate_intake_submission`, `evaluate_intake_compliance`,
  `generate_intake_document_request`, `begin_intake_review`,
  `review_intake_section`, `request_intake_clarification`,
  `resolve_intake_clarification`, `complete_intake_review`,
  `approve_and_lock_intake`, `reopen_intake`, and related helpers) and is
  invoked via `supabase.rpc(...)` rather than reimplemented in the app.

### Directory layout

```
app/
  (auth)/            login, signup, forgot-password, reset-password
  (app)/              authenticated app shell: dashboard, clients, intakes,
                       document-requests, settings
  auth/callback/      Supabase auth code exchange (email confirm / recovery)
components/
  ui/                 generic design-system primitives
  app/                sidebar, header, shell, sign-out, workspace switcher
  auth/               auth form components
  clients/            client list/detail tab components
  intakes/            intake queue/review components
  document-requests/  document request components
  dashboard/          dashboard cards
lib/
  supabase/           client/server/middleware/admin clients + generated types
  auth/               session + workspace authorization helpers
  data/                read-side data-access functions, scoped by workspace
  actions/            Server Actions (mutations), Zod-validated
  validation/          Zod schemas
  status.ts            enum -> label/tone mappings for status badges
  types.ts              typed aliases over the generated Database type
```

## Local setup

### Prerequisites

- Node.js 20+
- A Supabase project (see below) — this app expects the **VerexaHQ Tax
  Office** project's existing schema to already be in place.

### Installation

```bash
npm install
```

### Environment variables

Copy `.env.example` to `.env.local` and fill in the values from the
**VerexaHQ Tax Office** Supabase project (ref `aewqbffscdrziiwfomyf`) —
never from the VerexaHQ CRM project:

```bash
cp .env.example .env.local
```

| Variable | Where to find it | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | Already set to `https://aewqbffscdrziiwfomyf.supabase.co` in `.env.example` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API → Publishable/anon key | Safe for the browser |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → Service role key | **Server-only.** Never expose to the browser. Only used in `lib/supabase/admin.ts`, and only where RLS genuinely cannot express the operation. |
| `NEXT_PUBLIC_APP_URL` | — | Base URL used to build auth redirect links (e.g. `http://localhost:3000` locally) |

`.env.local` is gitignored — never commit it.

### Development

```bash
npm run dev
```

### Type-check

```bash
npm run type-check
```

### Lint

```bash
npm run lint
```

### Production build

```bash
npm run build
```

## Regenerating Supabase types

The committed `lib/supabase/types.ts` was generated from the **VerexaHQ Tax
Office** project (`aewqbffscdrziiwfomyf`). The normal way to regenerate it
after a schema change is:

```bash
npx supabase gen types typescript --project-id aewqbffscdrziiwfomyf > lib/supabase/types.ts
```

In this Claude Code execution environment, neither the Supabase CLI (no
`SUPABASE_ACCESS_TOKEN` is available or requested here) nor the
`generate_typescript_types` MCP tool could complete, so the current file was
produced instead by directly introspecting the live database's system
catalogs (`information_schema.columns`, `pg_enum`, `pg_proc`,
`pg_constraint`/`information_schema.table_constraints`) for every table,
view, enum, and function in the `public` schema, then assembling the
`Database` type in the same structure and conventions the official
generator produces. There are no hand-written or manually patched type
blocks left in this file — every table, view, enum, and function entry,
including `conversations`, `messages`, `client_addresses`, and the
`update_client_portal_contact_info` / `update_client_mailing_address`
functions, is derived directly from the live schema. When the CLI/MCP tool
is available, prefer the command above going forward.

Never point this command at any other project ref.

## Authentication setup

This app uses Supabase's SSR auth helpers (`@supabase/ssr`) — no deprecated
`auth-helpers` packages. Flows implemented:

- Sign in / sign up (email + password) — `app/(auth)/login`,
  `app/(auth)/signup`
- Forgot password / reset password — `app/(auth)/forgot-password`,
  `app/(auth)/reset-password`
- Sign out — `components/app/SignOutButton.tsx`
- Email confirmation and password-recovery links are exchanged for a
  session in `app/auth/callback/route.ts`
- `middleware.ts` refreshes the session on every request and redirects
  unauthenticated visitors to `/login` with a safe `redirectTo`

### Supabase Auth redirect URLs to configure

In the Supabase dashboard for the **VerexaHQ Tax Office** project → Authentication
→ URL Configuration, add:

- Site URL: your production URL (e.g. `https://<your-vercel-domain>`)
- Redirect URLs:
  - `http://localhost:3000/auth/callback` (local development)
  - `https://<your-vercel-domain>/auth/callback` (production)
  - `https://<your-preview-domain>/auth/callback` (if using Vercel preview
    deployments)

## Deploying to Vercel

1. Import this repository into a **new** Vercel project (do not reuse the
   VerexaHQ CRM Vercel project).
2. Set the environment variables listed above in Vercel → Project Settings
   → Environment Variables (Production, Preview, and Development as
   needed).
3. Deploy. Vercel will run `npm install` and `npm run build` automatically.
4. Add the deployed domain(s) to the Supabase Auth redirect URL
   configuration above.

## Continuous Integration

`.github/workflows/ci.yml` runs on every pull request targeting `main` and on
every push to `main`. Each run does `npm ci`, then `npm run lint`,
`npm run type-check`, and `npm run build`, followed by a non-blocking
`npm audit --omit=dev --audit-level=high` informational check. It uses Node.js
20 (matching this project's `next` requirement of `>=20.9.0`), minimal
`contents: read` permissions, a concurrency group that cancels superseded
runs, and a 15-minute timeout. The build does not require any Supabase
secrets — the Supabase browser/server clients are only exercised at request
time, not at build time — so the workflow sets `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `NEXT_PUBLIC_APP_URL` directly as
plain (non-secret) workflow values; no repository secrets need to be
configured. **Merges into `main` should wait for this workflow to pass.**

### Supabase function search-path hardening

`supabase/migrations/20260725010000_harden_function_search_paths.sql` pins an
explicit `search_path = public, pg_temp` on the 7 functions the Supabase
security advisor previously flagged as `function_search_path_mutable`
(`create_form_template`, `add_form_question`, `assign_form_to_client`,
`save_form_answer`, `submit_assigned_form`, `mark_assigned_form_reviewed`,
`request_form_changes`), and revokes their unused `PUBLIC`/`anon` EXECUTE
grants (these are staff-only form-builder/assignment functions with no
application caller and no legitimate anonymous use). Function bodies,
signatures, and `SECURITY INVOKER` status are unchanged.

This migration, like every migration in this repository, targets only the
`aewqbffscdrziiwfomyf` (VerexaHQ Tax Office) project — see the separation
warning at the top of this file. The existing VerexaHQ CRM repository and
Supabase project were not accessed while doing this work.

## Security notes

- Row-Level Security is enabled on every table in the Supabase project and
  is never disabled or bypassed from application code.
- Every workspace-scoped query and Server Action re-derives the current
  workspace from the authenticated user's active `workspace_members` rows
  (`lib/auth/workspace.ts`) and explicitly filters by `workspace_id` — a
  workspace ID typed into the URL cannot grant access to another
  workspace's data.
- The Supabase service-role key is read only in `lib/supabase/admin.ts`,
  a server-only module; it is never imported by a Client Component and
  never exposed via a `NEXT_PUBLIC_` variable.
- SSNs and EINs are only ever displayed masked to their last 4 digits
  (`maskLast4` in `lib/utils.ts`); full numbers are never requested or
  rendered by this app.
- Consequential staff actions (approve & lock, reopen) require an explicit
  confirmation dialog, and reopening an intake requires a recorded reason.
- Server-rendered error boundaries avoid leaking raw database error text to
  end users.

## Client Portal (Phase 2)

A separate, client-facing portal lives alongside the staff app, entirely
under `/portal/*` (route group `app/(portal)/`). It shares this app's
Supabase project, auth system, and design language, but staff and portal
navigation are fully separate — the portal shell (`components/portal/*`)
never renders a staff link, and vice versa.

### Client-user mapping model

The schema already had a client-identity model designed in from the start;
this phase used it as-is rather than inventing a new one:

- `clients.portal_user_id` — the primary taxpayer's own `auth.users` id.
- `client_contacts.auth_user_id` (+ `can_access_portal` + `is_active`) — an
  additional contact (e.g. a spouse or authorized representative) granted
  portal access to the same client record.

A single authenticated user can be linked this way to more than one client
record. `lib/auth/portal.ts` resolves "which client(s) can this user act
as" strictly from these two columns for the *authenticated user id* —
never from anything supplied by the browser — mirroring how
`lib/auth/workspace.ts` resolves staff workspace membership. A cookie
(`verexa-client-id`) remembers which linked client is "current" when a
user is linked to more than one, the same way the staff app remembers the
current workspace.

**Staff vs. client landing page**: `resolveAccountType()` checks for an
active `workspace_members` row first; if none exists it checks for a
client link. A user who is both staff and a portal client is treated as
staff by default for sign-in/root-path redirects (documented priority —
see `lib/auth/portal.ts`), but can still reach `/portal/*` directly since
each layout checks the user's *own* access independently. A pure staff
user with no client link sees `PortalNotLinkedState` if they visit
`/portal/*`; a pure client with no workspace membership sees
`NoWorkspaceState` if they visit staff routes — both link across to
whichever area the user actually has access to, so no one is stuck at a
dead end.

### Portal routes

```
app/(portal)/
  layout.tsx                         resolves the current client, renders PortalShell
  portal/
    dashboard/                       status cards, next action, activity feed
    intakes/                         list of the client's intakes by tax year
    intakes/[submissionId]/          section-based intake renderer + Review & Submit
    documents/                       every document the client has uploaded
    document-requests/               document request queue
    document-requests/[requestId]/   requested items + upload
    clarifications/                  open/resolved clarifications + respond
    messages/                        conversation list + start a conversation
    messages/[conversationId]/       message thread + send
    profile/                         overview + self-service contact/address/password
```

Every page resolves the client server-side (`requirePortalAccess()`) and
re-verifies ownership of whatever id appears in the URL (submission,
request, conversation) against that resolved client — a client can never
reach another client's data by editing a URL, and RLS enforces the same
boundary independently as a second layer.

### Intake experience

Non-repeatable sections render from `form_sections`/`form_fields` and
autosave into `intake_answers`, respecting `get_intake_visibility()` so a
client only ever sees questions relevant to their situation — there is no
hard-coded questionnaire. `intake_answers` has no way to represent
multiple instances of one section, so the two repeatable cases use their
proper dedicated tables instead: the "Dependents" section is backed by
`intake_household_people`, and every other repeatable section (self-
employment, rental properties, K-1s, investment sales, etc.) shares one
generic repeatable-entity manager backed by `intake_repeatable_entities`,
mapped from `section_key` to `entity_type` in `lib/intake-entity-map.ts`.
Editing is blocked once a submission is locked or approved, both in the
UI and independently by the database's own `log_intake_answer_change()`
trigger. Submitting calls the existing `submit_intake()` function, and
the action re-reads the submission's status afterward rather than
trusting the RPC's JSON response alone (it silently no-ops if the
submission was locked mid-request).

### Document upload and storage behavior

Uploads go to the existing private **`tax-client-documents`** Storage
bucket — never a public one — at the exact
`{workspace_id}/{client_id}/{timestamp}-{sanitized filename}` path its own
Storage RLS policy requires. The file bytes go straight from the browser
to Storage (using the authenticated session, so Storage's own RLS
enforces ownership independently of the app); a Server Action then
creates the row in the existing `documents` table
(`source='client_upload'`), re-verifying the storage path prefix and —
when the upload is tied to a document request item — that the request
actually belongs to the caller's own client. Viewing an uploaded file uses
a short-lived (5 minute) signed URL, never a public link.

**Supported file types**: PDF, JPG/JPEG, PNG, HEIC/HEIF, CSV, XLS/XLSX,
DOC/DOCX — matching the bucket's own `allowed_mime_types` exactly.
**Size limit**: 50MB, matching the bucket's `file_size_limit`. Both are
enforced client-side (for UX) and by Storage itself (the real boundary);
executable/script files are rejected outright since they're not on the
allow-list. Item counts and document-request status update automatically
via the existing `sync_document_request_item_counts()` trigger once a
document row is linked — there's no separate/competing progress-tracking
system.

### Clarification workflow

A client sees only `intake_review_comments` rows staff marked
`is_client_visible = true`. Responding inserts a **new** comment via the
`intake_review_comments_client_reply` policy added in this branch's
migration — self-authored, client-visible, and always unresolved. A
client can never resolve their own clarification: there is no client
UPDATE policy on this table, and `resolve_intake_clarification()` (staff-
only) is the only path to a resolved state.

### Messaging behavior

`conversations` and `messages` are new tables added in this phase (no
messaging schema previously existed). A client can start a conversation
or reply to one; every mutation re-verifies the conversation belongs to
the caller's own client. Messages are immutable after sending — only
`read_at` can change, enforced by a database trigger — and opening a
thread marks staff-sent messages as read. No SMS/email delivery is
implemented; this is in-app only.

### New migrations (all applied to `aewqbffscdrziiwfomyf` only)

| Migration | Purpose |
|---|---|
| `client_portal_foundation` | **Security fix**: drops `anon_crud_clients`, a pre-existing policy that let any caller read every client row in every workspace with no scoping at all. Adds the `clients_contact_portal_access` and `intake_review_comments_client_reply` policies described above. Creates `conversations`/`messages` with RLS. Adds indexes on `client_contacts.auth_user_id` and `documents.request_item_id`. |
| `client_portal_foundation_grant_hardening` | Tightens function EXECUTE grants on the new trigger/helper functions to match the schema's existing stricter convention. |
| `client_portal_workspace_read_access` | Lets a client read the single `workspaces` row their client record belongs to (needed to display "Your Tax Office" — previously only the overly-broad `anon_crud_workspaces` policy made this incidentally possible). |
| `client_portal_profile_self_service` | Adds `update_client_portal_contact_info()` and `update_client_mailing_address()` — narrow `SECURITY DEFINER` functions that let a client update only their own phone/preferred-contact-method/mailing-address, plus a read-only `client_addresses` policy so the profile page can display what it now lets them edit. |
| `client_portal_profile_grant_hardening` | Revokes `anon` EXECUTE on the two functions above (the initial `revoke ... from public` didn't take effect as expected — verified and fixed). |

No new environment variables were required for this phase.

## Security notes — Phase 2 additions

- **Discovered, out-of-scope security issue**: beyond `anon_crud_clients`
  (fixed above), the schema has several sibling `anon_crud_*` policies
  (`qual: true`, no scoping) on `workspaces`, `services`, `notifications`,
  `form_templates`, `form_questions`, `form_response_answers`, and
  `client_form_assignments`. These predate this branch, aren't touched by
  the client portal's own security guarantees, and weren't fixed here to
  keep this migration scoped — they're flagged as a recommended follow-up
  below.
- RLS is row-level, not column-level: wherever a client needed to edit
  *some but not all* columns of a staff-managed table (`clients`,
  `client_addresses`), this phase used a narrow `SECURITY DEFINER`
  function instead of a broad UPDATE policy, so a compromised or buggy
  client request can't reach columns like `status`, `workspace_id`, or
  assigned preparer.
- Every portal Server Action re-derives the client from the authenticated
  user id and re-verifies ownership of any id in its input (submission,
  request, conversation, document) before mutating — the same "never
  trust an id from the browser" rule the staff app follows for
  workspace-scoped data.

## Tax Engagement Management (Phase 4)

Workflow/engagement management for tracking a tax return or other tax
engagement from intake through filing — creating, assigning, and tracking
engagements, not tax calculation or return preparation itself.

### What already existed vs. what this phase added

An audit of the live schema (Part 1) found that `tax_engagements`,
`engagement_assignments`, `engagement_shares`, `engagement_status_history`,
the `engagement_type`/`engagement_status` enums, and the
`can_access_engagement()` / `can_manage_engagement()` /
`log_engagement_status_change()` functions already existed from an earlier
scaffold. This phase **extended** that foundation rather than duplicating
it:

- Extended the `engagement_type` and `engagement_status` enums with the
  new controlled values below (existing enum values cannot be dropped in
  Postgres, so the original scaffold values remain defined but unused by
  the new UI).
- Converted `tax_engagements.priority` from an unvalidated `smallint`
  (1–5, never read by any application code) to the `engagement_priority`
  enum, and `return_type` from free-form text to the `tax_return_type`
  enum.
- Added the assignment/date/tax-workflow/operational columns described
  below directly onto `tax_engagements`.
- Broadened `engagement_status_history` (already a per-status-change audit
  table) into a general activity log by adding `activity_type`,
  `description`, `old_value`, and `new_value` columns, rather than creating
  a second, competing activity table.
- Reused the existing `documents.engagement_id`, `document_requests
  .engagement_id`, and `intake_submissions.engagement_id` nullable foreign
  keys for linking — no new `engagement_documents` link table was needed,
  since those relationships already existed.
- Added `engagement_notes` and `engagement_reference_sequences` as the only
  genuinely new tables (no equivalent existed).
- **Fixed a pre-existing, unrelated bug found during testing**: two
  separate triggers on `tax_engagements` (`engagement_status_audit` and
  `tax_engagement_status_history`) both called
  `log_engagement_status_change()`, so every insert or status change wrote
  a duplicate activity row. The duplicate trigger predates this branch;
  it's dropped in `20260725020500_fix_duplicate_engagement_status_trigger.sql`.

### Controlled vocabularies

Defined once in `lib/validation/engagements.ts` (Zod schemas/options) and
`lib/status.ts` (staff-facing labels) / `lib/portal-copy.ts` (client-facing
labels) — never hard-coded per component:

- **Engagement type**: individual, business, nonprofit, amended return,
  extension only, tax planning, notice resolution, other.
- **Return type**: 1040, 1040-X, 1065, 1120, 1120-S, 1041, 706, 709, 990,
  941, 940, state individual, state business, local, other.
- **Status** (18 values): draft → awaiting_client / intake_in_progress →
  documents_requested → ready_for_preparation → in_preparation →
  preparer_review → reviewer_review → awaiting_signature → ready_to_file →
  filed → accepted / rejected, plus extended, completed, on_hold,
  cancelled, and archived.
- **Priority**: low, normal, high, urgent.
- **E-file status**: not_started, not_applicable, awaiting_authorization,
  ready, transmitted, accepted, rejected, corrected, paper_filed.
- **Payment status**: not_required, unpaid, partially_paid, paid,
  payment_plan, refund_transfer, waived.

### Status transitions

`lib/engagements/transitions.ts` centralizes every legal status move in
one map (`TRANSITIONS`), rather than letting the UI or a Server Action
allow an arbitrary jump between any two statuses. `checkStatusTransition()`
is consulted both when building the Workflow tab's action buttons and
inside `changeStatusAction` itself — authorization is never enforced by
simply hiding a button. `on_hold` and `extended` are reachable from any
active status; an authorized override (workspace owner/admin/ERO role)
can force any other transition but requires a reason, which is recorded
in the activity log's metadata. `checkTransitionPrerequisites()` enforces
role-assignment rules that depend on more than the status alone (a
preparer must be assigned before moving into preparation; a reviewer must
be assigned before reviewer review; a cancelled engagement must be
reopened before it can be marked filed).

### Engagement reference numbers

Format: `TX-2025-000123` (`TX-{tax_year}-{6-digit sequence}`), unique per
workspace, assigned automatically — the application never generates or
guesses one. `engagement_reference_sequences` holds one counter row per
`(workspace_id, tax_year)`; `next_engagement_reference()` increments it
via `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`, which is atomic and
therefore safe under concurrent inserts (no `SELECT MAX()+1` race). A
`BEFORE INSERT` trigger (`assign_engagement_number_trigger`) calls it
automatically whenever `engagement_number` is null, and a unique index on
`(workspace_id, engagement_number)` backstops it. Verified live with
sequential concurrent-safe test inserts (`TX-2025-000001`,
`TX-2025-000002`, …).

### Staff routes

```
app/(app)/
  engagements/                       searchable/filterable/paginated list
  engagements/new/                   create engagement
  engagements/[engagementId]/        Overview / Workflow / Documents /
                                      Intake & Clarifications / Notes /
                                      Activity tabs
  engagements/[engagementId]/edit/   edit engagement details
```

The list page filters by tax year, status, return type, engagement type,
preparer, reviewer, priority, due-date state (overdue / due within 7 or 30
days / no due date), and client, applied server-side in
`lib/data/engagements.ts`. The Workflow tab exposes status transition
actions, assignment (preparer/reviewer/responsible staff), priority and
due-date editing, extension/e-file controls, and hold/cancel/archive —
every one of them re-validated server-side in `lib/actions/engagements.ts`,
never trusting the browser's workspace/client/actor id.

### Client portal routes

```
app/(portal)/portal/
  engagements/                       the client's own engagements
  engagements/[engagementId]/        client-safe engagement detail
```

Clients see title, tax year, return type, a plain-language status message
(e.g. "We are waiting for your information", "Your return is being
prepared"), due date, linked intake/document-request status, and open
clarification count. They never see preparer/reviewer identity, internal
due dates, internal notes, internal activity history, other clients'
engagements, or internal payment/balance fields. Because Postgres RLS is
row-level (not column-level), the row-level grant in
`tax_engagements_portal_access` is paired with a server-side data mapper
(`lib/data/portal-engagements.ts`) that explicitly selects a fixed, narrow
column list — the same pattern already used for `clients.ssn_last4` /
`ein_last4` elsewhere in this codebase. `select("*")` is never used on the
client side of this table.

### New migrations (all applied to `aewqbffscdrziiwfomyf` only)

| Migration | Purpose |
|---|---|
| `20260725020000_engagement_schema_extension` | New enums (`tax_return_type`, `engagement_priority`, `engagement_efile_status`, `engagement_payment_status`) and new `engagement_type`/`engagement_status` enum values. |
| `20260725020001_engagement_schema_extension_columns` | Converts `priority`/`return_type` to the new enums, adds assignment/date/tax-workflow/operational columns and money/extension CHECK constraints, adds filter indexes. |
| `20260725020100_engagement_reference_generation` | `engagement_reference_sequences` table, `next_engagement_reference()`, `assign_engagement_number()` trigger, unique reference index. |
| `20260725020200_engagement_activity` | Broadens `engagement_status_history` into a general activity log; adds `log_engagement_activity()` for explicit activity entries from Server Actions. |
| `20260725020300_engagement_notes` | `engagement_notes` table with staff/client RLS policies. |
| `20260725020400_engagement_portal_access` | Client-portal SELECT policy on `tax_engagements`, plus a self-verifying check that no anon or unscoped policy exists on the new/changed tables. |
| `20260725020500_fix_duplicate_engagement_status_trigger` | Drops the pre-existing duplicate trigger described above. |

No new environment variables were required for this phase.

## Known limitations — Phase 4 additions

- **Portal engagement detail is read-only**: clients can view engagement
  status and linked intake/document-request/clarification status, but
  cannot take action (e.g. e-signature capture) from the engagement page
  itself — those flows remain in their existing dedicated portal sections.
- **Portal RLS policy not empirically tested with a live linked test
  client**: `tax_engagements_portal_access` follows the same structural
  pattern as the already-proven `clients_contact_portal_access`, and the
  anon-lockout / no-unsafe-policy checks were verified live, but no dev
  database row currently has `clients.portal_user_id` set to exercise the
  policy end-to-end as an authenticated client.
- **No bulk/batch engagement operations**: creating or updating
  engagements is one-at-a-time; there's no bulk assignment or bulk status
  change UI.
- **Fee/payment fields are intentionally minimal on the client side**:
  `balance_due`/`refund_amount`/`payment_status` are staff-only for now;
  exposing them to clients (e.g. for online payment) is out of scope for
  this phase.

## Guided Tax Organizer (Phase 5)

A single guided flow that replaces "tax intake" as the client-facing name
for gathering a year's tax information, plus a consolidated staff review
workspace on the engagement page. This is workflow/data-collection only —
not tax calculation or return preparation. The most important design
constraint was reducing steps for both clients and staff: one flow, one
workspace, auto-save everywhere, no maze of separate pages per section.

### What already existed vs. what this phase added

A live-schema audit (Part 1) found that this codebase already had an
extremely comprehensive intake engine from earlier phases —
`intake_submissions` / `form_sections` / `form_fields` / `form_conditions`
/ `intake_answers` / `intake_household_people` / `intake_repeatable_entities`
/ `intake_document_rules` / `intake_review_sections` / `intake_review_comments`
/ `intake_review_actions` / `intake_compliance_rules` /
`intake_submission_revisions`, the generic `templates` /
`template_versions` system (`kind = 'form'`), and the RPCs
`recalculate_intake_progress`, `validate_intake_submission`,
`get_intake_visibility`, `submit_intake`, `reopen_intake`,
`begin_intake_review`, `review_intake_section`,
`request_intake_clarification`, `resolve_intake_clarification`,
`complete_intake_review`, `approve_and_lock_intake`,
`generate_intake_document_request`, `create_template_draft`,
`duplicate_template`, and `publish_template_version` — already implementing
versioned templates, conditional visibility, repeatable groups, document
requirement rules, a full review workflow, clarifications, and
auto-recalculated progress. **This phase extends that engine rather than
building a second, parallel "organizer" schema** — "Organizer" is a
client-facing/staff-facing framing layer over the same `intake_*` tables,
with `intake_submissions.id` serving as the "assignment id" in
`/portal/organizer/[assignmentId]`.

A separate, dormant scaffold — `form_templates` / `form_questions` /
`client_form_assignments` / `form_response_answers`, matching the
`create_form_template` / `add_form_question` / `assign_form_to_client` /
`save_form_answer` / `submit_assigned_form` / `mark_assigned_form_reviewed`
/ `request_form_changes` functions — has zero rows and is not called by
any app code (see the Phase 2 "known limitation" note above). It was
deliberately **not** built upon here, since the live `intake_*` system is
the one actually wired into the app.

**Reused as-is**: `intake_submissions`, `form_sections`, `form_fields`,
`form_conditions`, `intake_answers`, `intake_household_people`,
`intake_repeatable_entities`, `intake_document_rules`,
`intake_review_sections`, `intake_review_comments`,
`intake_validation_results`, `templates`/`template_versions`, every RPC
listed above, `lib/actions/intakes.ts` (all staff review actions),
`lib/actions/portal-intake.ts` (client save/submit actions),
`lib/actions/portal-clarifications.ts`, `lib/data/intakes.ts`,
`lib/intake-entity-map.ts`, and the generic `document_links` entity-link
table.

**Extended**: `intake_submissions` gained `due_date`, `current_section_id`,
`source_submission_id` (prior-year rollover link), and
`changes_requested_at`; `intake_answers` / `intake_household_people` /
`intake_repeatable_entities` gained `confirmed_by_client` and
`rolled_forward` booleans; `form_component_type` gained `percentage`,
`acknowledgment`, and `year`; `intake_entity_type` gained `vehicle`,
`bank_account`, `charitable_contribution`, `business_owner`,
`fixed_asset`, and `state_filing`.

**Newly created**: six seeded organizer templates (below), the guided
client wizard (`components/portal/organizer/OrganizerWizard.tsx`), the
engagement-page Organizer tab and assignment/reminder/reopen components,
`/engagements/[engagementId]/organizer` and `/settings/organizers*`
routes, and the Server Actions in `lib/actions/organizer.ts`.

### Client experience — one guided flow

`/portal/organizer/[assignmentId]` (`components/portal/organizer/OrganizerWizard.tsx`)
is the only organizer route a client uses. It builds a single step list —
one step per visible section, a documents step, and a final review step —
resuming at `intake_submissions.current_section_id`, auto-saving as the
client goes (reusing the existing per-field autosave actions), and
showing one primary action per screen (Continue / Save & Continue /
Submit). An expandable "Sections" list (not a modal) shows per-section
completion so the client can jump to anything unfinished. The portal
dashboard shows exactly one card — "Complete your `{tax_year}` Tax
Organizer" (`components/portal/dashboard/PortalOrganizerCard.tsx`) — with
a single Start/Continue/View action; the old separate "continue tax
intake" card was removed so there's no duplicate entry point. Document
upload happens inline per document rule
(`components/portal/organizer/OrganizerDocumentsStep.tsx`), with
"Not applicable" / "I don't have this" / "I'll provide later" responses
stored in `intake_submissions.metadata.document_rule_status` — no second
document system.

### Staff experience — one workspace

The engagement detail page (`/engagements/[engagementId]`) gained one new
**Organizer** tab (`components/engagements/EngagementOrganizerTab.tsx`)
showing template, client-completion %, staff-review section count,
current section, missing-answer count, open clarifications,
unconfirmed-rolled-forward count, reviewer, last activity, and submission
date, with one-click actions: Assign Organizer / Copy Prior Year
(`AssignOrganizerPanel.tsx`), Send Reminder (`SendReminderDialog.tsx`),
Reopen Organizer (`ReopenOrganizerButton.tsx`), and a "Review Organizer"
link. That link goes to `/engagements/[engagementId]/organizer`, a thin
wrapper that resolves the engagement's active `intake_submissions` row
and renders `components/intakes/IntakeReviewWorkspace.tsx` — the **same**
consolidated review workspace (answers, household, income, deductions,
validation, documents, revisions, review sections, clarifications,
activity, actions) already used at `/intakes/[submissionId]`, extracted
into a shared component rather than duplicated. There is no second review
UI to keep in sync.

### Conditional logic, repeating groups, and progress

Section/field visibility is unchanged from the existing engine:
`form_conditions` rows (with `condition_operator`: equals, not_equals,
contains, greater_than, less_than, is_answered, is_unanswered, plus
compound any/all logic) evaluated by `get_intake_visibility()`, so a
hidden required question never blocks submission. Repeating groups
(dependents, W-2 employers, vehicles, bank accounts, business owners,
etc.) reuse `intake_household_people` / `intake_repeatable_entities` and
the existing generic repeatable-entity manager, mapped in
`lib/intake-entity-map.ts`. **Progress has one centralized source**:
`recalculate_intake_progress()` (already trigger-invoked on every answer
change) drives the client-facing completion percentage;
staff-review progress is a **separate** percentage computed from
`intake_review_sections` (reviewed vs. total) — the two numbers are never
blended into one.

### Prior-year rollover

`rolloverOrganizerAction` (`lib/actions/organizer.ts`) creates a new
`intake_submissions` row with `source_submission_id` pointing at last
year's, then copies `intake_household_people` and
`intake_repeatable_entities` rows with `rolled_forward = true`,
`confirmed_by_client = false`. A per-entity-type allowlist
(`ROLLOVER_DATA_ALLOWLIST`) copies only identity/label fields (employer
name, business name/type, vehicle description, bank name, entity name,
etc.) — **income, expense, and payment amounts are never copied**, nor
are signatures, uploaded documents, or prior review decisions. The client
sees rolled-forward items flagged for confirmation and confirms or edits
them inline (`confirmRolledForwardAction`); the engagement page shows an
"unconfirmed rolled-forward" count so staff can see at a glance what
still needs the client's review.

### Document linking and clarifications

Uploaded organizer documents reuse the existing `documents` table plus
the generic `document_links` table (`entity_type = 'intake_submission'`)
— no new document schema. `linkUploadedDocumentAction` now also accepts
an `engagementId` and `organizerSubmissionId`, verifying ownership of both
before linking. Clarifications reuse the existing
`intake_review_comments` / `request_intake_clarification` /
`resolve_intake_clarification` system unchanged — a staff member asks
from the review workspace, the client answers inline inside the
organizer, and the response appears back in the same review workspace.

### Template management

`/settings/organizers` lists every template visible to the workspace
(global system templates plus any the workspace has cloned), with return
type, engagement type, current version, status, active-assignment count,
and last-updated. `/settings/organizers/[templateId]` shows version
history with a Publish action for draft versions, plus Clone (any
template) and Activate/Deactivate (workspace-owned templates only —
global system templates are clone-only from one workspace, since
archiving them would affect every tenant). Seeded templates (all
`is_system_template = true`, workspace-independent):

| Template | Return type | Engagement type | Sections |
|---|---|---|---|
| Individual Tax Return Intake Questionnaire *(pre-existing, reused)* | 1040 | — | 27 |
| S Corporation 1120-S Organizer | 1120-S | business | 13 |
| Partnership 1065 Organizer | 1065 | business | 13 |
| C Corporation 1120 Organizer | 1120 | business | 13 |
| Nonprofit 990 Organizer | 990 | nonprofit | 7 |
| Tax Planning Organizer | — | tax_planning | 4 |
| Extension Organizer | — | extension_only | 2 |

`assignOrganizerAction` recommends a template automatically from the
engagement's `return_type` (falling back to `engagement_type`), matched
against each template's `metadata.tax_form`/`metadata.engagement_type` —
staff can override the suggestion but don't have to reselect from
scratch.

### Security model

RLS was already enabled on every table this phase touches; no new tables
were created, so no new RLS policies were required — the audit confirmed
zero anon-inclusive or unscoped (`qual = true`) policies remain on any
`intake_*` or `templates`/`template_versions` table. New Server Actions
follow the existing pattern: authenticate, re-resolve workspace/client
identity server-side, verify ownership of every id in the input (never
trust a workspace/engagement/client/submission/template id from the
browser), validate with Zod, mutate, and revalidate. `assignOrganizerAction`
and `rolloverOrganizerAction` enforce "one active organizer per engagement
unless staff intentionally creates another" at the application layer
(a DB unique constraint would prevent the explicitly-allowed exception
case). `setOrganizerTemplateStatusAction` is scoped to
`workspace_id = caller's workspace`, so no tenant can archive another
tenant's shared system template. Column-level safety (e.g. a client can
never set `reviewed_by` or flip their own submission to `approved`)
continues to rely on the same convention already documented for other
tables in this codebase: actions write only the specific columns they
own, rather than exposing a broad UPDATE policy.

### New migrations (all applied to `aewqbffscdrziiwfomyf` only)

| Migration | Purpose |
|---|---|
| `20260726010000_organizer_schema_extension` | Adds `due_date`, `current_section_id`, `source_submission_id`, `changes_requested_at` to `intake_submissions`; adds `confirmed_by_client`/`rolled_forward` to `intake_answers`, `intake_household_people`, `intake_repeatable_entities`; adds supporting indexes. |
| `20260726010001_organizer_enum_values` | Adds `percentage`/`acknowledgment`/`year` to `form_component_type` and `vehicle`/`bank_account`/`charitable_contribution`/`business_owner`/`fixed_asset`/`state_filing` to `intake_entity_type` (its own migration/transaction, since Postgres forbids using a new enum value in the same transaction that adds it). |
| `20260726010100_organizer_seed_templates` | Seeds the six new organizer templates and their sections/fields/conditions/document rules listed above. |

No new environment variables were required for this phase.

## Known limitations — Guided Tax Organizer additions

- **No in-app template preview renderer**: `/settings/organizers/[templateId]`
  shows version metadata (status, section/field counts are visible via the
  DB but not rendered as a live preview) rather than a rendered walkthrough
  of the template's questions; staff currently verify a template's content
  by assigning it and viewing it through the same client-facing renderer.
- **No visual template/question builder**: creating a template via
  `/settings/organizers` produces an empty draft (`create_template_draft`);
  authoring new sections/fields/conditions for a workspace-owned template
  still requires direct schema access, not a form-builder UI. This matches
  the spec's explicit allowance that "no complex visual template builder"
  was required for this phase.
- **Reminders are single-shot, not scheduled**: `sendOrganizerReminderAction`
  sends one editable, template-based notification per click; there is no
  automatic recurring reminder (e.g. "remind again in 7 days if still
  incomplete").
- **RLS remains row-level, not column-level, on `intake_submissions`**: as
  documented in the Phase 2 security notes above, this phase did not
  retrofit a column-guard trigger onto the pre-existing broad client
  UPDATE policy; column safety continues to rely on each Server Action
  writing only the columns it owns (e.g. `updateCurrentSectionAction`
  updates only `current_section_id`).
- **Manual browser walkthrough not performed in this environment**:
  verification for this phase was `npm run lint` / `type-check` / `build`
  (all routes compile) plus live, rolled-back SQL transactions against
  `aewqbffscdrziiwfomyf` exercising assignment, rollover, confirmation,
  and progress recalculation — consistent with how prior phases in this
  repository were validated — but no interactive browser session was
  driven against the deployed wizard in this pass.

## Currently implemented features

- Application foundation: Next.js App Router, TypeScript, Tailwind v4
  brand theme, generated Supabase types committed to the repo.
- Supabase SSR authentication: sign in, sign up, forgot/reset password,
  sign out, session-refresh middleware, safe redirect handling.
- Workspace-aware authorization: workspace resolution and role checks
  enforced server-side on every page and Server Action.
- Staff dashboard with real Supabase-backed metrics and activity feeds.
- Client management: searchable/filterable/paginated list, tabbed detail
  page, validated "Add client" workflow.
- Intake queue with multi-filter support and a two-column intake review
  workspace (sections, clarifications, activity, staff actions) backed by
  the existing Postgres intake functions.
- Document request list and detail pages built on the existing
  `document_requests` / `document_request_items` tables.
- Shared component system (StatusBadge, MetricCard, DataTable, Tabs,
  ConfirmDialog, EmptyState/LoadingState/ErrorState/ForbiddenState, etc.)
  and a responsive app shell with a mobile drawer.
- **Client portal** (Phase 2): secure client sign-in resolved from the
  existing `clients.portal_user_id`/`client_contacts.auth_user_id` mapping;
  a client dashboard with status, next-action, and activity; a schema-
  driven section-based tax intake experience (generic Q&A, household
  manager, generic repeatable-entity manager, review & submit); secure
  document upload to private Storage with signed-URL viewing; document
  request tracking; a clarification response center; a client<->staff
  messaging center; and self-service profile management for the fields a
  client should control.
- **Tax Engagement Management** (Phase 4): engagement create/list/detail
  for staff with search, filtering, and a full Overview / Workflow /
  Documents / Intake & Clarifications / Notes / Activity tabbed detail
  view; centralized status-transition rules; automatic workspace-unique
  engagement reference numbers; and a client-safe portal view of the
  client's own engagements.
- **Guided Tax Organizer** (Phase 5): one guided client flow
  (`/portal/organizer/[assignmentId]`) replacing "tax intake" navigation,
  with auto-save, resume, inline document upload, and prior-year
  rollover; an Organizer tab on the engagement page with one-click
  assignment, reminders, and reopening; a consolidated organizer review
  workspace shared with the existing intake review UI; and a template
  management UI (`/settings/organizers`) over six newly seeded organizer
  templates plus the pre-existing Individual 1040 questionnaire.

## Known limitations / next-phase roadmap

- **Team & invitation management**: the Settings page currently shows
  workspace details and the team roster read-only. Inviting new staff,
  changing roles, and workspace branding settings are not yet built.
- **Document uploads**: this app manages document *requests* and their
  item-level status; it does not yet implement the client-facing upload
  flow or a `documents` browser (the `documents` / `document_links` /
  `document_reviews` tables exist in the schema but are out of scope for
  this initial release).
- **Compliance case management**: `evaluate_intake_compliance` is
  invoked and compliance rules are inspected on the intake detail page,
  but a dedicated compliance case workspace (`compliance_cases`,
  `compliance_checklists`) is not yet built.
- **Templates & workflow automation**: the schema's form-template,
  workflow, and automation tables are not exposed in this release's UI —
  intakes rely on templates already assigned via existing data.
- **Reviewer/document-request-item mutations**: document request item
  status changes (accept/reject/waive) are not yet exposed as staff
  actions in the UI — they're visible read-only alongside the existing
  review actions that already mutate items server-side.

### Phase 2 (client portal) limitations

- **Sibling `anon_crud_*` RLS policies**: `workspaces`, `services`,
  `notifications`, `form_templates`, `form_questions`,
  `form_response_answers`, and `client_form_assignments` still have a
  pre-existing `qual: true` policy allowing any caller to read every row
  with no workspace scoping. Only `anon_crud_clients` was fixed in this
  phase (it directly conflicted with the client portal's own security
  model); the rest predate this branch and are a recommended follow-up.
- **Clarification attachments**: a client can upload a supporting document
  from the Documents section, but it isn't linked to the specific
  clarification comment via `document_links` yet (that table is currently
  staff-write-only) — the reply and the upload are separate actions.
- **Repeatable entity forms are generic**: self-employment, rental
  properties, K-1s, investment sales, etc. all share one generic form
  renderer driven by each section's `form_fields`, rather than a bespoke
  per-type UI (e.g. dedicated depreciation schedules for rental
  properties).
- **No e-signature capture**: `signature` fields (used on the
  certification section) are captured as a typed full legal name plus a
  timestamp, not a drawn/canvas signature.
- **Read receipts are binary, not per-user**: `messages.read_at` records
  when the *other party* first read a message, not per-individual-reader
  receipts (relevant if a client has multiple portal-linked contacts).
- **No SMS/email delivery**: messaging and clarification notifications are
  in-app only in this phase.

## Recommended Phase 3

1. Close the remaining `anon_crud_*` RLS gaps flagged above.
2. Wire clarification-reply attachments through `document_links` (with a
   client-scoped INSERT policy).
3. Client-facing document request item interactions beyond upload (e.g.
   viewing why an item was rejected in more detail).
4. Per-type repeatable-entity forms for the highest-value sections
   (self-employment, rental properties) instead of the shared generic
   renderer.
5. The two outstanding Phase 1 items (team/invitation management,
   document request item staff actions) remain open alongside these.
