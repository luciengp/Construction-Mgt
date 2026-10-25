-- Increment 2: per-element checklist, consolidated into the Programme planner.
-- Each physical element (footing, column, wet area, door, window) hangs off
-- its governing inspection and carries a dual Contractor + CM pass/fail+remark,
-- mirroring the app's two-party sign-off model.

create table if not exists elements (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  inspection_code text not null,
  element_id text not null,
  category text not null,
  element_type text,
  label text,
  qty int not null default 1,
  sort_order int not null default 0,
  -- contractor sign-off
  contractor_result text check (contractor_result in ('PASS','FAIL','PASS_WITH_COMMENT','NA')),
  contractor_remarks text,
  contractor_by uuid,
  contractor_at timestamptz,
  -- CM sign-off
  cm_result text check (cm_result in ('PASS','FAIL','PASS_WITH_COMMENT','NA')),
  cm_remarks text,
  cm_by uuid,
  cm_at timestamptz,
  unique (project_id, element_id),
  foreign key (project_id, inspection_code)
    references inspections (project_id, code) on delete cascade
);

alter table elements enable row level security;

create policy elements_select on elements
  for select using (is_project_member(project_id));
create policy elements_insert on elements
  for insert with check (
    project_role(project_id) in ('owner', 'cm', 'contractor')
  );
create policy elements_update on elements
  for update using (
    project_role(project_id) in ('owner', 'cm', 'contractor')
  ) with check (
    project_role(project_id) in ('owner', 'cm', 'contractor')
  );

create index if not exists elements_project_insp_idx
  on elements (project_id, inspection_code);
