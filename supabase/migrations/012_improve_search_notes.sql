-- Migration 012: Improve search_notes with prefix matching, title ILIKE matching, and title snippets

create or replace function search_notes(p_query text, p_limit int default 50)
returns table (id uuid, title text, snippet text, score real, updated_at timestamptz)
language plpgsql stable as $$
declare
  v_clean text := trim(p_query);
  v_prefix_query text;
  v_tsquery tsquery;
begin
  if v_clean = '' then
    return;
  end if;

  -- Create prefix-matching tsquery for partial words (e.g., 'ol' -> 'ol:*')
  begin
    v_prefix_query := regexp_replace(v_clean, '([a-zA-Z0-9_]+)', '\1:*', 'g');
    v_prefix_query := regexp_replace(v_prefix_query, '\s+', ' & ', 'g');
    v_tsquery := to_tsquery('english', v_prefix_query);
  exception when others then
    v_tsquery := plainto_tsquery('english', v_clean);
  end;

  return query
  select n.id,
         n.title,
         ts_headline(
           'english',
           coalesce(n.title, '') || ' — ' || coalesce(n.content_text, ''),
           coalesce(v_tsquery, plainto_tsquery('english', v_clean)),
           'MaxFragments=2,MaxWords=25,MinWords=8'
         ) as snippet,
         (
           ts_rank(n.search_vector, coalesce(v_tsquery, plainto_tsquery('english', v_clean))) * 2 +
           case when n.title ilike '%' || v_clean || '%' then 10.0 else 0.0 end +
           case when n.content_text ilike '%' || v_clean || '%' then 2.0 else 0.0 end
         )::real as score,
         n.updated_at
    from notes n
   where n.deleted_at is null
     and (
       (v_tsquery is not null and n.search_vector @@ v_tsquery)
       or n.title ilike '%' || v_clean || '%'
       or n.content_text ilike '%' || v_clean || '%'
     )
   order by score desc, n.updated_at desc
   limit p_limit;
end;
$$;
