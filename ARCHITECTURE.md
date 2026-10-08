# SyncNotes: Project Spec and Build Instructions

> **For the AI agent (Gemini in Antigravity):** This file is the single source of truth for the project. Read ALL of it before writing any code. Follow the rules in Section 2 strictly. Build in the phases from Section 8, and **stop at every checkpoint** to report what you did and wait for the user. Do not skip ahead.

## 0. Kickoff prompt (the user pastes this into Antigravity)

```
Read ARCHITECTURE.md fully. Then execute Phase 0 only:
scaffold the project, write all SQL migration files exactly as specified,
create SETUP.md with the manual steps I must do in Supabase, and stop.
Do not start Phase 1 until I confirm Supabase is set up.
```

---

## 1. Project summary

**SyncNotes** is a cloud-synced note-taking web app built as a **Database Management Systems course project**. The database is the star of the project, so business logic lives in PostgreSQL (triggers, RLS policies, functions, views, indexes), not in a custom server.

**User-facing features**
- Register / log in (email+password and Google). Each user sees only their own notes, plus notes shared with them.
- Notes with rich text, pasted images, and finger / mouse / trackpad / stylus drawing.
- Real-time sync between devices (edit on laptop, appears on phone).
- Folders (nested), tags, pin/favorite/archive, trash with restore.
- Database-powered full-text search.
- Version history with restore.
- Sharing with permissions (viewer / commenter / editor) and comments.
- Activity log and an analytics page (all computed with SQL).
- Installable PWA, mobile-first responsive UI.

**Constraints:** 100% free tier. No paid services. No custom backend server.

---

## 2. Hard rules (non-negotiable)

1. **Schema changes only through numbered SQL files** in `supabase/migrations/`. Never invent columns or tables in application code. If you need a schema change, add a new migration file and tell the user.
2. **Row Level Security is enabled on every table in `public`.** Never ship a table without it. Never use the `service_role` key anywhere in the frontend or the repo. Only the **anon key** goes in `.env`.
3. **Business logic goes in the database** where this spec says so (versioning, activity logging, conflict detection, sharing, search). The frontend calls RPC functions; it does not re-implement them.
4. **TypeScript strict mode.** Generate DB types with `supabase gen types typescript` (or hand-write them from the schema if the CLI is unavailable) into `src/types/database.ts`.
5. **Secrets:** `.env` is git-ignored. Provide `.env.example`.
6. **Vertical slices.** Finish and verify one phase before starting the next. Commit after each phase with a clear message.
7. **No placeholder or fake data in the UI.** Everything shown comes from Supabase.
8. **Ask before adding any dependency** not listed in Section 3.
9. **Keep the code simple enough that a student can explain every file in a viva.** Prefer clarity over cleverness. Comment non-obvious logic.
10. After each phase, run the app and the type-check/lint, fix errors, then report.

---

## 3. Tech stack

| Layer | Choice |
|---|---|
| Frontend | React + TypeScript + Vite (static SPA, no SSR) |
| Styling | Tailwind CSS, lucide-react icons |
| Routing | react-router-dom (BrowserRouter; add `vercel.json` rewrite to `index.html`) |
| Server state | @tanstack/react-query |
| Rich text | Tiptap (`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-placeholder`, `@tiptap/extension-task-list`, `@tiptap/extension-task-item`) |
| Drawing | HTML `<canvas>` + Pointer Events + `perfect-freehand` |
| Image compression | `browser-image-compression` |
| Dates | `date-fns` |
| Backend | **Supabase**: Postgres, Auth, Storage, Realtime (`@supabase/supabase-js`) |
| PWA | `vite-plugin-pwa` (Phase 11, optional) |
| Hosting | Vercel (Hobby) or GitHub Pages, both static |

No Next.js, no Express, no Firebase.

---

## 4. Repository structure

```
syncnotes/
├── ARCHITECTURE.md            ← this file
├── SETUP.md                   ← manual steps for the human (agent writes this)
├── .env.example
├── vercel.json
├── supabase/
│   ├── migrations/
│   │   ├── 001_core.sql
│   │   ├── 002_security.sql
│   │   ├── 003_logic.sql
│   │   └── 004_views.sql
│   └── schema_all.sql         ← 001..004 concatenated, for pasting into the SQL Editor
├── docs/                      ← DBMS deliverables (Section 9)
├── .github/workflows/keepalive.yml
└── src/
    ├── lib/supabase.ts
    ├── types/database.ts
    ├── hooks/                 ← useNotes, useNote, useFolders, useTags, useRealtime, ...
    ├── components/
    │   ├── editor/            ← NoteEditor, StorageImage node, DrawingNode, Toolbar
    │   ├── drawing/           ← DrawingCanvas, DrawingToolbar
    │   ├── layout/            ← Sidebar, MobileNav, TopBar
    │   └── ui/                ← Button, Modal, Toast, ...
    ├── pages/                 ← Auth, Notes, NoteView, Shared, Trash, Archive, Search, Analytics, Activity, Settings
    └── App.tsx
```

---

## 5. Environment variables

`.env.example`
```
VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-ANON-PUBLIC-KEY
```

`SETUP.md` (agent must write it) must walk the human through:
1. Create a free project at supabase.com. Save the database password.
2. Open **SQL Editor**, paste the contents of `supabase/schema_all.sql`, run it. Confirm there are no errors.
3. **Authentication → Providers:** Email enabled. For demos, turn **off** "Confirm email" (the free built-in email sender has a very low send limit). Optionally enable Google (needs a Google Cloud OAuth client; give short steps).
4. **Authentication → URL Configuration:** set Site URL to `http://localhost:5173` for dev, and add the production URL later.
5. **Project Settings → API:** copy the Project URL and the `anon` public key into `.env`.
6. Verify in **Table Editor** that every table shows RLS enabled.
7. Add GitHub repo secrets `SUPABASE_URL` and `SUPABASE_ANON_KEY` for the keep-alive workflow (Section 11).

> Free-tier note: Supabase free projects auto-pause after about a week of inactivity. The keep-alive workflow in Section 11 prevents this.

---

## 6. Database specification

### 6.1 Entity overview

| Table | Purpose | Notable relationships |
|---|---|---|
| `profiles` | Public user info | 1:1 with `auth.users` |
| `user_settings` | Preferences | 1:1 with `profiles` |
| `folders` | Nested folders | Self-referencing `parent_id` |
| `notes` | The notes | N:1 `profiles`, N:1 `folders` |
| `note_versions` | History snapshots | Composite PK `(note_id, version_no)` |
| `tags` | User tags | N:1 `profiles` |
| `note_tags` | Note↔Tag | M:N, composite PK |
| `attachments` | Image metadata (files in Storage) | N:1 `notes` |
| `drawings` | Vector strokes as JSONB | N:1 `notes` |
| `note_collaborators` | Sharing + role | M:N `notes`↔`profiles`, composite PK |
| `comments` | Comments on notes | N:1 `notes`, N:1 `profiles` |
| `note_links` | Note↔Note links | Self-referencing M:N |
| `activity_log` | Audit trail | N:1 `profiles`, N:1 `notes` |

### 6.2 `supabase/migrations/001_core.sql`

```sql
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
```

### 6.3 `supabase/migrations/002_security.sql`

```sql
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
```

### 6.4 `supabase/migrations/003_logic.sql`

```sql
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
```

### 6.5 `supabase/migrations/004_views.sql`

```sql
-- 004_views.sql : analytics views (security_invoker = RLS applies to the caller)

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
```

> The agent must also generate `supabase/schema_all.sql` = concatenation of 001 to 004 in order.

---

## 7. Frontend specification

### 7.1 Routes
`/auth` (login/register tabs + Google button) · `/` (all notes) · `/note/:id` · `/shared` · `/favorites` · `/archive` · `/trash` · `/folder/:id` · `/tag/:id` · `/search?q=` · `/analytics` · `/activity` · `/settings`. All except `/auth` require a session.

### 7.2 Layout
- **Desktop:** left sidebar (All notes, Favorites, Shared with me, Archive, Trash, folder tree, tags, Analytics, Activity, Settings) + main area.
- **Mobile:** top bar + slide-out drawer; note editor takes the full screen; floating "+" button.
- Light/dark theme from `user_settings.theme`.
- Note list: cards with title, snippet, tags, updated time, pin/favorite icons. Pinned notes first.

### 7.3 Editor (`NoteEditor`)
- Title input + Tiptap body. Toolbar: bold, italic, headings, bullet/numbered/task lists, code, **Add image**, **Add drawing**.
- **Autosave:** debounce 1500 ms after the last change. Call `rpc('save_note', {p_note_id, p_expected_version, p_title, p_content, p_content_text})`. On success, store the returned `version`. `p_content_text` = `editor.getText()`.
- **Save status chip:** `Saving…` / `Saved` / `Offline` / `Conflict`.
- **Conflict (error code `40001`):** fetch the latest note and show a dialog: *Keep mine* (re-save against the latest version), *Take theirs* (discard local changes), *Copy mine to a new note*.
- **Realtime:** subscribe with `supabase.channel(...).on('postgres_changes', {event:'UPDATE', schema:'public', table:'notes', filter:`id=eq.${id}`}, ...)`. If the incoming `version` is greater than the local one and the editor has no unsaved changes, replace the content. If there are unsaved changes, show a "changed on another device" banner (do not clobber the user's text). Ignore echoes of the client's own saves (same version).
- **Image paste/drop:** intercept via Tiptap `editorProps.handlePaste` / `handleDrop`. Compress with `browser-image-compression` (max width 1600 px, WebP, about 0.8 quality). Upload to bucket `note-files` at `{owner_id}/{note_id}/{uuid}.webp`. Insert a row into `attachments`. Insert a custom node `storageImage` with attribute `path` (NOT a URL, because the bucket is private). The node view resolves a **signed URL** (`createSignedUrl(path, 3600)`) with an in-memory cache.
- **Drawing:** custom block node `drawing` with attribute `drawingId`. "Add drawing" inserts a row in `drawings`, then inserts the node. The node view renders `DrawingCanvas`.
- Version history panel (list from `note_versions`, preview, **Restore** → `rpc('restore_version')`).
- Share modal (owner only): email + role → `rpc('share_note')`; list collaborators; change role / remove. Comments panel (needs commenter or higher to post).
- Viewers get a read-only editor (`editable: false`).

### 7.4 Drawing canvas (`DrawingCanvas`)
- Logical size 1200×800 stored in `drawings.width/height`; scale to container with CSS, converting pointer coordinates back to logical space.
- Use **Pointer Events** (`pointerdown/move/up/cancel`) with `setPointerCapture`. Set `touch-action: none` on the canvas. This single code path handles finger, mouse, trackpad, and stylus.
- If `pointerType === 'pen'` has been seen, ignore `pointerType === 'touch'` input (palm rejection).
- Use `perfect-freehand` `getStroke` to render smooth, pressure-sensitive strokes. Use `e.pressure` when available.
- Stroke JSON: `{ points: [[x,y,pressure],...], color, size, tool: 'pen'|'highlighter'|'eraser' }`. Eraser = remove whole strokes that the pointer touches (simple and fast).
- Tools: pen, highlighter, eraser, color picker (6 presets), size slider, undo, redo, clear, fullscreen toggle (important on mobile).
- Debounce-save strokes to `drawings.strokes` (1000 ms). Subscribe to realtime updates for the drawing.

### 7.5 Other pages
- **Search:** debounced input → `rpc('search_notes')`; show highlighted snippet (`ts_headline` returns `<b>` tags; sanitize before rendering).
- **Folders:** tree view built client-side from a flat list; create/rename/delete/move; breadcrumb via `rpc('get_folder_path')`.
- **Tags:** create, assign, filter.
- **Trash:** list notes with `deleted_at is not null`; Restore (set `deleted_at = null`) and Delete permanently.
- **Shared with me:** notes whose `owner_id != auth user` (RLS already restricts to shared ones). Show the role badge.
- **Analytics:** read from the four views. Show stat cards plus simple charts (plain SVG or CSS bars; no chart library unless the user approves).
- **Activity:** paginated list from `activity_log`, grouped by day.
- **Settings:** theme, font size, auto-save toggle, display name.

### 7.6 Error handling and UX
Every Supabase call checks `error`. Show a toast for failures. Skeleton loaders on lists. Empty states with a clear call to action.

---

## 8. Build phases (stop at each CHECKPOINT)

**Phase 0: Scaffold + database files**
- Vite React TS + Tailwind + all Section 3 deps. Folder structure from Section 4. `.env.example`, `vercel.json`, `.gitignore`.
- Write migrations 001 to 004 **exactly** as in Section 6, plus `schema_all.sql`.
- Write `SETUP.md` (Section 5).
- *CHECKPOINT:* the user creates the Supabase project, runs the SQL, fills `.env`.

**Phase 1: Auth**
- Supabase client, session provider, protected routes, `/auth` page (email/password, Google), logout, profile name in the top bar.
- *Acceptance:* sign up creates rows in `profiles` and `user_settings` automatically; refresh keeps the session.

**Phase 2: Notes CRUD + layout**
- Responsive layout, notes list, create/open/edit title+body (plain Tiptap), pin/favorite/archive, trash/restore/delete.
- *Acceptance:* two different accounts cannot see each other's notes (test with two browsers).

**Phase 3: Autosave + conflict detection**
- `save_note` RPC, status chip, conflict dialog.
- *Acceptance:* open the same note in two tabs, edit both → the second save shows the conflict dialog.

**Phase 4: Realtime sync**
- Realtime subscription, "changed elsewhere" banner, live list updates.
- *Acceptance:* edit on laptop → phone updates within about 2 seconds.

**Phase 5: Folders + tags**

**Phase 6: Images** (paste, drop, button; compression; signed URLs)

**Phase 7: Drawing** (Section 7.4; test on a real phone)

**Phase 8: Version history + restore**

**Phase 9: Sharing + comments** (roles enforced; test viewer cannot edit, commenter can only comment)

**Phase 10: Search + Activity + Analytics**

**Phase 11: PWA + polish** (manifest, icons, service worker, install prompt; optional offline read cache of recent notes)

**Phase 12: Deploy** (Vercel or GitHub Pages; set production URL in Supabase Auth settings; keep-alive workflow; final README)

After each phase: run `npm run build` and `npx tsc --noEmit`, fix everything, commit, report.

---

## 9. DBMS deliverables (create in `docs/` during or after Phase 10)

1. `er-diagram.md`: Mermaid `erDiagram` of all tables with cardinalities.
2. `normalization.md`: brief 1NF/2NF/3NF justification per table, plus the deliberate denormalizations (`content_text`, `version`) and why.
3. `demo-queries.sql`: 15+ queries to demo live: JOINs, GROUP BY / HAVING, subquery, recursive CTE (folder tree), window function (`rank() over (partition by owner_id ...)`), FTS with `ts_rank`, a view query.
4. `perf-test.sql`: seed about 10,000 notes with `generate_series`, then show `EXPLAIN ANALYZE` of a search **with** and **without** the GIN index (drop/recreate it in a transaction you roll back). Include before/after timings.
5. `concurrency.md`: how optimistic locking (`version` + `save_note`) detects lost updates, with a two-tab demo script.
6. `security.md`: RLS policy table (who can do what per table/role) and a test matrix.
7. Screenshots folder for the report.

---

## 10. Testing checklist (agent runs through this before the final report)

- [ ] User A cannot select, update, or delete User B's notes, folders, tags, drawings, files.
- [ ] Viewer cannot edit; commenter can comment but not edit; editor can edit but cannot share or delete.
- [ ] Storage: User B cannot fetch User A's image by path.
- [ ] Moving a folder into its own descendant is rejected.
- [ ] Rapid autosaves create one history snapshot per 2 minutes, not one per save.
- [ ] Trash → restore → permanent delete all work and are logged.
- [ ] Drawing works with mouse, trackpad, touch (real phone), and stylus if available. The page does not scroll while drawing.
- [ ] Pasting a screenshot into the editor uploads and shows it after reload.
- [ ] Production build has no `service_role` key anywhere (`grep -ri service_role .`).

---

## 11. Keep-alive workflow (`.github/workflows/keepalive.yml`)

```yaml
name: Keep Supabase awake
on:
  schedule:
    - cron: '0 6 */3 * *'   # every 3 days
  workflow_dispatch:
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Call ping() RPC
        run: |
          curl -sf -X POST "${{ secrets.SUPABASE_URL }}/rest/v1/rpc/ping" \
            -H "apikey: ${{ secrets.SUPABASE_ANON_KEY }}" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}" \
            -H "Content-Type: application/json" -d '{}'
```

---

## 12. Definition of done

The app is deployed on a free host; two devices stay in sync; every feature in Section 1 works; the Section 10 checklist passes; the `docs/` pack from Section 9 exists; the README explains setup and architecture in under a page.
