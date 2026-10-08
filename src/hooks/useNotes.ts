import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { Database, Json } from '../types/database';

export type Note = Database['public']['Tables']['notes']['Row'];
export type NoteUpdate = Database['public']['Tables']['notes']['Update'];

export interface NoteFilter {
  type?: 'all' | 'favorites' | 'archive' | 'trash';
  folderId?: string | null;
  tagId?: string;
}

export function useNotes(filter: NoteFilter = { type: 'all' }) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['notes', user?.id, filter],
    queryFn: async (): Promise<Note[]> => {
      if (!user) return [];

      let query = supabase.from('notes').select('*');

      if (filter.type === 'trash') {
        query = query.not('deleted_at', 'is', null);
      } else {
        query = query.is('deleted_at', null);

        if (filter.type === 'favorites') {
          query = query.eq('is_favorite', true).eq('is_archived', false);
        } else if (filter.type === 'archive') {
          query = query.eq('is_archived', true);
        } else {
          // 'all' notes
          query = query.eq('is_archived', false);
        }

        if (filter.folderId !== undefined) {
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

      return data || [];
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
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return data;
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

      const { data, error } = await supabase
        .from('notes')
        .insert({
          owner_id: user.id,
          title: initialValues?.title?.trim() || 'Untitled',
          content: { type: 'doc', content: [] } as Json,
          content_text: '',
          folder_id: initialValues?.folderId ?? null,
        })
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
  });
}

export function useUpdateNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: NoteUpdate & { id: string }): Promise<Note> => {
      const { data, error } = await supabase
        .from('notes')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      queryClient.setQueryData(['note', updated.id], updated);
    },
  });
}

export function useTrashNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<Note> => {
      const { data, error } = await supabase
        .from('notes')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
  });
}

export function useRestoreNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<Note> => {
      const { data, error } = await supabase
        .from('notes')
        .update({ deleted_at: null })
        .eq('id', id)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
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
