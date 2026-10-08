import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { Database } from '../types/database';

export type Tag = Database['public']['Tables']['tags']['Row'];

export const TAG_COLORS = [
  '#6366f1', // Indigo
  '#ec4899', // Pink
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#06b6d4', // Cyan
  '#8b5cf6', // Purple
  '#ef4444', // Red
  '#64748b', // Slate
];

export function useTags() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['tags', user?.id],
    queryFn: async (): Promise<Tag[]> => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .eq('owner_id', user.id)
        .order('name');

      if (error) throw new Error(error.message);
      return data || [];
    },
    enabled: !!user,
  });
}

export function useTag(id?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['tag', id],
    queryFn: async (): Promise<Tag | null> => {
      if (!id || !user) return null;

      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!id && !!user,
  });
}

export function useNoteTags(noteId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['note_tags', noteId],
    queryFn: async (): Promise<Tag[]> => {
      if (!noteId || !user) return [];

      const { data, error } = await supabase
        .from('note_tags')
        .select('tag:tags(*)')
        .eq('note_id', noteId);

      if (error) throw new Error(error.message);
      return (data?.map((item: any) => item.tag).filter(Boolean) as Tag[]) || [];
    },
    enabled: !!noteId && !!user,
  });
}

export function useCreateTag() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      name,
      color = '#6366f1',
    }: {
      name: string;
      color?: string;
    }): Promise<Tag> => {
      if (!user) throw new Error('Not authenticated');

      const trimmed = name.trim();
      if (!trimmed) throw new Error('Tag name cannot be empty');

      const { data, error } = await supabase
        .from('tags')
        .insert({
          owner_id: user.id,
          name: trimmed,
          color,
        })
        .select('*')
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error('A tag with this name already exists.');
        }
        throw new Error(error.message);
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
  });
}

export function useUpdateTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      name,
      color,
    }: {
      id: string;
      name?: string;
      color?: string;
    }): Promise<void> => {
      const updates: { name?: string; color?: string } = {};
      if (name !== undefined) {
        const trimmed = name.trim();
        if (!trimmed) throw new Error('Tag name cannot be empty');
        updates.name = trimmed;
      }
      if (color !== undefined) {
        updates.color = color;
      }

      const { error } = await supabase
        .from('tags')
        .update(updates)
        .eq('id', id);

      if (error) {
        if (error.code === '23505') {
          throw new Error('A tag with this name already exists.');
        }
        throw new Error(error.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
  });
}

export function useDeleteTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from('tags').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
  });
}

export function useAddTagToNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      noteId,
      tagId,
    }: {
      noteId: string;
      tagId: string;
    }): Promise<void> => {
      const { error } = await supabase
        .from('note_tags')
        .insert({
          note_id: noteId,
          tag_id: tagId,
        });

      if (error && error.code !== '23505') {
        throw new Error(error.message);
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['note_tags', variables.noteId] });
      queryClient.invalidateQueries({ queryKey: ['note', variables.noteId] });
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
  });
}

export function useRemoveTagFromNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      noteId,
      tagId,
    }: {
      noteId: string;
      tagId: string;
    }): Promise<void> => {
      const { error } = await supabase
        .from('note_tags')
        .delete()
        .eq('note_id', noteId)
        .eq('tag_id', tagId);

      if (error) throw new Error(error.message);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['note_tags', variables.noteId] });
      queryClient.invalidateQueries({ queryKey: ['note', variables.noteId] });
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
  });
}
