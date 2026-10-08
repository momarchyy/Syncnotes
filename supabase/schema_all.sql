-- schema_all.sql : Complete schema for SyncNotes (concatenation of 001 to 004)
-- For running in Supabase SQL Editor in one go.

-- ============================================================================
-- 001_core.sql : types, tables, indexes, basic triggers
-- ============================================================================

create type collab_role as enum ('viewer', 'commenter', 'editor');  -- declaration order = privilege order

-- generic updated_at maintenance
create function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) > 0),
  created_at   timestamptz not null default now()
);

create table user_settings (
  user_id            uuid primary key references profiles(id) on delete cascade,
  theme              text not null default 'system' check (theme in ('light','dark','system')),
  font_size          int  not null default 16 check (font_size between 12 and 24),
  default_note_color text not null default '#ffffff',
  auto_save          boolean not null default true
);

create table folders (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references profiles(id) on delete cascade,
  parent_id  uuid references folders(id) on delete cascade,
  name       text not null check (length(trim(name)) between 1 and 100),
  created_at timestamptz not null default now()
);
-- no duplicate sibling names per user (case-insensitive); root folders share one sentinel parent
create unique index folders_unique_sibling_name
  on folders (owner_id, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));
create index folders_owner_idx on folders(owner_id);

create table notes (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references profiles(id) on delete cascade,
  folder_id    uuid references folders(id) on delete set null,
  title        text not null default 'Untitled' check (length(title) <= 200),
  content      jsonb not null default '{}'::jsonb,        -- Tiptap JSON document
  content_text text  not null default '',                  -- plain text extracted by the client, for search
  version      int   not null default 1 check (version >= 1),  -- optimistic-concurrency counter
  is_pinned    boolean not null default false,
  is_favorite  boolean not null default false,
  is_archived  boolean not null default false,
  deleted_at   timestamptz,                                -- soft delete (trash)
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  search_vector tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title,'')), 'A') ||
    setweight(to_tsvector('english', coalesce(content_text,'')), 'B')
  ) stored
);
create index notes_search_idx on notes using gin (search_vector);
create index notes_owner_updated_idx on notes (owner_id, updated_at desc) where deleted_at is null;
create index notes_folder_idx on notes (folder_id);

create table note_versions (
  note_id      uuid not null references notes(id) on delete cascade,
  version_no   int  not null,
  title        text not null,
  content      jsonb not null,
  content_text text not null default '',
  saved_by     uuid references profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  primary key (note_id, version_no)
);

create table tags (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references profiles(id) on delete cascade,
  name       text not null check (length(trim(name)) between 1 and 40),
  color      text not null default '#6366f1',
  created_at timestamptz not null default now()
);
create unique index tags_owner_name_uq on tags (owner_id, lower(name));

create table note_tags (
  note_id uuid not null references notes(id) on delete cascade,
  tag_id  uuid not null references tags(id)  on delete cascade,
  primary key (note_id, tag_id)
);
create index note_tags_tag_idx on note_tags(tag_id);

create table attachments (
  id           uuid primary key default gen_random_uuid(),
  note_id      uuid not null references notes(id) on delete cascade,
  uploader_id  uuid not null references profiles(id) on delete cascade,
  storage_path text not null unique,       -- {owner_id}/{note_id}/{uuid}.webp
  file_name    text not null,
  mime_type    text not null check (mime_type like 'image/%'),
  size_bytes   bigint not null check (size_bytes > 0),
  created_at   timestamptz not null default now()
);
create index attachments_note_idx on attachments(note_id);

create table drawings (
  id         uuid primary key default gen_random_uuid(),
  note_id    uuid not null references notes(id) on delete cascade,
  strokes    jsonb not null default '[]'::jsonb,   -- [{points:[[x,y,pressure],...], color, size, tool}]
  width      int not null default 1200 check (width > 0),
  height     int not null default 800  check (height > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index drawings_note_idx on drawings(note_id);
create trigger drawings_updated_at before update on drawings
  for each row execute function set_updated_at();

create table note_collaborators (
  note_id    uuid not null references notes(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  role       collab_role not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (note_id, user_id)
);
create index note_collab_user_idx on note_collaborators(user_id);

create table comments (
  id         uuid primary key default gen_random_uuid(),
  note_id    uuid not null references notes(id) on delete cascade,
  author_id  uuid not null references profiles(id) on delete cascade,
  body       text not null check (length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index comments_note_idx on comments(note_id, created_at);
create trigger comments_updated_at before update on comments
  for each row execute function set_updated_at();

create table note_links (
  source_note_id uuid not null references notes(id) on delete cascade,
  target_note_id uuid not null references notes(id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (source_note_id, target_note_id),
  check (source_note_id <> target_note_id)
);

create table activity_log (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references profiles(id) on delete cascade,
  note_id    uuid references notes(id) on delete set null,
  action     text not null check (action in (
               'CREATE_NOTE','EDIT_NOTE','TRASH_NOTE','RESTORE_NOTE','DELETE_NOTE','MOVE_NOTE',
               'SHARE_NOTE','ADD_ATTACHMENT','RESTORE_VERSION')),
  details    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index activity_user_time_idx on activity_log (user_id, created_at desc);

-- auto-create profile + settings when someone signs up
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'full_name',''), split_part(new.email,'@',1)));
  insert into user_settings (user_id) values (new.id);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================================
-- 002_security.sql : access helpers, RLS policies, storage
-- ============================================================================

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

-- ============================================================================
-- 003_logic.sql : triggers, RPC functions, realtime
-- ============================================================================

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

-- ============================================================================
-- 004_views.sql : analytics views (security_invoker = RLS applies to the caller)
-- ============================================================================

create view v_note_stats with (security_invoker = true) as
select owner_id,
       count(*) filter (where deleted_at is null)                                  as total_notes,
       count(*) filter (where deleted_at is null and created_at >= date_trunc('month', now())) as notes_this_month,
       count(*) filter (where is_favorite and deleted_at is null)                  as favorites,
       count(*) filter (where is_archived and deleted_at is null)                  as archived,
       count(*) filter (where deleted_at is not null)                              as in_trash,
       coalesce(sum(array_length(regexp_split_to_array(trim(content_text), '\s+'), 1))
                filter (where deleted_at is null and content_text <> ''), 0)       as total_words
  from notes
 group by owner_id;

create view v_notes_per_month with (security_invoker = true) as
select owner_id, date_trunc('month', created_at) as month, count(*) as notes_created
  from notes where deleted_at is null
 group by owner_id, date_trunc('month', created_at);

create view v_top_tags with (security_invoker = true) as
select t.owner_id, t.id as tag_id, t.name, count(nt.note_id) as note_count
  from tags t left join note_tags nt on nt.tag_id = t.id
 group by t.owner_id, t.id, t.name;

create view v_activity_by_weekday with (security_invoker = true) as
select user_id, extract(dow from created_at)::int as weekday, count(*) as actions
  from activity_log
 group by user_id, extract(dow from created_at);


-- ============================================================================
-- 005_grants.sql : grant table and schema permissions to anon and authenticated
-- ============================================================================

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to anon;

grant usage, select on all sequences in schema public to authenticated;
grant usage, select on all sequences in schema public to anon;

grant execute on all routines in schema public to authenticated;
grant execute on all routines in schema public to anon;

alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant all on routines to anon, authenticated;


-- ============================================================================
-- 006_fix_notes_policies.sql : Direct owner check in notes policies
-- ============================================================================

drop policy if exists notes_select on notes;
create policy notes_select on notes for select to authenticated
  using (owner_id = auth.uid() or has_note_access(id, 'viewer'));

drop policy if exists notes_update on notes;
create policy notes_update on notes for update to authenticated
  using (owner_id = auth.uid() or has_note_access(id, 'editor'))
  with check (owner_id = auth.uid() or has_note_access(id, 'editor'));
