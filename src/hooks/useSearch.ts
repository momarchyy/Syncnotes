import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  score: number;
  updated_at: string;
  is_favorite?: boolean;
  is_archived?: boolean;
  folder_id?: string | null;
  tags?: { id: string; name: string; color: string }[];
  titleMatches?: boolean;
  contentMatches?: boolean;
}

/**
 * Sanitizes HTML returned by PostgreSQL ts_headline or custom highlight.
 * Safely escapes all HTML characters while preserving only <b> and </b> match markers.
 */
export function sanitizeHeadline(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/&lt;b&gt;/g, '<b class="bg-amber-200/90 dark:bg-amber-900/60 text-amber-950 dark:text-amber-200 px-1 py-0.5 rounded font-semibold">')
    .replace(/&lt;\/b&gt;/g, '</b>');
}

/**
 * Hook to execute full-text and partial substring search against notes.
 * Combines search_notes RPC with ILIKE queries on title and content,
 * ensuring partial matches like "ol" matching "oll" and title matches work reliably.
 */
export function useSearchNotes(query: string) {
  const trimmed = query.trim();

  return useQuery({
    queryKey: ['search_notes', trimmed],
    queryFn: async (): Promise<SearchResult[]> => {
      if (!trimmed) return [];

      const clean = trimmed.toLowerCase();
      const resultsMap = new Map<string, SearchResult>();

      // 1. Database search_notes RPC
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('search_notes', {
          p_query: trimmed,
          p_limit: 50,
        });

        if (!rpcError && Array.isArray(rpcData)) {
          rpcData.forEach((item) => {
            const titleLower = (item.title || '').toLowerCase();
            const titleMatches = titleLower.includes(clean);
            resultsMap.set(item.id, {
              ...item,
              score: (item.score || 0) + (titleMatches ? 10 : 0),
              titleMatches,
              contentMatches: true,
            });
          });
        }
      } catch (err) {
        console.warn('search_notes RPC query completed with notice:', err);
      }

      // 2. Direct ILIKE search for instant partial substring matching (e.g. "ol" -> "oll", and title matches)
      try {
        const { data: directNotes, error: notesError } = await supabase
          .from('notes')
          .select('id, title, content_text, updated_at, is_favorite, is_archived, folder_id, tags(id, name, color)')
          .is('deleted_at', null)
          .or(`title.ilike.%${trimmed}%,content_text.ilike.%${trimmed}%`)
          .limit(50);

        if (!notesError && directNotes) {
          directNotes.forEach((n) => {
            const titleLower = (n.title || '').toLowerCase();
            const textLower = (n.content_text || '').toLowerCase();
            const titleMatches = titleLower.includes(clean);
            const contentMatches = textLower.includes(clean);

            let snippet = '';
            if (contentMatches && n.content_text) {
              const idx = textLower.indexOf(clean);
              const start = Math.max(0, idx - 40);
              const end = Math.min(n.content_text.length, idx + clean.length + 60);
              const rawSub = n.content_text.substring(start, end);
              const prefix = start > 0 ? '...' : '';
              const suffix = end < n.content_text.length ? '...' : '';
              const escapedTerm = clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              const regex = new RegExp(`(${escapedTerm})`, 'gi');
              snippet = prefix + rawSub.replace(regex, '<b>$1</b>') + suffix;
            } else if (titleMatches) {
              snippet = `Matched in title`;
            }

            const existing = resultsMap.get(n.id);
            const tags = (n.tags as unknown as { id: string; name: string; color: string }[]) || [];

            if (existing) {
              resultsMap.set(n.id, {
                ...existing,
                is_favorite: n.is_favorite,
                is_archived: n.is_archived,
                folder_id: n.folder_id,
                tags,
                titleMatches: titleMatches || existing.titleMatches,
                contentMatches: contentMatches || existing.contentMatches,
                snippet: existing.snippet || snippet,
                score: existing.score + (titleMatches ? 10 : 2),
              });
            } else {
              resultsMap.set(n.id, {
                id: n.id,
                title: n.title,
                snippet: snippet || n.title,
                score: titleMatches ? 15 : 5,
                updated_at: n.updated_at,
                is_favorite: n.is_favorite,
                is_archived: n.is_archived,
                folder_id: n.folder_id,
                tags,
                titleMatches,
                contentMatches,
              });
            }
          });
        }
      } catch (err) {
        console.warn('Direct notes ILIKE search notice:', err);
      }

      const list = Array.from(resultsMap.values());
      list.sort((a, b) => b.score - a.score);
      return list;
    },
    enabled: trimmed.length > 0,
    staleTime: 1000 * 5,
  });
}
