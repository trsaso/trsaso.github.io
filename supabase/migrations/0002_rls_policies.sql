-- QuarryProof AI — helper functions, RLS policies, onboarding RPC.

-- ---------------------------------------------------------------------------
-- Helper functions
-- security definer so they can read profiles without tripping RLS recursion.
-- ---------------------------------------------------------------------------

create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id from public.profiles where id = auth.uid();
$$;

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and active;
$$;

create or replace function public.is_supervisor_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() in ('supervisor', 'admin'), false);
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() = 'admin', false);
$$;

revoke execute on function public.current_org_id() from anon;
revoke execute on function public.current_user_role() from anon;
revoke execute on function public.is_supervisor_or_admin() from anon;
revoke execute on function public.is_admin() from anon;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------

alter table public.organizations enable row level security;
alter table public.sites enable row level security;
alter table public.site_areas enable row level security;
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.reports enable row level security;
alter table public.actions enable row level security;
alter table public.evidence enable row level security;
alter table public.inspection_templates enable row level security;
alter table public.inspection_template_items enable row level security;
alter table public.inspection_runs enable row level security;
alter table public.inspection_run_items enable row level security;
alter table public.audit_events enable row level security;

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------

create policy "org members can read their organization"
  on public.organizations for select
  using (id = public.current_org_id());

create policy "admins can update their organization"
  on public.organizations for update
  using (id = public.current_org_id() and public.is_admin())
  with check (id = public.current_org_id());

-- inserts happen via the onboard_organization() security definer RPC only.

-- ---------------------------------------------------------------------------
-- sites / site_areas
-- ---------------------------------------------------------------------------

create policy "org members can read sites"
  on public.sites for select
  using (org_id = public.current_org_id());

create policy "admins manage sites"
  on public.sites for all
  using (org_id = public.current_org_id() and public.is_admin())
  with check (org_id = public.current_org_id() and public.is_admin());

create policy "org members can read site areas"
  on public.site_areas for select
  using (site_id in (select id from public.sites where org_id = public.current_org_id()));

create policy "admins manage site areas"
  on public.site_areas for all
  using (
    site_id in (select id from public.sites where org_id = public.current_org_id())
    and public.is_admin()
  )
  with check (
    site_id in (select id from public.sites where org_id = public.current_org_id())
    and public.is_admin()
  );

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create policy "org members can read profiles in their org"
  on public.profiles for select
  using (org_id = public.current_org_id());

create policy "users can update their own profile basics"
  on public.profiles for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and org_id = public.current_org_id()
    -- role/active changes for oneself are rejected by trigger below
  );

create policy "admins manage org profiles"
  on public.profiles for update
  using (org_id = public.current_org_id() and public.is_admin())
  with check (org_id = public.current_org_id());

-- Workers must not self-promote: guard role/active/org changes.
create or replace function public.profiles_guard_self_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = new.id and not public.is_admin() then
    if new.role is distinct from old.role
       or new.active is distinct from old.active
       or new.org_id is distinct from old.org_id then
      raise exception 'not allowed to change role, active flag, or organization';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_guard_self_update
  before update on public.profiles
  for each row execute function public.profiles_guard_self_update();

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------

create policy "org members can read categories"
  on public.categories for select
  using (org_id = public.current_org_id());

create policy "admins manage categories"
  on public.categories for all
  using (org_id = public.current_org_id() and public.is_admin())
  with check (org_id = public.current_org_id() and public.is_admin());

-- ---------------------------------------------------------------------------
-- reports
-- ---------------------------------------------------------------------------

create policy "org members can read reports"
  on public.reports for select
  using (org_id = public.current_org_id());

create policy "org members can create reports as themselves"
  on public.reports for insert
  with check (
    org_id = public.current_org_id()
    and reporter_id = auth.uid()
  );

create policy "reporters can edit their own triage reports"
  on public.reports for update
  using (
    org_id = public.current_org_id()
    and reporter_id = auth.uid()
    and status = 'triage'
  )
  with check (org_id = public.current_org_id() and reporter_id = auth.uid());

create policy "supervisors manage reports"
  on public.reports for update
  using (org_id = public.current_org_id() and public.is_supervisor_or_admin())
  with check (org_id = public.current_org_id());

-- ---------------------------------------------------------------------------
-- actions
-- ---------------------------------------------------------------------------

create policy "org members can read actions"
  on public.actions for select
  using (org_id = public.current_org_id());

create policy "supervisors create actions"
  on public.actions for insert
  with check (
    org_id = public.current_org_id()
    and created_by = auth.uid()
    and public.is_supervisor_or_admin()
  );

create policy "supervisors manage actions"
  on public.actions for update
  using (org_id = public.current_org_id() and public.is_supervisor_or_admin())
  with check (org_id = public.current_org_id());

-- Assignees advance their own actions (open → in_progress → ready_for_verification,
-- closure evidence fields). Status legality is enforced by trigger below.
create policy "assignees update their assigned actions"
  on public.actions for update
  using (
    org_id = public.current_org_id()
    and assignee_id = auth.uid()
    and status in ('open', 'in_progress')
  )
  with check (org_id = public.current_org_id() and assignee_id = auth.uid());

-- Assignees may only move status forward, never verify/close their own action.
create or replace function public.actions_guard_transitions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_supervisor_or_admin() then
    return new;
  end if;
  -- non-supervisor path: must be the assignee (RLS already ensures this)
  if new.status is distinct from old.status then
    if not (
      (old.status = 'open' and new.status = 'in_progress')
      or (old.status = 'in_progress' and new.status = 'ready_for_verification')
    ) then
      raise exception 'transition % → % requires a supervisor', old.status, new.status;
    end if;
  end if;
  if new.assignee_id is distinct from old.assignee_id
     or new.verified_by is distinct from old.verified_by
     or new.due_date is distinct from old.due_date
     or new.priority is distinct from old.priority then
    raise exception 'only supervisors can reassign or change priority/due date/verification';
  end if;
  return new;
end;
$$;

create trigger actions_guard_transitions
  before update on public.actions
  for each row execute function public.actions_guard_transitions();

-- ---------------------------------------------------------------------------
-- evidence
-- ---------------------------------------------------------------------------

create policy "org members can read evidence"
  on public.evidence for select
  using (org_id = public.current_org_id());

create policy "org members upload evidence as themselves"
  on public.evidence for insert
  with check (
    org_id = public.current_org_id()
    and uploaded_by = auth.uid()
  );

create policy "supervisors can delete evidence"
  on public.evidence for delete
  using (org_id = public.current_org_id() and public.is_supervisor_or_admin());

-- ---------------------------------------------------------------------------
-- inspections
-- ---------------------------------------------------------------------------

create policy "org members read templates"
  on public.inspection_templates for select
  using (org_id = public.current_org_id());

create policy "admins manage templates"
  on public.inspection_templates for all
  using (org_id = public.current_org_id() and public.is_admin())
  with check (org_id = public.current_org_id() and public.is_admin());

create policy "org members read template items"
  on public.inspection_template_items for select
  using (
    template_id in (
      select id from public.inspection_templates where org_id = public.current_org_id()
    )
  );

create policy "admins manage template items"
  on public.inspection_template_items for all
  using (
    template_id in (
      select id from public.inspection_templates where org_id = public.current_org_id()
    )
    and public.is_admin()
  )
  with check (
    template_id in (
      select id from public.inspection_templates where org_id = public.current_org_id()
    )
    and public.is_admin()
  );

create policy "org members read inspection runs"
  on public.inspection_runs for select
  using (org_id = public.current_org_id());

create policy "org members start their own runs"
  on public.inspection_runs for insert
  with check (org_id = public.current_org_id() and inspector_id = auth.uid());

create policy "inspectors update their own open runs"
  on public.inspection_runs for update
  using (
    org_id = public.current_org_id()
    and inspector_id = auth.uid()
    and status = 'in_progress'
  )
  with check (org_id = public.current_org_id() and inspector_id = auth.uid());

create policy "supervisors manage inspection runs"
  on public.inspection_runs for update
  using (org_id = public.current_org_id() and public.is_supervisor_or_admin())
  with check (org_id = public.current_org_id());

create policy "org members read run items"
  on public.inspection_run_items for select
  using (
    run_id in (select id from public.inspection_runs where org_id = public.current_org_id())
  );

create policy "inspectors write items on their own open runs"
  on public.inspection_run_items for insert
  with check (
    run_id in (
      select id from public.inspection_runs
      where org_id = public.current_org_id()
        and inspector_id = auth.uid()
        and status = 'in_progress'
    )
  );

create policy "inspectors update items on their own open runs"
  on public.inspection_run_items for update
  using (
    run_id in (
      select id from public.inspection_runs
      where org_id = public.current_org_id()
        and inspector_id = auth.uid()
        and status = 'in_progress'
    )
  )
  with check (
    run_id in (
      select id from public.inspection_runs
      where org_id = public.current_org_id()
        and inspector_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- audit_events: append-only — SELECT and INSERT only, no UPDATE/DELETE policies
-- ---------------------------------------------------------------------------

create policy "org members read audit events"
  on public.audit_events for select
  using (org_id = public.current_org_id());

create policy "org members append audit events as themselves"
  on public.audit_events for insert
  with check (org_id = public.current_org_id() and actor_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Onboarding RPC: first user creates org + first site + admin profile
-- atomically. security definer because the caller has no profile yet.
-- ---------------------------------------------------------------------------

create or replace function public.onboard_organization(
  p_org_name text,
  p_org_slug text,
  p_full_name text,
  p_site_name text,
  p_site_code text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if exists (select 1 from public.profiles where id = v_user_id) then
    raise exception 'user already belongs to an organization';
  end if;

  insert into public.organizations (name, slug)
  values (trim(p_org_name), lower(trim(p_org_slug)))
  returning id into v_org_id;

  insert into public.profiles (id, org_id, full_name, role)
  values (v_user_id, v_org_id, trim(p_full_name), 'admin');

  insert into public.sites (org_id, name, code)
  values (v_org_id, trim(p_site_name), upper(trim(p_site_code)));

  -- Default hazard/defect categories with quarry-realistic terminology
  insert into public.categories (org_id, name, description, sort_order) values
    (v_org_id, 'Highwall & Bench Stability', 'Cracks, overhangs, loose blocks, bench crest damage', 1),
    (v_org_id, 'Blasting & Explosives', 'Misfires, flyrock, exclusion zone breaches, magazine issues', 2),
    (v_org_id, 'Mobile Plant & Haulage', 'Excavators, loaders, dumpers, haul road defects', 3),
    (v_org_id, 'Fixed Plant & Crushers', 'Crushers, screens, conveyors, gantry saws, wire saws', 4),
    (v_org_id, 'Electrical & Isolation', 'Cables, switchgear, lock-out/tag-out issues', 5),
    (v_org_id, 'Water & Slurry Management', 'Sump pumps, settling ponds, slurry lines, flooding', 6),
    (v_org_id, 'Dust & Ventilation', 'Silica dust suppression, sprays, extraction', 7),
    (v_org_id, 'PPE & Housekeeping', 'Missing PPE, blocked walkways, spills, signage', 8),
    (v_org_id, 'Lifting & Cranes', 'Slings, block handling, overhead crane defects', 9),
    (v_org_id, 'Other Hazard', 'Anything not covered by another category', 99);

  insert into public.audit_events (org_id, entity_type, entity_id, actor_id, event_type, detail)
  values (
    v_org_id, 'organization', v_org_id, v_user_id, 'organization_created',
    jsonb_build_object('name', trim(p_org_name))
  );

  return v_org_id;
end;
$$;

revoke execute on function public.onboard_organization(text, text, text, text, text) from anon;
grant execute on function public.onboard_organization(text, text, text, text, text) to authenticated;
