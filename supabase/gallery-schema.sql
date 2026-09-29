-- Gallery schema snapshot, deployed to arngct by the add_event_gallery migration.
-- Media files live in Storage; searchable details live in public.gallery_media.
create table public.gallery_media (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 160),
  tags text[] not null check (cardinality(tags) between 1 and 8 and array_position(tags, null) is null and array_position(tags, '') is null and char_length(array_to_string(tags, ',')) <= 350),
  storage_path text not null unique,
  media_type text not null check (media_type in ('image', 'video')),
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime')),
  size_bytes bigint not null check (size_bytes between 1 and 52428800),
  is_published boolean not null default false,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint gallery_media_kind_matches_mime check (split_part(mime_type, '/', 1) = media_type),
  constraint gallery_media_path_matches_identity check (
    storage_path = created_by::text || '/' || id::text || '.' ||
      case mime_type when 'image/jpeg' then 'jpg' when 'image/png' then 'png'
      when 'image/webp' then 'webp' when 'image/gif' then 'gif' when 'video/mp4' then 'mp4'
      when 'video/webm' then 'webm' when 'video/quicktime' then 'mov' end
  )
);
create index gallery_media_created_idx on public.gallery_media (created_at desc, id desc);
create index gallery_media_created_by_idx on public.gallery_media (created_by);
alter table public.gallery_media enable row level security;
revoke all on public.gallery_media from anon, authenticated;
grant select on public.gallery_media to anon, authenticated;
grant insert, update, delete on public.gallery_media to authenticated;
grant all on public.gallery_media to service_role;

create policy gallery_public_read on public.gallery_media for select to anon, authenticated
  using (is_published);
create policy gallery_admin_read on public.gallery_media for select to authenticated
  using ((select auth.jwt()->'app_metadata'->>'role') = 'admin');
create policy gallery_admin_insert on public.gallery_media for insert to authenticated
  with check ((select auth.jwt()->'app_metadata'->>'role') = 'admin' and created_by = (select auth.uid()));
create policy gallery_admin_update on public.gallery_media for update to authenticated
  using ((select auth.jwt()->'app_metadata'->>'role') = 'admin')
  with check ((select auth.jwt()->'app_metadata'->>'role') = 'admin');
create policy gallery_admin_delete on public.gallery_media for delete to authenticated
  using ((select auth.jwt()->'app_metadata'->>'role') = 'admin');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gallery-media', 'gallery-media', true, 52428800,
  array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime']);
-- Public buckets serve media, but uploads, listing, and deletion remain admin-only.
create policy gallery_storage_admin_read on storage.objects for select to authenticated
  using (bucket_id = 'gallery-media' and (select auth.jwt()->'app_metadata'->>'role') = 'admin');
create policy gallery_storage_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'gallery-media' and (select auth.jwt()->'app_metadata'->>'role') = 'admin'
    and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy gallery_storage_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'gallery-media' and (select auth.jwt()->'app_metadata'->>'role') = 'admin');
