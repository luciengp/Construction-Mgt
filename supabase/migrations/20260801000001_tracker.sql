-- Increment 1: in-app Work Plan & Inspection Tracker.
-- Adds the contractor's phase schedule and a per-inspection tracking row
-- (the Excel tracker columns) on top of the existing inspection regime.
-- Formal result / sign-off still lives in inspection_records; this is the
-- editable planning & progress layer, grouped by phase and L2 activity.

create table if not exists phases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  code text not null,
  name text not null,
  sequence int not null,
  planned_start date,
  planned_end date,
  duration_days int,
  unique (project_id, code)
);

create table if not exists inspection_tracking (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  inspection_code text not null,
  -- grouping / ordering for the programme view
  phase_code text,
  activity text,
  schedule_seq int,
  -- contractor-maintained
  planned_date date,
  actual_date date,
  completion_date date,
  -- CM-maintained
  cm_check_date date,
  result text check (result in ('PASS', 'FAIL', 'PASS_WITH_COMMENT', 'NA')),
  remarks text,
  -- audit
  updated_by uuid,
  updated_at timestamptz not null default now(),
  unique (project_id, inspection_code),
  foreign key (project_id, inspection_code)
    references inspections (project_id, code) on delete cascade
);

-- ── RLS (mirrors the existing tables) ────────────────────────────────
alter table phases enable row level security;
alter table inspection_tracking enable row level security;

create policy phases_select on phases
  for select using (is_project_member(project_id));
create policy phases_write on phases
  for all using (project_role(project_id) = 'owner')
  with check (project_role(project_id) = 'owner');

create policy inspection_tracking_select on inspection_tracking
  for select using (is_project_member(project_id));
create policy inspection_tracking_insert on inspection_tracking
  for insert with check (
    project_role(project_id) in ('owner', 'cm', 'contractor')
  );
create policy inspection_tracking_update on inspection_tracking
  for update using (
    project_role(project_id) in ('owner', 'cm', 'contractor')
  ) with check (
    project_role(project_id) in ('owner', 'cm', 'contractor')
  );

create index if not exists inspection_tracking_project_idx
  on inspection_tracking (project_id);
