-- 003_logic.sql : triggers, RPC functions, realtime

-- audit helper (silently skips when there is no signed-in user, e.g. SQL editor)
create function log_activity(p_note uuid, p_action text, p_details jsonb default '{}'::jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  insert into activity_log (user_id, note_id, action, details) values (auth.uid(), p_note, p_action, p_details);
end $$;

-- Folder cycle prevention (recursive CTE)
create function prevent_folder_cycle() returns trigger language plpgsql as $$
begin
  if new.parent_id is null then return new; end if;
  if new.parent_id = new.id then raise exception 'A folder cannot be its own parent'; end if;
  if exists (
    with recursive ancestors as (
      select id, parent_id from folders where id = new.parent_id
      union all
      select f.id, f.parent_id from folders f join ancestors a on f.id = a.parent_id
    ) select 1 from ancestors where id = new.id
  ) then
    raise exception 'Folder cycle detected';
  end if;
  return new;
end $$;
create trigger folders_no_cycle before insert or update of parent_id on folders
  for each row execute function prevent_folder_cycle();

-- Versioning trigger.
--  * every content change bumps notes.version (optimistic-concurrency counter)
--  * a history snapshot of the OLD row is stored at most once per 2 minutes per note
--    (autosave fires often; we don't want a history row per keystroke)
create function notes_before_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.owner_id <> old.owner_id then
    raise exception 'Note ownership cannot be changed';
  end if;

  if (new.title, new.content) is distinct from (old.title, old.content) then
    if not exists (select 1 from note_versions
                   where note_id = old.id and created_at > now() - interval '2 minutes') then
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
create trigger notes_before_update before update on notes
  for each row execute function notes_before_update();

-- Activity logging triggers
create function notes_after_insert() returns trigger language plpgsql as $$
begin
  perform log_activity(new.id, 'CREATE_NOTE', jsonb_build_object('title', new.title));
  return new;
end $$;
create trigger notes_after_insert after insert on notes
  for each row execute function notes_after_insert();

create function notes_after_update() returns trigger language plpgsql as $$
begin
  if old.deleted_at is null and new.deleted_at is not null then
    perform log_activity(new.id, 'TRASH_NOTE', jsonb_build_object('title', new.title));
  elsif old.deleted_at is not null and new.deleted_at is null then
    perform log_activity(new.id, 'RESTORE_NOTE', jsonb_build_object('title', new.title));
  elsif new.folder_id is distinct from old.folder_id then
    perform log_activity(new.id, 'MOVE_NOTE', jsonb_build_object('from', old.folder_id, 'to', new.folder_id));
  elsif new.version > old.version
        and not exists (select 1 from activity_log
                        where note_id = new.id and user_id = auth.uid() and action = 'EDIT_NOTE'
                          and created_at > now() - interval '10 minutes') then
    perform log_activity(new.id, 'EDIT_NOTE', jsonb_build_object('title', new.title, 'version', new.version));
  end if;
  return new;
end $$;
create trigger notes_after_update after update on notes
  for each row execute function notes_after_update();

create function notes_before_delete() returns trigger language plpgsql as $$
begin
  perform log_activity(null, 'DELETE_NOTE', jsonb_build_object('title', old.title));
  return old;
end $$;
create trigger notes_before_delete before delete on notes
  for each row execute function notes_before_delete();

create function collab_after_insert() returns trigger language plpgsql as $$
begin
  perform log_activity(new.note_id, 'SHARE_NOTE', jsonb_build_object('with', new.user_id, 'role', new.role));
  return new;
end $$;
create trigger collab_after_insert after insert on note_collaborators
  for each row execute function collab_after_insert();

create function attachments_after_insert() returns trigger language plpgsql as $$
begin
  perform log_activity(new.note_id, 'ADD_ATTACHMENT', jsonb_build_object('file', new.file_name));
  return new;
end $$;
create trigger attachments_after_insert after insert on attachments
  for each row execute function attachments_after_insert();

-- RPC: save with optimistic concurrency control.
-- Succeeds only if the caller's expected version matches the DB. Otherwise raises SQLSTATE 40001.
-- SECURITY INVOKER, so RLS still decides whether the caller may edit.
create function save_note(p_note_id uuid, p_expected_version int, p_title text, p_content jsonb, p_content_text text)
returns notes language plpgsql as $$
declare v_note notes;
begin
  update notes
     set title = p_title, content = p_content, content_text = p_content_text
   where id = p_note_id and version = p_expected_version and deleted_at is null
  returning * into v_note;

  if not found then
    raise exception 'VERSION_CONFLICT' using errcode = '40001';
  end if;
  return v_note;
end $$;

-- RPC: restore an old version (snapshots the current state first so nothing is lost)
create function restore_version(p_note_id uuid, p_version_no int) returns notes
language plpgsql as $$
declare v_old note_versions; v_cur notes; v_note notes;
begin
  select * into v_old from note_versions where note_id = p_note_id and version_no = p_version_no;
  if not found then raise exception 'Version not found'; end if;

  select * into v_cur from notes where id = p_note_id for update;
  if not found then raise exception 'Note not found or no access'; end if;

  insert into note_versions (note_id, version_no, title, content, content_text, saved_by)
  values (v_cur.id, v_cur.version, v_cur.title, v_cur.content, v_cur.content_text, auth.uid())
  on conflict (note_id, version_no) do nothing;

  update notes set title = v_old.title, content = v_old.content, content_text = v_old.content_text
   where id = p_note_id returning * into v_note;

  perform log_activity(p_note_id, 'RESTORE_VERSION', jsonb_build_object('version_no', p_version_no));
  return v_note;
end $$;

-- RPC: share by email (owner only)
create function share_note(p_note_id uuid, p_email text, p_role collab_role) returns void
language plpgsql security definer set search_path = public as $$
declare v_target uuid;
begin
  if not is_note_owner(p_note_id) then raise exception 'Only the owner can share this note'; end if;
  select id into v_target from auth.users where lower(email) = lower(p_email);
  if v_target is null then raise exception 'No user with that email'; end if;
  if v_target = auth.uid() then raise exception 'You already own this note'; end if;
  insert into note_collaborators (note_id, user_id, role) values (p_note_id, v_target, p_role)
  on conflict (note_id, user_id) do update set role = excluded.role;
end $$;

-- RPC: full-text search (SECURITY INVOKER, so RLS limits results to accessible notes)
create function search_notes(p_query text, p_limit int default 20)
returns table (id uuid, title text, snippet text, score real, updated_at timestamptz)
language sql stable as $$
  select n.id, n.title,
         ts_headline('english', n.content_text, q, 'MaxFragments=2,MaxWords=20,MinWords=8'),
         ts_rank(n.search_vector, q),
         n.updated_at
    from notes n, websearch_to_tsquery('english', p_query) q
   where n.deleted_at is null and n.search_vector @@ q
   order by 4 desc
   limit p_limit;
$$;

-- RPC: breadcrumb path for a folder (recursive CTE)
create function get_folder_path(p_folder_id uuid)
returns table (id uuid, name text, depth int)
language sql stable as $$
  with recursive up as (
    select f.id, f.name, f.parent_id, 0 as depth from folders f where f.id = p_folder_id
    union all
    select f.id, f.name, f.parent_id, up.depth + 1 from folders f join up on f.id = up.parent_id
  )
  select id, name, depth from up order by depth desc;
$$;

-- keep-alive ping (callable with the anon key)
create function ping() returns text language sql stable as $$ select now()::text; $$;
grant execute on function ping() to anon, authenticated;

-- Realtime (RLS is respected by Realtime)
alter publication supabase_realtime add table notes, drawings, comments, note_collaborators;
