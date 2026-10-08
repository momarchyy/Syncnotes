-- 001_core.sql : types, tables, indexes, basic triggers

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
