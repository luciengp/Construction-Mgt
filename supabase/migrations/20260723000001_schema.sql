-- CMS schema: multi-tenant construction management.
-- Section 3 of the build spec. All access is enforced by RLS (see 0002).

create extension if not exists pgcrypto;

-- ── Enums ────────────────────────────────────────────────────────────

create type member_role as enum ('owner', 'cm', 'contractor', 'viewer');
create type point_type as enum ('HOLD', 'WITNESS', 'SURVEILLANCE', 'RECORDS');
create type inspection_result as enum ('PASS', 'PASS_WITH_COMMENT', 'FAIL');
create type signoff_state as enum
  ('DRAFT', 'AWAITING_CM', 'AWAITING_CONTRACTOR', 'COMPLETE', 'SUPERSEDED');
create type hidden_release_state as enum ('n/a', 'PENDING', 'RELEASED', 'DO_NOT_COVER');
create type register_status as enum ('OPEN', 'CLOSED');
create type defect_category as enum ('A', 'B', 'C');
create type payment_type as enum ('COMMENCEMENT', 'COMPLETION', 'RETENTION');
create type payment_status as enum ('HOLD', 'RELEASE', 'CERTIFIED', 'PAID');
create type acceptance_method as enum ('clickwrap');

-- ── Tenancy ──────────────────────────────────────────────────────────

create table orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs (id) on delete cascade,
  name text not null,
  contract_currency text not null default 'THB',
  contract_value numeric(14, 2),
  land_customer text,
  building_customer text,
  contractor text,
  commencement_date date,
  completion_date date,
  -- Configurable domain parameters (Section 4 "configurable" knobs).
  settings jsonb not null default '{
    "split": {"commencement": 0.5, "completion": 0.4, "retention": 0.1},
    "ncr_due_days": 14,
    "retention_delay_days": 30
  }'::jsonb,
  created_at timestamptz not null default now()
);

create table memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  org_id uuid not null references orgs (id) on delete cascade,
  project_id uuid not null references projects (id) on delete cascade,
  role member_role not null,
  -- Spec names this column `pin`; stored as a hash, never plaintext.
  pin_hash text,
  display_name text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, project_id)
);

-- A PIN must resolve to exactly one membership within a project.
create unique index memberships_project_pin_key
  on memberships (project_id, pin_hash) where pin_hash is not null;

-- ── Reference data ───────────────────────────────────────────────────

create table checklist_families (
  code text primary key,
  name text not null
);

-- ── Per-project ITP structure ────────────────────────────────────────

create table milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  code text not null,
  description text not null,
  sequence int not null,
  payer text,
  planned_start date,
  planned_end date,
  contract_value numeric(14, 2) not null default 0,
  unique (project_id, code)
);

create table inspections (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  code text not null,
  milestone_code text not null,
  name text not null,
  family_code text not null references checklist_families (code),
  drawing_ref text,
  boq_ref text,
  point_type point_type not null,
  hidden boolean not null default false,
  tests text,
  min_photos int not null default 0,
  responsible text,
  unique (project_id, code),
  foreign key (project_id, milestone_code)
    references milestones (project_id, code) on delete cascade
);

create table checklist_items (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references inspections (id) on delete cascade,
  seq int not null,
  text text not null,
  unique (inspection_id, seq)
);

-- ── The inspection log ───────────────────────────────────────────────

create table inspection_records (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  inspection_code text not null,
  result inspection_result,
  signoff signoff_state not null default 'DRAFT',
  contractor_signed_by uuid references auth.users (id),
  contractor_signed_at timestamptz,
  cm_signed_by uuid references auth.users (id),
  cm_signed_at timestamptz,
  area text,
  notes text,
  hidden_release hidden_release_state not null default 'n/a',
  checks jsonb not null default '[]'::jsonb,
  ncr_id uuid,
  created_at timestamptz not null default now(),
  superseded_at timestamptz,
  foreign key (project_id, inspection_code)
    references inspections (project_id, code) on delete cascade
);

create index inspection_records_lookup
  on inspection_records (project_id, inspection_code, created_at desc);

-- ── Registers ────────────────────────────────────────────────────────

create table photos (
  id uuid primary key default gen_random_uuid(),
  record_id uuid references inspection_records (id) on delete set null,
  project_id uuid not null references projects (id) on delete cascade,
  inspection_code text not null,
  milestone_code text not null,
  family_code text not null,
  ref text not null, -- e.g. P-M1.2-011-007
  storage_path text not null,
  hidden boolean not null default false,
  uploaded_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create table ncrs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  seq int not null,
  milestone_code text not null,
  inspection_code text,
  description text not null,
  clause_ref text,
  corrective_action text,
  due_date date,
  status register_status not null default 'OPEN',
  cost_impact numeric(14, 2),
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  verified_by uuid references auth.users (id),
  unique (project_id, seq)
);

alter table inspection_records
  add constraint inspection_records_ncr_fkey
  foreign key (ncr_id) references ncrs (id) on delete set null;

create table defects (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  seq int not null,
  milestone_code text not null,
  location text,
  description text not null,
  category defect_category not null,
  status register_status not null default 'OPEN',
  target_date date,
  photos jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  unique (project_id, seq)
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  milestone_code text not null,
  type payment_type not null,
  amount numeric(14, 2) not null,
  controlling_gate text not null,
  status payment_status not null default 'HOLD',
  certified_by uuid references auth.users (id),
  certified_at timestamptz,
  unique (project_id, milestone_code, type),
  foreign key (project_id, milestone_code)
    references milestones (project_id, code) on delete cascade
);

create table drafts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  inspection_code text not null,
  saved_by uuid references auth.users (id),
  saved_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  unique (project_id, inspection_code),
  foreign key (project_id, inspection_code)
    references inspections (project_id, code) on delete cascade
);

-- ── Legal (Section 4bis) ─────────────────────────────────────────────

create table legal_documents (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  version text not null,
  body_md text not null,
  effective_at timestamptz not null default now(),
  unique (slug, version)
);

create table agreement_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  org_id uuid references orgs (id) on delete set null,
  agreement_version text not null,
  accepted_at timestamptz not null default now(),
  ip_address text,
  user_agent text,
  affiliates_declared text,
  method acceptance_method not null default 'clickwrap'
);

create index agreement_acceptances_user on agreement_acceptances (user_id, accepted_at desc);
