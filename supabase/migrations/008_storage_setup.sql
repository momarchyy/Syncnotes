-- 008_storage_setup.sql: Initialize note-files private bucket and storage RLS policies

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('note-files', 'note-files', false, 5242880, array['image/png','image/jpeg','image/webp','image/gif'])
on conflict (id) do update set
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/png','image/jpeg','image/webp','image/gif'];

-- Storage RLS policies for note-files bucket
-- Path format: {owner_id}/{note_id}/{filename}.webp
-- (storage.foldername(name))[2] extracts {note_id}

drop policy if exists "note files read" on storage.objects;
drop policy if exists "note files insert" on storage.objects;
drop policy if exists "note files delete" on storage.objects;

create policy "note files read" on storage.objects for select to authenticated
  using (
    bucket_id = 'note-files' and (
      (storage.foldername(name))[1]::uuid = auth.uid()
      or has_note_access(((storage.foldername(name))[2])::uuid, 'viewer')
    )
  );

create policy "note files insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'note-files' and (
      (storage.foldername(name))[1]::uuid = auth.uid()
      or has_note_access(((storage.foldername(name))[2])::uuid, 'editor')
    )
  );

create policy "note files delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'note-files' and (
      (storage.foldername(name))[1]::uuid = auth.uid()
      or has_note_access(((storage.foldername(name))[2])::uuid, 'editor')
    )
  );
