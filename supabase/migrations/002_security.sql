-- 002_security.sql : access helpers, RLS policies, storage

-- Is the current user the owner of this note?
create function is_note_owner(p_note_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from notes where id = p_note_id and owner_id = auth.uid());
$$;

-- Does the current user have at least p_min access? (owner always passes)
-- Enum comparison works because collab_role is declared viewer < commenter < editor.
create function has_note_access(p_note_id uuid, p_min collab_role default 'viewer') returns boolean
language sql stable security definer set search_path = public as $$
  select is_note_owner(p_note_id)
      or exists (select 1 from note_collaborators c
                 where c.note_id = p_note_id and c.user_id = auth.uid() and c.role >= p_min);
$$;

alter table profiles           enable row level security;
alter table user_settings      enable row level security;
alter table folders            enable row level security;
alter table notes              enable row level security;
alter table note_versions      enable row level security;
alter table tags               enable row level security;
alter table note_tags          enable row level security;
alter table attachments        enable row level security;
alter table drawings           enable row level security;
alter table note_collaborators enable row level security;
alter table comments           enable row level security;
alter table note_links         enable row level security;
alter table activity_log       enable row level security;

-- profiles: any signed-in user can read display names; only edit your own
create policy profiles_read   on profiles for select to authenticated using (true);
create policy profiles_update on profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy settings_all on user_settings for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy folders_all on folders for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- notes
create policy notes_select on notes for select to authenticated using (has_note_access(id, 'viewer'));
create policy notes_insert on notes for insert to authenticated with check (owner_id = auth.uid());
create policy notes_update on notes for update to authenticated
  using (has_note_access(id, 'editor')) with check (has_note_access(id, 'editor'));
create policy notes_delete on notes for delete to authenticated using (owner_id = auth.uid());

-- versions: read-only for users (written by trigger)
create policy versions_select on note_versions for select to authenticated using (has_note_access(note_id, 'viewer'));

-- tags belong to their owner
create policy tags_all on tags for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy note_tags_select on note_tags for select to authenticated using (has_note_access(note_id, 'viewer'));
create policy note_tags_write  on note_tags for all to authenticated
  using (is_note_owner(note_id))
  with check (is_note_owner(note_id) and exists (select 1 from tags t where t.id = tag_id and t.owner_id = auth.uid()));

create policy attachments_select on attachments for select to authenticated using (has_note_access(note_id, 'viewer'));
create policy attachments_insert on attachments for insert to authenticated
  with check (uploader_id = auth.uid() and has_note_access(note_id, 'editor'));
create policy attachments_delete on attachments for delete to authenticated using (has_note_access(note_id, 'editor'));

create policy drawings_select on drawings for select to authenticated using (has_note_access(note_id, 'viewer'));
create policy drawings_write  on drawings for all to authenticated
  using (has_note_access(note_id, 'editor')) with check (has_note_access(note_id, 'editor'));

-- collaborators: owner manages; a collaborator can see their own row
create policy collab_select on note_collaborators for select to authenticated
  using (user_id = auth.uid() or is_note_owner(note_id));
create policy collab_write on note_collaborators for all to authenticated
  using (is_note_owner(note_id)) with check (is_note_owner(note_id));

create policy comments_select on comments for select to authenticated using (has_note_access(note_id, 'viewer'));
create policy comments_insert on comments for insert to authenticated
  with check (author_id = auth.uid() and has_note_access(note_id, 'commenter'));
create policy comments_update on comments for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy comments_delete on comments for delete to authenticated
  using (author_id = auth.uid() or is_note_owner(note_id));

create policy links_select on note_links for select to authenticated using (has_note_access(source_note_id, 'viewer'));
create policy links_write  on note_links for all to authenticated
  using (has_note_access(source_note_id, 'editor'))
  with check (has_note_access(source_note_id, 'editor') and has_note_access(target_note_id, 'viewer'));

-- activity: you can read your own; rows are inserted only by SECURITY DEFINER triggers
create policy activity_select on activity_log for select to authenticated using (user_id = auth.uid());

-- Storage: private bucket, path convention {owner_id}/{note_id}/{file}
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('note-files', 'note-files', false, 5242880, array['image/png','image/jpeg','image/webp','image/gif'])
on conflict (id) do nothing;

create policy "note files read" on storage.objects for select to authenticated
  using (bucket_id = 'note-files' and has_note_access(((storage.foldername(name))[2])::uuid, 'viewer'));
create policy "note files insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'note-files' and has_note_access(((storage.foldername(name))[2])::uuid, 'editor'));
create policy "note files delete" on storage.objects for delete to authenticated
  using (bucket_id = 'note-files' and has_note_access(((storage.foldername(name))[2])::uuid, 'editor'));
