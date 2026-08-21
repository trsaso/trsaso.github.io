-- QuarryProof AI — initial schema
-- Tables, enums, and indexes. RLS policies live in 0002_rls_policies.sql,
-- storage setup in 0003_storage.sql.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.user_role as enum ('worker', 'supervisor', 'admin');

create type public.report_status as enum ('triage', 'converted', 'dismissed', 'escalated');

create type public.severity_level as enum ('low', 'medium', 'high', 'critical');

create type public.action_status as enum (
  'open',
  'in_progress',
  'ready_for_verification',
  'closed',
  'cancelled'
);

create type public.action_priority as enum ('low', 'medium', 'high', 'critical');

create type public.evidence_kind as enum ('photo', 'voice_note', 'document');

create type public.evidence_phase as enum ('before', 'after', 'general');

create type public.inspection_run_status as enum ('in_progress', 'completed');

create type public.inspection_item_result as enum ('pass', 'fail', 'not_applicable');

-- ---------------------------------------------------------------------------
-- Tenancy
-- ---------------------------------------------------------------------------

create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 2 and 120),
  slug        text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$'),
  logo_url    text,
  is_demo     boolean not null default false,
  created_at  timestamptz not null default now()
);

create table public.sites (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  name        text not null check (char_length(name) between 2 and 120),
  code        text not null check (char_length(code) between 1 and 16),
  description text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (org_id, code)
);

create table public.site_areas (
  id          uuid primary key default gen_random_uuid(),
  site_id     uuid not null references public.sites(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 120),
  sort_order  integer not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- profiles: one row per auth user, carries org membership and role
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  org_id      uuid not null references public.organizations(id) on delete cascade,
  full_name   text not null check (char_length(full_name) between 2 and 120),
  role        public.user_role not null default 'worker',
  phone       text,
  avatar_url  text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  name        text not null check (char_length(name) between 2 and 80),
  description text,
  sort_order  integer not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (org_id, name)
);

-- ---------------------------------------------------------------------------
-- Quick reports
-- ---------------------------------------------------------------------------

create table public.reports (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.organizations(id) on delete cascade,
  site_id           uuid not null references public.sites(id) on delete restrict,
  area_id           uuid references public.site_areas(id) on delete set null,
  reporter_id       uuid not null references public.profiles(id) on delete restrict,
  status            public.report_status not null default 'triage',
  title             text not null check (char_length(title) between 3 and 160),
  description       text,
  reporter_note     text,
  severity          public.severity_level not null default 'medium',
  category_id       uuid references public.categories(id) on delete set null,
  immediate_action  text,
  suggested_role    public.user_role,
  -- AI provenance: ai_assisted is true ONLY when a real AI provider produced
  -- suggestions for this report; ai_payload stores the raw suggestion set.
  ai_assisted       boolean not null default false,
  ai_payload        jsonb,
  reviewed_by       uuid references public.profiles(id) on delete set null,
  reviewed_at       timestamptz,
  review_note       text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Corrective actions
-- ---------------------------------------------------------------------------

create table public.actions (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.organizations(id) on delete cascade,
  site_id           uuid not null references public.sites(id) on delete restrict,
  area_id           uuid references public.site_areas(id) on delete set null,
  report_id         uuid references public.reports(id) on delete set null,
  title             text not null check (char_length(title) between 3 and 160),
  instructions      text,
  category_id       uuid references public.categories(id) on delete set null,
  severity          public.severity_level not null default 'medium',
  priority          public.action_priority not null default 'medium',
  status            public.action_status not null default 'open',
  assignee_id       uuid references public.profiles(id) on delete set null,
  created_by        uuid not null references public.profiles(id) on delete restrict,
  due_date          date,
  started_at        timestamptz,
  submitted_at      timestamptz,
  verified_by       uuid references public.profiles(id) on delete set null,
  closed_at         timestamptz,
  completion_note   text,
  cost_amount       numeric(12, 2) check (cost_amount is null or cost_amount >= 0),
  cost_currency     text not null default 'EUR' check (char_length(cost_currency) = 3),
  downtime_minutes  integer check (downtime_minutes is null or downtime_minutes >= 0),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Evidence (photos, voice notes, documents in Supabase Storage)
-- ---------------------------------------------------------------------------

create table public.evidence (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  report_id     uuid references public.reports(id) on delete cascade,
  action_id     uuid references public.actions(id) on delete cascade,
  kind          public.evidence_kind not null default 'photo',
  phase         public.evidence_phase not null default 'general',
  storage_path  text not null,
  caption       text,
  uploaded_by   uuid not null references public.profiles(id) on delete restrict,
  created_at    timestamptz not null default now(),
  check (report_id is not null or action_id is not null)
);

-- ---------------------------------------------------------------------------
-- Inspections
-- ---------------------------------------------------------------------------

create table public.inspection_templates (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  name        text not null check (char_length(name) between 2 and 120),
  description text,
  active      boolean not null default true,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table public.inspection_template_items (
  id                      uuid primary key default gen_random_uuid(),
  template_id             uuid not null references public.inspection_templates(id) on delete cascade,
  prompt                  text not null check (char_length(prompt) between 3 and 300),
  guidance                text,
  sort_order              integer not null default 0,
  requires_photo_on_fail  boolean not null default true,
  created_at              timestamptz not null default now()
);

create table public.inspection_runs (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  site_id       uuid not null references public.sites(id) on delete restrict,
  template_id   uuid not null references public.inspection_templates(id) on delete restrict,
  inspector_id  uuid not null references public.profiles(id) on delete restrict,
  status        public.inspection_run_status not null default 'in_progress',
  notes         text,
  started_at    timestamptz not null default now(),
  completed_at  timestamptz
);

create table public.inspection_run_items (
  id                uuid primary key default gen_random_uuid(),
  run_id            uuid not null references public.inspection_runs(id) on delete cascade,
  template_item_id  uuid not null references public.inspection_template_items(id) on delete restrict,
  result            public.inspection_item_result,
  note              text,
  created_at        timestamptz not null default now(),
  unique (run_id, template_item_id)
);

-- ---------------------------------------------------------------------------
-- Audit timeline (append-only)
-- ---------------------------------------------------------------------------

create table public.audit_events (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  entity_type  text not null check (entity_type in ('report', 'action', 'inspection_run', 'organization', 'site', 'profile', 'category', 'inspection_template')),
  entity_id    uuid not null,
  actor_id     uuid references public.profiles(id) on delete set null,
  event_type   text not null check (char_length(event_type) between 2 and 60),
  from_status  text,
  to_status    text,
  detail       jsonb,
  created_at   timestamptz not null default now()
);

-- Belt-and-braces immutability: reject UPDATE/DELETE even for roles that
-- bypass RLS (except direct superuser/service maintenance).
create or replace function public.audit_events_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_events is append-only';
end;
$$;

create trigger audit_events_no_update
  before update or delete on public.audit_events
  for each row execute function public.audit_events_immutable();

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger reports_set_updated_at
  before update on public.reports
  for each row execute function public.set_updated_at();

create trigger actions_set_updated_at
  before update on public.actions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index sites_org_idx on public.sites (org_id);
create index site_areas_site_idx on public.site_areas (site_id);
create index profiles_org_idx on public.profiles (org_id);
create index categories_org_idx on public.categories (org_id);

create index reports_org_status_idx on public.reports (org_id, status);
create index reports_site_idx on public.reports (site_id);
create index reports_reporter_idx on public.reports (reporter_id);
create index reports_created_idx on public.reports (org_id, created_at desc);

create index actions_org_status_idx on public.actions (org_id, status);
create index actions_assignee_idx on public.actions (assignee_id) where assignee_id is not null;
create index actions_site_idx on public.actions (site_id);
create index actions_due_idx on public.actions (org_id, due_date) where due_date is not null;
create index actions_report_idx on public.actions (report_id) where report_id is not null;

create index evidence_report_idx on public.evidence (report_id) where report_id is not null;
create index evidence_action_idx on public.evidence (action_id) where action_id is not null;
create index evidence_org_idx on public.evidence (org_id);

create index inspection_templates_org_idx on public.inspection_templates (org_id);
create index inspection_template_items_template_idx on public.inspection_template_items (template_id, sort_order);
create index inspection_runs_org_idx on public.inspection_runs (org_id, started_at desc);
create index inspection_runs_inspector_idx on public.inspection_runs (inspector_id);
create index inspection_run_items_run_idx on public.inspection_run_items (run_id);

create index audit_events_entity_idx on public.audit_events (entity_type, entity_id, created_at);
create index audit_events_org_idx on public.audit_events (org_id, created_at desc);
