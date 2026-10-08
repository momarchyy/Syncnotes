-- 007_fix_save_note.sql : Fix save_note exception to prevent PostgREST retry loop
-- SQLSTATE 40001 triggers PostgREST's automatic transaction retry loop, causing HTTP timeouts.
-- Raising 'VERSION_CONFLICT' with default P0001 returns immediately to the client.

create or replace function save_note(
  p_note_id uuid,
  p_expected_version int,
  p_title text,
  p_content jsonb,
  p_content_text text
)
returns notes language plpgsql as $$
declare v_note notes;
begin
  update notes
     set title = p_title, content = p_content, content_text = p_content_text
   where id = p_note_id and version = p_expected_version and deleted_at is null
  returning * into v_note;

  if not found then
    raise exception 'VERSION_CONFLICT';
  end if;
  return v_note;
end $$;
