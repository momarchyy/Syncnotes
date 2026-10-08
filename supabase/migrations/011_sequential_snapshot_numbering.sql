-- ============================================================
-- 011_sequential_snapshot_numbering.sql
-- 1. Number history snapshots sequentially (v1, v2, v3...) based on indexed snapshots
--    rather than arbitrary internal auto-save concurrency counters.
-- 2. Set snapshot interval to 1 minute (interval '1 minute').
-- 3. Fix restore_version with SECURITY DEFINER and sequential snapshotting.
-- ============================================================

create or replace function notes_before_update() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_next_version_no int;
begin
  if new.owner_id <> old.owner_id then
    raise exception 'Note ownership cannot be changed';
  end if;

  if (new.title, new.content) is distinct from (old.title, old.content) then
    -- Snapshot the previous version once every 1 minute
    if not exists (select 1 from note_versions
                   where note_id = old.id and created_at > now() - interval '1 minute') then
      -- Next sequential index for history (1, 2, 3...)
      select coalesce(max(version_no), 0) + 1 into v_next_version_no
      from note_versions
      where note_id = old.id;

      insert into note_versions (note_id, version_no, title, content, content_text, saved_by)
      values (old.id, v_next_version_no, old.title, old.content, old.content_text, auth.uid())
      on conflict (note_id, version_no) do nothing;
    end if;

    -- Bump the note concurrency version counter
    new.version := old.version + 1;
    new.updated_at := now();
  elsif (new.is_pinned, new.is_favorite, new.is_archived, new.deleted_at, new.folder_id)
        is distinct from (old.is_pinned, old.is_favorite, old.is_archived, old.deleted_at, old.folder_id) then
    new.updated_at := now();
  end if;
  return new;
end $$;

-- Restore old version with sequential version numbering and SECURITY DEFINER
create or replace function restore_version(p_note_id uuid, p_version_no int) returns notes
language plpgsql security definer set search_path = public as $$
declare
  v_old note_versions;
  v_cur notes;
  v_note notes;
  v_next_version_no int;
begin
  if not (is_note_owner(p_note_id) or has_note_access(p_note_id, 'editor')) then
    raise exception 'Permission denied: must have editor access to restore versions';
  end if;

  select * into v_old from note_versions where note_id = p_note_id and version_no = p_version_no;
  if not found then raise exception 'Version not found'; end if;

  select * into v_cur from notes where id = p_note_id for update;
  if not found then raise exception 'Note not found'; end if;

  -- Snapshot current note state into note_versions before restoring
  select coalesce(max(version_no), 0) + 1 into v_next_version_no
  from note_versions
  where note_id = p_note_id;

  insert into note_versions (note_id, version_no, title, content, content_text, saved_by)
  values (v_cur.id, v_next_version_no, v_cur.title, v_cur.content, v_cur.content_text, auth.uid())
  on conflict (note_id, version_no) do nothing;

  -- Restore note content
  update notes
     set title = v_old.title,
         content = v_old.content,
         content_text = v_old.content_text
   where id = p_note_id
  returning * into v_note;

  perform log_activity(p_note_id, 'RESTORE_VERSION', jsonb_build_object('version_no', p_version_no));
  return v_note;
end $$;

grant execute on function restore_version(uuid, int) to authenticated;
