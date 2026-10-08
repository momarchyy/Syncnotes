-- ============================================================
-- 009_version_interval_10s.sql
-- Reduce version snapshot interval from 2 minutes to 10 seconds
-- for immediate testing, and ensure owners have direct select on note_versions.
-- ============================================================

create or replace function notes_before_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.owner_id <> old.owner_id then
    raise exception 'Note ownership cannot be changed';
  end if;

  if (new.title, new.content) is distinct from (old.title, old.content) then
    -- Snapshot the previous version if at least 10 seconds have elapsed
    if not exists (select 1 from note_versions
                   where note_id = old.id and created_at > now() - interval '10 seconds') then
      insert into note_versions (note_id, version_no, title, content, content_text, saved_by)
      values (old.id, old.version, old.title, old.content, old.content_text, auth.uid())
      on conflict (note_id, version_no) do nothing;
    end if;
    new.version := old.version + 1;
    new.updated_at := now();
  elsif (new.is_pinned, new.is_favorite, new.is_archived, new.deleted_at, new.folder_id)
        is distinct from (old.is_pinned, old.is_favorite, old.is_archived, old.deleted_at, old.folder_id) then
    new.updated_at := now();
  end if;
  return new;
end $$;

-- Ensure select policy covers note owner directly as well as collaborators
drop policy if exists versions_select on note_versions;
create policy versions_select on note_versions for select to authenticated
  using (is_note_owner(note_id) or has_note_access(note_id, 'viewer'));
