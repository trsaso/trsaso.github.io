# QuarryProof AI — Implementation Plan

Mobile-first field inspection and corrective-action platform for quarries, marble
operations, aggregate pits, and stone-processing plants. Replaces paper checklists,
WhatsApp issue photos, and Excel action registers.

## Guiding constraints

- A worker files a hazard report in **under 90 seconds**: photo → optional voice note → note → submit.
- A supervisor assigns, tracks, verifies, and closes corrective actions with a full audit trail.
- Mobile first, rugged industrial UI, 44px+ touch targets, high contrast, never color-only status.
- No mock data in the connected app. AI suggestions only claimed when a real provider was called;
  otherwise an explicit "AI suggestions unavailable" fallback with manual completion.
- Strict TypeScript, validated forms (React Hook Form + Zod), skeleton loading states,
  confirmation on destructive actions, semantic/accessible controls.

## Stack

Next.js (App Router) · TypeScript strict · Tailwind CSS · shadcn/ui · Supabase
(auth, Postgres, storage, RLS) · React Hook Form + Zod · TanStack Query ·
Lucide · Recharts · Vercel-deployable.

## Roles

| Capability | Worker | Supervisor | Admin |
|---|---|---|---|
| Quick reports, assigned inspections, evidence upload | ✅ | ✅ | ✅ |
| Review reports; create/assign/verify/reject/close actions | — | ✅ | ✅ |
| Dashboards, exports | — | ✅ | ✅ |
| Manage sites, users, categories, templates, settings | — | — | ✅ |

## Data model (Supabase Postgres)

- `organizations`, `sites`, `site_areas` — tenancy and locations.
- `profiles` — 1:1 with `auth.users`; carries `org_id` and `role` (worker/supervisor/admin).
- `categories` — org-configurable defect/hazard categories.
- `reports` — quick reports; status `triage → converted | dismissed | escalated`;
  AI suggestion payload stored alongside a flag for whether AI actually ran.
- `actions` — corrective actions; status `open → in_progress → ready_for_verification → closed`
  (verification rejection returns to `in_progress`; `cancelled` terminal state); owner, priority,
  due date, closure evidence, cost/downtime.
- `evidence` — photos/voice notes/documents in Supabase Storage, linked to reports or actions,
  tagged `before`/`after`.
- `inspection_templates` + `inspection_template_items` — daily checklist definitions.
- `inspection_runs` + `inspection_run_items` — checklist executions with pass/fail/n.a. results.
- `audit_events` — append-only timeline of every state transition (insert + select only; no
  update/delete policies, enforced by RLS and a guard trigger).

All tables are org-scoped with RLS via `current_org_id()` / `current_user_role()` helper
functions. Onboarding uses a `security definer` RPC (`onboard_organization`) so the first
user can atomically create org + first site + admin profile + default categories.

Storage: private `evidence` bucket, org-prefixed paths (`<org_id>/...`), RLS on
`storage.objects` restricting read/write to org members.

## Phases

### Phase 1 — Foundation (this phase)
- Repo scaffolding: Next.js App Router, strict TS, Tailwind, shadcn/ui primitives, ESLint.
- Full SQL migrations: enums, tables, indexes, RLS policies, helper functions, storage bucket.
- Auth: login, registration, email-confirm callback, sign-out; middleware session refresh
  and route protection.
- Organization onboarding flow (create org + first site → admin profile).
- App shell: desktop sidebar + mobile bottom tab bar, header, user menu; role-aware
  navigation and role-guarded routes.
- Today dashboard shell with live (real, initially empty) counts and skeletons.
- `.env.example`, README, demo seed script ("Pelagonia Marble Demo").
- Verification: `npm run lint`, `npm run typecheck`, `npm run build` clean.

### Phase 2 — Quick Report capture + triage
- Quick Report form: site/area picker, camera/photo upload, voice note recording, note.
- AI suggestion endpoint (server-side provider call; graceful "AI suggestions unavailable"
  fallback when no key configured).
- Report list + detail with TRIAGE queue; supervisor dismiss / escalate / convert-to-action.
- Evidence upload pipeline to Storage; audit events on every transition.

### Phase 3 — Corrective actions lifecycle
- Action CRUD: owner, priority, due date, location, instructions, linked report evidence.
- Status flow open → in_progress → ready_for_verification; closure evidence (after photo,
  completion note, cost, downtime); supervisor verify/close or reject with comment.
- Audit timeline component; overdue computation; my-work views for assignees.

### Phase 4 — Inspections
- Template management (admin): items, ordering, photo-required-on-fail.
- Daily inspection runs: start, per-item pass/fail/n.a. with notes/photos, submit;
  failed items convert to reports/actions.

### Phase 5 — Analytics + exports
- Dashboard: overdue actions, open by severity, top categories, frequent locations,
  mean time to close (Recharts).
- Branded PDF report and CSV action register exports.

### Phase 6 — Settings & polish
- Admin: users (invite, role change, deactivate), sites/areas, categories, templates, org settings.
- Accessibility pass, empty states, error boundaries, final QA.

Each phase ends with lint + typecheck + build, fixes, and a summary of changes.
