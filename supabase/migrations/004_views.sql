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
