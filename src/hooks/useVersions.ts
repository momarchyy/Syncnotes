import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

export type NoteVersion = Database['public']['Tables']['note_versions']['Row'];

/**
 * Fetch all historical snapshots for a given note ordered by version number descending
 */
export function useNoteVersions(noteId: string | undefined) {
  return useQuery({
    queryKey: ['note_versions', noteId],
    queryFn: async () => {
      if (!noteId) return [];
      const { data, error } = await supabase
        .from('note_versions')
        .select('*')
        .eq('note_id', noteId)
        .order('version_no', { ascending: false });

      if (error) {
        console.error('Error fetching note_versions:', error);
        throw error;
      }
      return data || [];
    },
    enabled: !!noteId,
  });
}

/**
 * Mutation to restore a historical version of a note via restore_version RPC.
 * Snapshots the current state before replacing note title and content with the selected version.
 */
export function useRestoreVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ noteId, versionNo }: { noteId: string; versionNo: number }) => {
      const { data, error } = await supabase.rpc('restore_version', {
        p_note_id: noteId,
        p_version_no: versionNo,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { noteId }) => {
      queryClient.invalidateQueries({ queryKey: ['note', noteId] });
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      queryClient.invalidateQueries({ queryKey: ['note_versions', noteId] });
    },
  });
}
