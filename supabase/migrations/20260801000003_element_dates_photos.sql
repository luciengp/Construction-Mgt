-- Element-level planning dates + per-element photos.
alter table elements add column if not exists planned_date date;
alter table elements add column if not exists actual_date date;
alter table elements add column if not exists completion_date date;
alter table elements add column if not exists cm_check_date date;

-- Photos can attach to an element (null = inspection-level photo, as before).
alter table photos add column if not exists element_id text;
create index if not exists photos_element_idx on photos (project_id, element_id);
