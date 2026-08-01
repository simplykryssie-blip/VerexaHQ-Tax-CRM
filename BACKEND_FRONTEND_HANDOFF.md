# Verexa Tax Office Backend → Frontend Handoff

Backend applied to Supabase project `VerexaHQ Tax Office` on 2026-08-01.

## Product rules already enforced by the database

- A public lead form creates a lead only. It does not create a portal account, client, or engagement.
- Creating an engagement automatically applies the firm's matching engagement-type setting and primary workflow.
- The applied workflow is frozen as an engagement-specific snapshot. Publishing a later workflow version cannot rewrite active or historical engagements.
- Standalone PTIN workspaces do not require a reviewer unless the firm setting explicitly requires one.
- A PTIN workspace linked to an ERO automatically inherits an active ERO reviewer and cannot assign outside the ERO workspace.
- An ERO-office engagement assigned to a preparer/seasonal preparer requires review. The ERO/owner is the default reviewer, and authorized ERO staff can reassign within the ERO workspace.
- Household is a relationship group, not a new client record type. Use `tax_households` and `household_members`; new client UX should offer Individual or Business.
- Organizer, document, engagement-letter, payment, signature, extension, filing, and review progress are separate trackers—not dozens of overloaded workflow statuses.
- Automatic extensions activate the extended filing deadline without replacing or deactivating the original payment deadline.

## New backend modules

| Module | Primary tables |
|---|---|
| Firm defaults | `engagement_type_settings` |
| Editable workflow stages | `workflow_stages`, `workflow_stage_transitions` |
| Frozen engagement workflow | `engagement_workflow_instances`, `engagement_workflow_stage_instances` |
| Separate progress | `engagement_progress_trackers` |
| Deadline ledger | `engagement_deadlines`, `tax_jurisdiction_rule_profiles` |
| Lead forms | `lead_forms`, `lead_form_submissions` |
| Pricing | `pricing_assessments`, `pricing_rules`, `client_quotes` |
| Sensitive duplicate detection | `private.client_identifier_fingerprints` plus the masked duplicate RPC |

All public tables have RLS and explicit Data API grants. The private fingerprint table is not exposed to browser roles.

## Reusable system content seeded

- `Verexa Default Tax Preparation Workflow`
  - 7 phases
  - 30 normal/terminal stages
  - 6 exception stages
  - 32 controlled transitions
- `New Tax Client Lead Form`
- `Tax Preparation Pricing Assessment`
- Six tax engagement configurations per non-platform workspace:
  - Individual 1040
  - Partnership 1065
  - C corporation 1120
  - S corporation 1120-S
  - Nonprofit 990
  - Amended individual 1040-X

The three generated lead-form records remain `draft`. The frontend must require an intentional Publish action before exposing a link/embed.

## RPCs the frontend/server should use

### `activate_tax_engagement`

Signed-in staff activation endpoint. Inputs:

- `p_engagement_id`
- `p_activation_mode`: `activate_without_sending` or `activate_and_send`

This is the authoritative activation path. It safely materializes the configured organizer, engagement letter, document request, default tasks, optional invoice, release controls, workflow stage changes, and a queued portal/package-delivery job in one transaction. It is idempotent: repeating the call returns/reuses the existing artifacts instead of creating duplicates. Replace the older frontend-only `activateAndAssignOrganizer` sequence with this RPC.

The response includes the activation ID, status, artifact IDs, and warnings such as a missing client email or a package component that is not configured.

The `process-backend-queues` Edge Function now claims the queued activation job, creates/links portal access, queues one secure package notification, schedules idempotent intake reminders, and marks the activation sent after provider delivery. Queue invocation is restricted to the service-role credential; an ordinary signed-in JWT cannot process every firm's queues.

### `evaluate_return_release` and `release_completed_return`

Use `evaluate_return_release` to display exact blockers before completed-return delivery. It distinguishes a missing invoice from a paid invoice and checks configured payment, signature, review, and optional filing-acceptance requirements.

Use `release_completed_return` for the final staff action. It re-evaluates every requirement inside the transaction, is idempotent after release, and writes engagement activity plus an audit record.

### `submit_public_lead_form`

Anonymous form endpoint. Inputs:

- `p_public_slug`
- `p_payload`
- `p_consent_given`
- `p_honeypot`

It validates the active published form/version, requires email or phone, limits payload size, requires consent, checks a honeypot, blocks SSN/ITIN/EIN/banking/document keys, and creates the lead plus immutable submission record. Anonymous users have no direct table access.

The web route should still add CAPTCHA and provider/IP rate limiting before calling this RPC.

### `find_possible_duplicate_clients`

Signed-in staff endpoint. Inputs:

- `p_workspace_id`
- normalized email (optional)
- normalized phone (optional)
- server-generated HMAC fingerprint (optional)

It verifies workspace membership and returns masked matches plus reasons. Never calculate an SSN/ITIN/EIN HMAC in browser code. A server-only route must normalize the identifier, calculate HMAC-SHA-256 with a dedicated environment secret, and write the fingerprint through the service-role client.

### `set_engagement_workflow_stage`

Signed-in staff endpoint. It uses caller RLS, verifies engagement management rights, enforces the defined transition (or exception stage), requires a reason when configured, updates the workflow snapshot, maps the stage to the engagement status, and writes engagement activity.

## Screens Claude should connect

1. **Workflow Builder**
   - List workflow templates and versions.
   - Duplicate Verexa default before editing.
   - Reorder/edit stages, entry actions, exit requirements, transitions, and exceptions.
   - Publish a new immutable version.
   - Set it as primary through `engagement_type_settings`.

2. **Engagement Type Settings**
   - Choose primary workflow, organizer, engagement letter, document checklist, pricing method, reviewer policy, activation default, and deadline settings per engagement/return type.

3. **Lead Form Builder**
   - Full preview, edit, duplicate, draft/publish/pause/archive.
   - Copy link, embed snippet, button snippet, and QR code.
   - Never permit sensitive-identifier or tax-document fields on a public form.

4. **Pricing Assessment and Quote**
   - Send the short assessment before full intake.
   - Apply ordered `pricing_rules` and allow staff review.
   - Create fixed, starting-at, range, custom, or rule-based quote.
   - Accepted scope changes create a `change_order` quote; do not overwrite the accepted original.

5. **Template Library**
   - Filter lead forms, pricing assessments, organizers, questionnaires, engagement letters, consent forms, document requests, messages, and checklists.
   - Full preview, duplicate, edit draft, publish version, archive, service/workflow assignments, and mobile-client preview.

6. **Engagement Workspace**
   - Main workflow stage plus the eight separate tracker cards.
   - Show automatic statutory deadlines separately from staff-created dates.
   - Use `set_engagement_workflow_stage`; do not directly patch stage-instance rows from the browser.

7. **Duplicate Warning Drawer**
   - Check normalized email/phone as staff types.
   - Check SSN/ITIN/EIN only through a server action using the HMAC fingerprint.
   - Show masked match, status, assignee, match reasons, and Open Client File.
   - Continuing after a warning should require permission and an audit reason.

## Deadline status

The database contains calendar-year federal rules for tax years 2025 and 2026 for 1040, 709, 1065, 1120-S, 1120, 1041, 990, and 940. It also contains verified Louisiana, Virginia, and Hawaii rules currently supported by the product.

For the remaining states, `tax_jurisdiction_rule_profiles.rule_status` is either `not_applicable` (no general individual income tax) or `review_required`. Do not automatically convert `review_required` to a federal-aligned date. Each state/form/year needs an official source and annual verification before inserting an active `tax_deadline_rules` row.

Tax disaster relief, fiscal years, short years, combat-zone relief, non-calendar entities, and taxpayer-specific postponements remain exception workflows and must not be guessed.

## Files to preserve

- `supabase/migrations/20260801010000_backend_workflow_foundation.sql`
- `supabase/migrations/20260801010100_seed_verexa_tax_workflow.sql`
- `supabase/migrations/20260801010200_fix_generic_actor_trigger.sql`
- `supabase/migrations/20260801010300_seed_statutory_deadline_rules.sql`
- `supabase/migrations/20260801010400_backend_advisor_hardening.sql`
- `supabase/migrations/20260801010500_engagement_activation_and_release_gate.sql`
- `supabase/migrations/20260801010600_activation_advisor_hardening.sql`
- `supabase/migrations/20260801010700_automation_job_processing.sql`
- `supabase/functions/process-backend-queues/index.ts`
- `types/database.ts`

The live database already contains these migrations. Do not manually re-run their SQL. Commit them so local/GitHub migration history stays aligned with Supabase.
