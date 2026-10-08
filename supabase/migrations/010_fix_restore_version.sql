-- ============================================================
-- 010_fix_restore_version.sql
-- Fix restore_version RPC by adding security definer and permission checks
-- ============================================================

create or replace function restore_version(p_note_id uuid, p_version_no int) returns notes
language plpgsql security definer set search_path = public as $$
declare
  v_old note_versions;
  v_cur notes;
  v_note notes;
begin
  -- Ensure caller has editor access or is the owner
  if not (is_note_owner(p_note_id) or has_note_access(p_note_id, 'editor')) then
    raise exception 'Permission denied: must have editor access to restore versions';
  end if;

  select * into v_old from note_versions where note_id = p_note_id and version_no = p_version_no;
  if not found then raise exception 'Version not found'; end if;

  select * into v_cur from notes where id = p_note_id for update;
  if not found then raise exception 'Note not found'; end if;

  -- Snapshot the current state into note_versions before restoring
  insert into note_versions (note_id, version_no, title, content, content_text, saved_by)
  values (v_cur.id, v_cur.version, v_cur.title, v_cur.content, v_cur.content_text, auth.uid())
  on conflict (note_id, version_no) do nothing;

  -- Restore title, content, and content_text
  update notes
     set title = v_old.title,
         content = v_old.content,
         content_text = v_old.content_text
   where id = p_note_id
  returning * into v_note;

  perform log_activity(p_note_id, 'RESTORE_VERSION', jsonb_build_object('version_no', p_version_no));
  return v_note;
end $$;

-- Allow authenticated users to execute restore_version
grant execute on function restore_version(uuid, int) to authenticated;
