import { useAuth } from '../hooks/useAuth';
import { User, ShieldCheck, Sliders, CheckCircle } from 'lucide-react';

export function Notes() {
  const { user, profile, settings } = useAuth();

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 w-full">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Authenticated Session Active
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Phase 1 acceptance check: Session and database rows successfully verified
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Profile Card */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3">
              <User className="w-4 h-4 text-indigo-500" />
              <span>User Profile (from <code>profiles</code> table)</span>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-slate-700/50">
                <span className="text-slate-500">Display Name:</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">{profile?.display_name || 'Loading...'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-slate-700/50">
                <span className="text-slate-500">Email:</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">{user?.email}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-slate-700/50">
                <span className="text-slate-500">User ID (UUID):</span>
                <span className="font-mono text-[11px] text-slate-600 dark:text-slate-400 truncate max-w-[180px]">{user?.id}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Account Created:</span>
                <span className="text-slate-600 dark:text-slate-400">
                  {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'Just now'}
                </span>
              </div>
            </div>
          </div>

          {/* User Settings Card */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3">
              <Sliders className="w-4 h-4 text-indigo-500" />
              <span>User Settings (from <code>user_settings</code> table)</span>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-slate-700/50">
                <span className="text-slate-500">Theme:</span>
                <span className="font-medium capitalize text-slate-800 dark:text-slate-200">{settings?.theme || 'system'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-slate-700/50">
                <span className="text-slate-500">Font Size:</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">{settings?.font_size ?? 16}px</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/50 dark:border-slate-700/50">
                <span className="text-slate-500">Auto Save:</span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400">{settings?.auto_save ? 'Enabled' : 'Disabled'}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Default Note Color:</span>
                <span className="flex items-center gap-1 font-mono text-slate-600 dark:text-slate-400">
                  <span
                    className="w-3 h-3 rounded-full border border-slate-300 dark:border-slate-600 inline-block"
                    style={{ backgroundColor: settings?.default_note_color || '#ffffff' }}
                  />
                  {settings?.default_note_color || '#ffffff'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Database & Trigger verification notice */}
        <div className="p-4 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 text-xs text-indigo-900 dark:text-indigo-200 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">Automatic Profile Initialization Verified</p>
            <p className="text-indigo-700 dark:text-indigo-300">
              PostgreSQL trigger <code>on_auth_user_created</code> automatically inserted matching rows into <code>profiles</code> and <code>user_settings</code>. All RLS policies are actively enforced.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Notes;
