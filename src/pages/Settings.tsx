import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, 
  User, 
  Moon, 
  Sun, 
  Monitor, 
  Type, 
  Check, 
  Shield, 
  Mail, 
  Calendar,
  Loader2
} from 'lucide-react';
import { useSettings } from '../hooks/useSettings';
import { useToast } from '../components/ui/Toast';
import { format } from 'date-fns';

export function Settings() {
  const { user, profile, settings, updateProfile, updateSettings } = useSettings();
  const { success, error } = useToast();

  const [displayName, setDisplayName] = useState('');
  const [selectedTheme, setSelectedTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [fontSize, setFontSize] = useState<number>(16);
  const [autoSave, setAutoSave] = useState<boolean>(true);

  // Sync state with loaded profile & settings
  useEffect(() => {
    if (profile?.display_name) {
      setDisplayName(profile.display_name);
    }
  }, [profile]);

  useEffect(() => {
    if (settings) {
      setSelectedTheme(settings.theme);
      setFontSize(settings.font_size);
      setAutoSave(settings.auto_save);
    }
  }, [settings]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      error('Display name cannot be empty');
      return;
    }

    try {
      await updateProfile.mutateAsync(displayName.trim());
      success('Profile updated');
    } catch (err) {
      error((err as Error).message || 'Failed to update profile');
    }
  };

  const handleThemeChange = async (theme: 'light' | 'dark' | 'system') => {
    setSelectedTheme(theme);
    try {
      await updateSettings.mutateAsync({ theme });
      success(`Theme set to ${theme}`);
    } catch (err) {
      error((err as Error).message || 'Failed to update theme');
    }
  };

  const handleFontSizeChange = async (size: number) => {
    setFontSize(size);
    try {
      await updateSettings.mutateAsync({ font_size: size });
      success(`Editor font size set to ${size}px`);
    } catch (err) {
      error((err as Error).message || 'Failed to update font size');
    }
  };

  const handleAutoSaveToggle = async () => {
    const nextVal = !autoSave;
    setAutoSave(nextVal);
    try {
      await updateSettings.mutateAsync({ auto_save: nextVal });
      success(nextVal ? 'Auto-save enabled' : 'Auto-save disabled');
    } catch (err) {
      error((err as Error).message || 'Failed to update auto-save setting');
    }
  };

  return (
    <div className="h-full flex flex-col overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-xs">
          <SettingsIcon className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Settings
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Manage your account profile, appearance, and editor preferences
          </p>
        </div>
      </div>

      {/* Profile Section */}
      <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
          <User className="w-4 h-4 text-indigo-500" />
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Profile Information
          </h2>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Display Name
            </label>
            <div className="flex items-center gap-2 max-w-md">
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name or handle"
                className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
              />
              <button
                type="submit"
                disabled={updateProfile.isPending || displayName.trim() === profile?.display_name}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-medium shadow-xs transition flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                {updateProfile.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>Save</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Appearance Section */}
      <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
          <Sun className="w-4 h-4 text-indigo-500" />
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Theme & Appearance
          </h2>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
            Color Theme
          </label>
          <div className="grid grid-cols-3 gap-3 max-w-md">
            <button
              type="button"
              onClick={() => handleThemeChange('light')}
              className={`p-3 rounded-xl border flex flex-col items-center gap-2 text-xs font-medium transition cursor-pointer ${
                selectedTheme === 'light'
                  ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 ring-2 ring-indigo-500/20'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Sun className="w-5 h-5 text-amber-500" />
              <span>Light</span>
            </button>

            <button
              type="button"
              onClick={() => handleThemeChange('dark')}
              className={`p-3 rounded-xl border flex flex-col items-center gap-2 text-xs font-medium transition cursor-pointer ${
                selectedTheme === 'dark'
                  ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 ring-2 ring-indigo-500/20'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Moon className="w-5 h-5 text-indigo-400" />
              <span>Dark</span>
            </button>

            <button
              type="button"
              onClick={() => handleThemeChange('system')}
              className={`p-3 rounded-xl border flex flex-col items-center gap-2 text-xs font-medium transition cursor-pointer ${
                selectedTheme === 'system'
                  ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 ring-2 ring-indigo-500/20'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Monitor className="w-5 h-5 text-slate-500" />
              <span>System</span>
            </button>
          </div>
        </div>
      </div>

      {/* Editor Preferences */}
      <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
          <Type className="w-4 h-4 text-indigo-500" />
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Editor Preferences
          </h2>
        </div>

        {/* Font Size */}
        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
            Base Font Size
          </label>
          <div className="flex items-center gap-2 max-w-sm">
            {[14, 16, 18].map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => handleFontSizeChange(size)}
                className={`flex-1 py-2 px-3 rounded-xl border text-xs font-medium transition cursor-pointer ${
                  fontSize === size
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {size}px {size === 14 ? '(Small)' : size === 16 ? '(Medium)' : '(Large)'}
              </button>
            ))}
          </div>
        </div>

        {/* Auto Save Toggle */}
        <div className="flex items-center justify-between pt-2">
          <div>
            <span className="text-xs font-semibold text-slate-900 dark:text-white block">
              Automatic Saving
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Automatically persists note changes to the database after 1.5s of inactivity
            </span>
          </div>

          <button
            type="button"
            onClick={handleAutoSaveToggle}
            className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
              autoSave ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                autoSave ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Account Info */}
      <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
          <Shield className="w-4 h-4 text-indigo-500" />
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Account Details
          </h2>
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-slate-400" /> Email:
            </span>
            <span className="font-mono text-slate-800 dark:text-slate-200">{user?.email}</span>
          </div>

          <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" /> Member since:
            </span>
            <span className="text-slate-800 dark:text-slate-200">
              {user?.created_at ? format(new Date(user.created_at), 'PPP') : 'N/A'}
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
            <span>User ID:</span>
            <span className="font-mono text-[11px] text-slate-500 truncate max-w-[200px] sm:max-w-none">
              {user?.id}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Settings;
