-- Store each party's own checklist answers (incl. an optional note per check)
-- so the Owner can see the Contractor's and the CM's marks side by side.
-- `checks` remains the effective/latest answers (used for NCR failed-items).
alter table inspection_records
  add column if not exists contractor_checks jsonb,
  add column if not exists cm_checks jsonb;
