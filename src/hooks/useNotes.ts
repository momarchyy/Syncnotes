import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { Database, Json } from '../types/database';
import type { Tag } from './useTags';

export type Note = Database['public']['Tables']['notes']['Row'] & {
  tags?: Tag[];
  folder?: { id: string; name: string } | null;
};
export type NoteUpdate = Database['public']['Tables']['notes']['Update'];

export interface NoteFilter {
  type?: 'all' | 'favorites' | 'shared' | 'archive' | 'trash' | 'folder' | 'tag';
  folderId?: string | null;
  tagId?: string;
}

export function useNotes(filter: NoteFilter = { type: 'all' }) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['notes', user?.id, filter],
    queryFn: async (): Promise<Note[]> => {
      if (!user) return [];

      let query = supabase
        .from('notes')
        .select('*, tags(id, name, color), folder:folders(id, name)');

      if (filter.type === 'trash') {
        query = query.not('deleted_at', 'is', null);
      } else {
        query = query.is('deleted_at', null);

        if (filter.type === 'favorites') {
          // Show all favorites regardless of archive status
          query = query.eq('is_favorite', true);
        } else if (filter.type === 'shared') {
          // Query notes where the user is a collaborator (not the owner)
          const { data: collabNotes } = await supabase
            .from('note_collaborators')
            .select('note_id')
            .eq('user_id', user.id);
          const sharedIds = collabNotes?.map((c) => c.note_id) || [];
          if (sharedIds.length === 0) return [];
          query = query.in('id', sharedIds);
        } else if (filter.type === 'archive') {
          query = query.eq('is_archived', true);
        } else if (filter.type === 'folder' && filter.folderId) {
          query = query.eq('folder_id', filter.folderId);
        } else if (filter.type === 'tag' && filter.tagId) {
          const { data: tagNoteIds } = await supabase
            .from('note_tags')
            .select('note_id')
            .eq('tag_id', filter.tagId);
          const ids = tagNoteIds?.map((t) => t.note_id) || [];
          if (ids.length === 0) return [];
          query = query.in('id', ids);
        }

        if (filter.folderId !== undefined && filter.type !== 'folder') {
          if (filter.folderId === null) {
            query = query.is('folder_id', null);
          } else {
            query = query.eq('folder_id', filter.folderId);
          }
        }
      }

      const { data, error } = await query
        .order('is_pinned', { ascending: false })
        .order('updated_at', { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      return (data as Note[]) || [];
    },
    enabled: !!user,
  });
}

export function useNote(id?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['note', id],
    queryFn: async (): Promise<Note | null> => {
      if (!id || !user) return null;

      const { data, error } = await supabase
        .from('notes')
        .select('*, tags(id, name, color), folder:folders(id, name)')
        .eq('id', id)
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return data as Note;
    },
    enabled: !!id && !!user,
  });
}

export function useCreateNote() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (initialValues?: { title?: string; folderId?: string | null }): Promise<Note> => {
      if (!user) throw new Error('Not authenticated');

      const id = crypto.randomUUID();
      const newNote = {
        id,
        owner_id: user.id,
        title: initialValues?.title?.trim() || 'Untitled',
        content: { type: 'doc', content: [] } as Json,
        content_text: '',
        folder_id: initialValues?.folderId ?? null,
      };

      const { error } = await supabase.from('notes').insert(newNote);
      if (error) throw new Error(error.message);

      return {
        ...newNote,
        version: 1,
        is_pinned: false,
        is_favorite: false,
        is_archived: false,
        deleted_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        search_vector: null,
      };
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      queryClient.setQueryData(['note', created.id], created);
    },
  });
}

export function useUpdateNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: NoteUpdate & { id: string }): Promise<void> => {
      const { error } = await supabase
        .from('notes')
        .update(updates)
        .eq('id', id);

      if (error) throw new Error(error.message);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      queryClient.invalidateQueries({ queryKey: ['note', variables.id] });
    },
  });
}

export function useSetNoteFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      noteId,
      folderId,
    }: {
      noteId: string;
      folderId: string | null;
    }): Promise<void> => {
      const { error } = await supabase
        .from('notes')
        .update({ folder_id: folderId })
        .eq('id', noteId);

      if (error) throw new Error(error.message);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      queryClient.invalidateQueries({ queryKey: ['note', variables.noteId] });
    },
  });
}

export function useTrashNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from('notes')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw new Error(error.message);
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      queryClient.invalidateQueries({ queryKey: ['note', id] });
    },
  });
}

export function useRestoreNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from('notes')
        .update({ deleted_at: null })
        .eq('id', id);

      if (error) throw new Error(error.message);
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      queryClient.invalidateQueries({ queryKey: ['note', id] });
    },
  });
}

export function useDeleteNotePermanently() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from('notes').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
  });
}

/**
 * Global Realtime hook to keep notes lists in sync across tabs and devices.
 * Automatically invalidates React Query 'notes' queries when any note is
 * inserted, updated, or deleted in Supabase.
 */
export function useNotesRealtime() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`notes-realtime-list-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notes',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['notes'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);
}
