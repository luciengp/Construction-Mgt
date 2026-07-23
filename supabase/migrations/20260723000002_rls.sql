-- Row-Level Security: all access keyed on active memberships.
-- Coarse role gates live here; the fine-grained domain rules (dual sign-off,
-- countersign downgrade, etc.) are enforced in src/domain/ via server actions.
-- The service role bypasses RLS and is used only by trusted server code
-- (seeding, sign-up transaction, PIN login).

-- ── Helper functions (security definer so policies don't recurse) ────

create or replace function public.is_project_member(p_project uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from memberships m
    where m.project_id = p_project
      and m.user_id = auth.uid()
      and m.active
  );
$$;

create or replace function public.project_role(p_project uuid)
returns member_role
language sql stable security definer
set search_path = public
as $$
  select m.role from memberships m
  where m.project_id = p_project
    and m.user_id = auth.uid()
    and m.active
  limit 1;
$$;

create or replace function public.is_org_member(p_org uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from memberships m
    where m.org_id = p_org
      and m.user_id = auth.uid()
      and m.active
  );
$$;

-- ── Enable RLS everywhere ────────────────────────────────────────────

alter table orgs enable row level security;
alter table projects enable row level security;
alter table memberships enable row level security;
alter table checklist_families enable row level security;
alter table milestones enable row level security;
alter table inspections enable row level security;
alter table checklist_items enable row level security;
alter table inspection_records enable row level security;
alter table photos enable row level security;
alter table ncrs enable row level security;
alter table defects enable row level security;
alter table payments enable row level security;
alter table drafts enable row level security;
alter table legal_documents enable row level security;
alter table agreement_acceptances enable row level security;

-- ── Tenancy ──────────────────────────────────────────────────────────

create policy orgs_select on orgs
  for select using (is_org_member(id));

create policy projects_select on projects
  for select using (is_project_member(id));

create policy projects_update_owner on projects
  for update using (project_role(id) = 'owner');

-- Members see their own membership rows; owners and CMs see the whole
-- project roster. Only owners manage the roster.
create policy memberships_select on memberships
  for select using (
    user_id = auth.uid()
    or project_role(project_id) in ('owner', 'cm')
  );

create policy memberships_insert_owner on memberships
  for insert with check (project_role(project_id) = 'owner');

create policy memberships_update_owner on memberships
  for update using (project_role(project_id) = 'owner');

create policy memberships_delete_owner on memberships
  for delete using (project_role(project_id) = 'owner');

-- ── Reference data: readable by any signed-in user, written by seed only

create policy checklist_families_select on checklist_families
  for select to authenticated using (true);

-- ── ITP structure: read for members; structure is seeded server-side ─

create policy milestones_select on milestones
  for select using (is_project_member(project_id));

create policy inspections_select on inspections
  for select using (is_project_member(project_id));

create policy checklist_items_select on checklist_items
  for select using (
    exists (
      select 1 from inspections i
      where i.id = checklist_items.inspection_id
        and is_project_member(i.project_id)
    )
  );

-- ── Inspection log: viewers read, signing roles write ────────────────

create policy inspection_records_select on inspection_records
  for select using (is_project_member(project_id));

create policy inspection_records_insert on inspection_records
  for insert with check (
    project_role(project_id) in ('owner', 'cm', 'contractor')
  );

create policy inspection_records_update on inspection_records
  for update using (
    project_role(project_id) in ('owner', 'cm', 'contractor')
  );

-- ── Photos ───────────────────────────────────────────────────────────

create policy photos_select on photos
  for select using (is_project_member(project_id));

create policy photos_insert on photos
  for insert with check (
    project_role(project_id) in ('owner', 'cm', 'contractor')
  );

-- ── Registers: NCRs and defects are managed by the CM side ───────────

create policy ncrs_select on ncrs
  for select using (is_project_member(project_id));

create policy ncrs_write on ncrs
  for all using (project_role(project_id) in ('owner', 'cm'))
  with check (project_role(project_id) in ('owner', 'cm'));

create policy defects_select on defects
  for select using (is_project_member(project_id));

create policy defects_write on defects
  for all using (project_role(project_id) in ('owner', 'cm'))
  with check (project_role(project_id) in ('owner', 'cm'));

-- ── Payments: everyone on the project sees them, only the owner certifies

create policy payments_select on payments
  for select using (is_project_member(project_id));

create policy payments_update_owner on payments
  for update using (project_role(project_id) = 'owner');

-- ── Drafts: anyone with submit rights can save/resume/clear ──────────

create policy drafts_select on drafts
  for select using (is_project_member(project_id));

create policy drafts_write on drafts
  for all using (project_role(project_id) in ('owner', 'cm', 'contractor'))
  with check (project_role(project_id) in ('owner', 'cm', 'contractor'));

-- ── Legal ────────────────────────────────────────────────────────────

-- The agreement must be readable on the sign-up screen, before auth.
create policy legal_documents_select on legal_documents
  for select to anon, authenticated using (true);

create policy agreement_acceptances_select_own on agreement_acceptances
  for select using (user_id = auth.uid());

create policy agreement_acceptances_insert_own on agreement_acceptances
  for insert with check (user_id = auth.uid());
