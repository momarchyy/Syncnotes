import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Database } from '../types/database';

export type NoteStats = Database['public']['Views']['v_note_stats']['Row'];
export type NotesPerMonth = Database['public']['Views']['v_notes_per_month']['Row'];
export type TopTag = Database['public']['Views']['v_top_tags']['Row'];
export type ActivityByWeekday = Database['public']['Views']['v_activity_by_weekday']['Row'];

export interface AnalyticsData {
  stats: NoteStats;
  notesPerMonth: NotesPerMonth[];
  topTags: TopTag[];
  activityByWeekday: ActivityByWeekday[];
}

const defaultStats: NoteStats = {
  owner_id: '',
  total_notes: 0,
  notes_this_month: 0,
  favorites: 0,
  archived: 0,
  in_trash: 0,
  total_words: 0,
};

export function useAnalytics() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['analytics', user?.id],
    queryFn: async (): Promise<AnalyticsData> => {
      if (!user) {
        return {
          stats: defaultStats,
          notesPerMonth: [],
          topTags: [],
          activityByWeekday: [],
        };
      }

      const [statsRes, monthlyRes, tagsRes, weekdayRes] = await Promise.all([
        supabase.from('v_note_stats').select('*').maybeSingle(),
        supabase.from('v_notes_per_month').select('*').order('month', { ascending: true }),
        supabase.from('v_top_tags').select('*').order('note_count', { ascending: false }).limit(10),
        supabase.from('v_activity_by_weekday').select('*').order('weekday', { ascending: true }),
      ]);

      if (statsRes.error) throw statsRes.error;
      if (monthlyRes.error) throw monthlyRes.error;
      if (tagsRes.error) throw tagsRes.error;
      if (weekdayRes.error) throw weekdayRes.error;

      return {
        stats: statsRes.data || defaultStats,
        notesPerMonth: (monthlyRes.data as NotesPerMonth[]) || [],
        topTags: (tagsRes.data as TopTag[]) || [],
        activityByWeekday: (weekdayRes.data as ActivityByWeekday[]) || [],
      };
    },
    enabled: !!user,
    staleTime: 1000 * 30,
  });
}
