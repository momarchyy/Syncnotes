import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { Database } from '../types/database';

export type Folder = Database['public']['Tables']['folders']['Row'];

export interface FolderTreeNode extends Folder {
  children: FolderTreeNode[];
}

export interface FolderPathItem {
  id: string;
  name: string;
  depth: number;
}

/**
 * Builds a hierarchical tree from a flat list of folders
 */
export function buildFolderTree(folders: Folder[]): FolderTreeNode[] {
  const map = new Map<string, FolderTreeNode>();
  const roots: FolderTreeNode[] = [];

  // Initialize node objects
  folders.forEach((f) => {
    map.set(f.id, { ...f, children: [] });
  });

  // Build hierarchy
  folders.forEach((f) => {
    const node = map.get(f.id)!;
    if (f.parent_id && map.has(f.parent_id)) {
      map.get(f.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  // Sort alphabetically by name
  const sortNodes = (nodes: FolderTreeNode[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name));
    nodes.forEach((n) => sortNodes(n.children));
  };
  sortNodes(roots);

  return roots;
}

export function useFolders() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['folders', user?.id],
    queryFn: async (): Promise<Folder[]> => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('folders')
        .select('*')
        .eq('owner_id', user.id)
        .order('name');

      if (error) throw new Error(error.message);
      return data || [];
    },
    enabled: !!user,
  });
}

export function useFolder(id?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['folder', id],
    queryFn: async (): Promise<Folder | null> => {
      if (!id || !user) return null;

      const { data, error } = await supabase
        .from('folders')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!id && !!user,
  });
}

export function useFolderPath(folderId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['folder_path', folderId],
    queryFn: async (): Promise<FolderPathItem[]> => {
      if (!folderId || !user) return [];

      const { data, error } = await supabase
        .rpc('get_folder_path', { p_folder_id: folderId });

      if (error) {
        console.error('Error fetching folder path:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!folderId && !!user,
  });
}

export function useCreateFolder() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      name,
      parentId,
    }: {
      name: string;
      parentId?: string | null;
    }): Promise<Folder> => {
      if (!user) throw new Error('Not authenticated');

      const trimmed = name.trim();
      if (!trimmed) throw new Error('Folder name cannot be empty');

      const { data, error } = await supabase
        .from('folders')
        .insert({
          owner_id: user.id,
          name: trimmed,
          parent_id: parentId ?? null,
        })
        .select('*')
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error('A folder with this name already exists here.');
        }
        throw new Error(error.message);
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
    },
  });
}

export function useUpdateFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      name,
      parentId,
    }: {
      id: string;
      name?: string;
      parentId?: string | null;
    }): Promise<void> => {
      const updates: { name?: string; parent_id?: string | null } = {};
      if (name !== undefined) {
        const trimmed = name.trim();
        if (!trimmed) throw new Error('Folder name cannot be empty');
        updates.name = trimmed;
      }
      if (parentId !== undefined) {
        updates.parent_id = parentId;
      }

      const { error } = await supabase
        .from('folders')
        .update(updates)
        .eq('id', id);

      if (error) {
        if (error.message?.includes('Folder cycle detected')) {
          throw new Error('Cannot move folder into its own subfolder.');
        }
        if (error.code === '23505') {
          throw new Error('A folder with this name already exists in the destination.');
        }
        throw new Error(error.message);
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      queryClient.invalidateQueries({ queryKey: ['folder', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['folder_path', variables.id] });
    },
  });
}

export function useDeleteFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from('folders').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
  });
}
