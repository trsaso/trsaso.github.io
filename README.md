# QuarryProof AI

Mobile-first field inspection and corrective-action platform for small and medium
stone quarries, marble operations, aggregate quarries, and stone-processing plants.

A field worker reports a hazard or defect in under 90 seconds with a photo and an
optional voice note. A supervisor assigns, tracks, verifies, and closes corrective
actions with a complete, immutable audit trail — replacing paper checklists,
WhatsApp photo threads, and Excel action registers.

**Implementation plan and phase status:** see [`docs/plan.md`](docs/plan.md).

## Stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript (strict)
- Tailwind CSS + [shadcn/ui](https://ui.shadcn.com) + Lucide icons
- [Supabase](https://supabase.com) — auth, Postgres, storage, row-level security
- React Hook Form + Zod, TanStack Query, Recharts
- Deployable on Vercel

## Local setup

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase values
npm run dev                  # http://localhost:3000
```

Checks:

```bash
npm run lint
npm run typecheck
npm run build
```

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. Apply the migrations in order — either with the Supabase CLI:

   ```bash
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```

   or by pasting each file from `supabase/migrations/` (in filename order:
   `0001_schema.sql`, `0002_rls_policies.sql`, `0003_storage.sql`) into the
   SQL Editor and running it.
3. In **Authentication → Providers**, make sure Email/Password is enabled.
   With email confirmation enabled (the default), add
   `<your-site-url>/auth/callback` to **Authentication → URL Configuration →
   Redirect URLs**. For quick local testing you can disable "Confirm email".
4. Copy the Project URL and anon key into `.env.local`
   (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).

### Demo data (optional)

A clearly-labeled demo organization, **Pelagonia Marble Demo**, can be seeded
with demo users, sites, categories, an inspection template, and a few sample
reports/actions:

```bash
SUPABASE_URL=https://<project-ref>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
npm run seed:demo
```

Demo logins (password `QuarryDemo!2026`):

| Email | Role |
|---|---|
| `admin@pelagonia-demo.test` | Admin |
| `supervisor@pelagonia-demo.test` | Supervisor |
| `worker@pelagonia-demo.test` | Worker |

The seed script is the only place demo data exists — the app itself never uses
mock data.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon/publishable key |
| `NEXT_PUBLIC_SITE_URL` | ✅ | Public base URL (auth email redirects) |
| `SUPABASE_SERVICE_ROLE_KEY` | seed only | Demo seed script; server-side only, never ship to the browser |
| `ANTHROPIC_API_KEY` | optional | AI report suggestions (Phase 2). Unset → "AI suggestions unavailable" fallback |

## Deployment (Vercel)

1. Import the repository in Vercel (framework preset: Next.js, root directory: repo root).
2. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
   `NEXT_PUBLIC_SITE_URL` (your production URL) in Project → Settings →
   Environment Variables.
3. Add `https://<your-domain>/auth/callback` to the Supabase redirect URL
   allow-list.
4. Deploy.

## Roles

| Capability | Worker | Supervisor | Admin |
|---|---|---|---|
| Quick reports, assigned inspections, evidence upload | ✅ | ✅ | ✅ |
| Review reports; manage corrective actions; dashboards & exports | — | ✅ | ✅ |
| Manage sites, users, categories, templates, settings | — | — | ✅ |
