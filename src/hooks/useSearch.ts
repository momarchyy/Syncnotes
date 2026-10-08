import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  score: number;
  updated_at: string;
}

/**
 * Sanitizes HTML returned by PostgreSQL ts_headline.
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
 * Hook to execute full-text search against the database via search_notes RPC.
 */
export function useSearchNotes(query: string) {
  const trimmed = query.trim();

  return useQuery({
    queryKey: ['search_notes', trimmed],
    queryFn: async (): Promise<SearchResult[]> => {
      if (!trimmed) return [];

      const { data, error } = await supabase.rpc('search_notes', {
        p_query: trimmed,
        p_limit: 30,
      });

      if (error) throw error;
      return (data as SearchResult[]) || [];
    },
    enabled: trimmed.length > 0,
    staleTime: 1000 * 10,
  });
}
