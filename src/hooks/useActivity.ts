import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { ActivityAction, Json } from '../types/database';

export interface ActivityLogItem {
  id: string | number;
  user_id: string;
  note_id: string | null;
  action: ActivityAction;
  details: Json;
  created_at: string;
  notes?: {
    id: string;
    title: string;
  } | null;
}

export function useActivityLog(page = 1, pageSize = 20) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['activity_log', user?.id, page, pageSize],
    queryFn: async (): Promise<{ items: ActivityLogItem[]; totalCount: number }> => {
      if (!user) return { items: [], totalCount: 0 };

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await supabase
        .from('activity_log')
        .select('*, notes(id, title)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      return {
        items: (data as unknown as ActivityLogItem[]) || [],
        totalCount: count ?? 0,
      };
    },
    enabled: !!user,
    staleTime: 1000 * 15,
  });
}
