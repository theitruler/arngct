-- Applied to arngct as add_managed_programs. Program content comes from this table.
create table public.programs (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 160),
  summary text not null check (char_length(trim(summary)) between 1 and 2000),
  status text not null default 'upcoming' check (status in ('ongoing','upcoming','completed')),
  location text not null default '' check (char_length(location) <= 160),
  schedule text not null default 'Dates to be announced' check (char_length(schedule) <= 160),
  image_url text not null default '' check (image_url = '' or image_url ~ '^https?://'),
  image_path text unique,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);
create index programs_created_idx on public.programs (created_at desc, id desc);
alter table public.programs enable row level security;
revoke all on public.programs from anon, authenticated;
grant select on public.programs to anon, authenticated;
grant insert, update, delete on public.programs to authenticated;
grant all on public.programs to service_role;
create policy programs_public_read on public.programs for select to anon, authenticated using (is_published);
create policy programs_admin_read on public.programs for select to authenticated using ((select auth.jwt()->'app_metadata'->>'role') = 'admin');
create policy programs_admin_insert on public.programs for insert to authenticated with check ((select auth.jwt()->'app_metadata'->>'role') = 'admin');
create policy programs_admin_update on public.programs for update to authenticated using ((select auth.jwt()->'app_metadata'->>'role') = 'admin') with check ((select auth.jwt()->'app_metadata'->>'role') = 'admin');
create policy programs_admin_delete on public.programs for delete to authenticated using ((select auth.jwt()->'app_metadata'->>'role') = 'admin');
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('program-images','program-images',true,5242880,array['image/jpeg','image/png','image/webp']);
create policy program_images_admin_read on storage.objects for select to authenticated
  using (bucket_id='program-images' and (select auth.jwt()->'app_metadata'->>'role')='admin');
create policy program_images_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id='program-images' and (select auth.jwt()->'app_metadata'->>'role')='admin' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy program_images_admin_delete on storage.objects for delete to authenticated
  using (bucket_id='program-images' and (select auth.jwt()->'app_metadata'->>'role')='admin');
-- Preserve the existing site content during the one-time move from JSON.
insert into public.programs (title,summary,status,location,schedule,image_url)
values ('Planting trees, growing stewardship',
  'A community tree-planting initiative designed to create greener shared spaces and spark long-term care for the local environment.',
  'upcoming','Bengaluru','Dates to be announced',
  'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=360&q=85');
