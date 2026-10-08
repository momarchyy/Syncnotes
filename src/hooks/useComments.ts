import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { Database } from '../types/database';

export type Comment = Database['public']['Tables']['comments']['Row'] & {
  profiles?: {
    id: string;
    display_name: string | null;
  } | null;
};

/**
 * Hook to query all comments for a note ordered by created_at ascending,
 * with Realtime updates enabled so comments appear immediately for all collaborators.
 */
export function useNoteComments(noteId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!noteId) return;

    const channelId = `note-comments-${noteId}-${Math.random().toString(36).substring(2, 9)}`;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comments',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['comments', noteId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [noteId, queryClient]);

  return useQuery({
    queryKey: ['comments', noteId],
    queryFn: async (): Promise<Comment[]> => {
      if (!noteId) return [];

      const { data, error } = await supabase
        .from('comments')
        .select('*, profiles(id, display_name)')
        .eq('note_id', noteId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching comments:', error);
        throw error;
      }

      return (data as unknown as Comment[]) || [];
    },
    enabled: !!noteId,
  });
}

/**
 * Mutation to post a new comment on a note
 */
export function useAddComment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ noteId, body }: { noteId: string; body: string }) => {
      if (!user) throw new Error('You must be signed in to comment');

      const trimmed = body.trim();
      if (!trimmed) throw new Error('Comment cannot be empty');

      const { data, error } = await supabase
        .from('comments')
        .insert({
          note_id: noteId,
          author_id: user.id,
          body: trimmed,
        })
        .select('*, profiles(id, display_name)')
        .single();

      if (error) throw error;
      return data as unknown as Comment;
    },
    onSuccess: (_, { noteId }) => {
      queryClient.invalidateQueries({ queryKey: ['comments', noteId] });
    },
  });
}

/**
 * Mutation to delete a comment (author or note owner)
 */
export function useDeleteComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ commentId, noteId }: { commentId: string; noteId: string }) => {
      const { data, error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;
      return { commentId, noteId, data };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['comments', result.noteId] });
    },
  });
}
