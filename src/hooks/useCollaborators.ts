import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { Database } from '../types/database';

export type CollabRole = Database['public']['Enums']['collab_role'];

export interface Collaborator {
  note_id: string;
  user_id: string;
  role: CollabRole;
  created_at: string;
  profiles?: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

/**
 * Hook to fetch collaborators of a note with their profile information
 */
export function useCollaborators(noteId: string | undefined) {
  return useQuery({
    queryKey: ['collaborators', noteId],
    queryFn: async (): Promise<Collaborator[]> => {
      if (!noteId) return [];

      const { data, error } = await supabase
        .from('note_collaborators')
        .select('note_id, user_id, role, created_at, profiles(id, display_name, avatar_url)')
        .eq('note_id', noteId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching collaborators:', error);
        throw error;
      }

      return (data as unknown as Collaborator[]) || [];
    },
    enabled: !!noteId,
  });
}

/**
 * Determine user's effective role on the note ('owner' | 'editor' | 'commenter' | 'viewer')
 */
export function useNoteRole(noteId: string | undefined, noteOwnerId: string | undefined) {
  const { user } = useAuth();
  const { data: collaborators = [] } = useCollaborators(noteId);

  if (!user || !noteId) {
    return {
      role: 'viewer' as const,
      isOwner: false,
      canEdit: false,
      canComment: false,
      canShare: false,
    };
  }

  const isOwner = noteOwnerId ? user.id === noteOwnerId : false;
  if (isOwner) {
    return {
      role: 'owner' as const,
      isOwner: true,
      canEdit: true,
      canComment: true,
      canShare: true,
    };
  }

  const collab = collaborators.find((c) => c.user_id === user.id);
  const role = collab ? collab.role : ('viewer' as CollabRole);

  return {
    role,
    isOwner: false,
    canEdit: role === 'editor',
    canComment: role === 'editor' || role === 'commenter',
    canShare: false, // only note owner can manage collaborators
  };
}

/**
 * Mutation to share a note by email using PostgreSQL RPC share_note
 */
export function useShareNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      noteId,
      email,
      role,
    }: {
      noteId: string;
      email: string;
      role: CollabRole;
    }) => {
      const { data, error } = await supabase.rpc('share_note', {
        p_note_id: noteId,
        p_email: email.trim().toLowerCase(),
        p_role: role,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { noteId }) => {
      queryClient.invalidateQueries({ queryKey: ['collaborators', noteId] });
      queryClient.invalidateQueries({ queryKey: ['note', noteId] });
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
  });
}

/**
 * Mutation to remove a collaborator from a note (owner only)
 */
export function useRemoveCollaborator() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ noteId, userId }: { noteId: string; userId: string }) => {
      const { data, error } = await supabase
        .from('note_collaborators')
        .delete()
        .eq('note_id', noteId)
        .eq('user_id', userId);

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { noteId }) => {
      queryClient.invalidateQueries({ queryKey: ['collaborators', noteId] });
      queryClient.invalidateQueries({ queryKey: ['note', noteId] });
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
  });
}

/**
 * Mutation to update an existing collaborator's role (owner only)
 */
export function useUpdateCollaboratorRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      noteId,
      userId,
      role,
    }: {
      noteId: string;
      userId: string;
      role: CollabRole;
    }) => {
      const { data, error } = await supabase
        .from('note_collaborators')
        .update({ role })
        .eq('note_id', noteId)
        .eq('user_id', userId);

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { noteId }) => {
      queryClient.invalidateQueries({ queryKey: ['collaborators', noteId] });
    },
  });
}
