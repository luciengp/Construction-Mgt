-- Photo storage: private bucket, paths are <project_id>/<family>/<milestone>/<file>.
-- The spec's family/milestone foldering is kept, prefixed with the project id so
-- storage policies can enforce tenancy from the path alone.

insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

create policy photos_bucket_read on storage.objects
  for select using (
    bucket_id = 'photos'
    and is_project_member(((storage.foldername(name))[1])::uuid)
  );

create policy photos_bucket_insert on storage.objects
  for insert with check (
    bucket_id = 'photos'
    and project_role(((storage.foldername(name))[1])::uuid)
        in ('owner', 'cm', 'contractor')
  );
