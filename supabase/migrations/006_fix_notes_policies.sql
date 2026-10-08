-- 006_fix_notes_policies.sql : Direct owner check in notes policies for performance and insert-returning compatibility

drop policy if exists notes_select on notes;
create policy notes_select on notes for select to authenticated
  using (owner_id = auth.uid() or has_note_access(id, 'viewer'));

drop policy if exists notes_update on notes;
create policy notes_update on notes for update to authenticated
  using (owner_id = auth.uid() or has_note_access(id, 'editor'))
  with check (owner_id = auth.uid() or has_note_access(id, 'editor'));
