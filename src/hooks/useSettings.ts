import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Database } from '../types/database';

type UserSettings = Database['public']['Tables']['user_settings']['Row'];
type UserSettingsUpdate = Database['public']['Tables']['user_settings']['Update'];

export function useSettings() {
  const { user, profile, settings, refreshProfile } = useAuth();
  const queryClient = useQueryClient();

  const updateProfileMutation = useMutation({
    mutationFn: async (displayName: string) => {
      if (!user) throw new Error('Not authenticated');
      const trimmed = displayName.trim();
      if (!trimmed) throw new Error('Display name cannot be empty');

      const { data, error } = await supabase
        .from('profiles')
        .update({ display_name: trimmed })
        .eq('id', user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      await refreshProfile();
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (updates: UserSettingsUpdate) => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('user_settings')
        .update(updates)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      // Apply theme immediately if changed
      if (updates.theme) {
        const root = document.documentElement;
        if (updates.theme === 'dark') {
          root.classList.add('dark');
        } else if (updates.theme === 'light') {
          root.classList.remove('dark');
        } else {
          const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          if (systemDark) root.classList.add('dark');
          else root.classList.remove('dark');
        }
      }

      return data as UserSettings;
    },
    onSuccess: async () => {
      await refreshProfile();
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });

  return {
    user,
    profile,
    settings,
    updateProfile: updateProfileMutation,
    updateSettings: updateSettingsMutation,
  };
}
