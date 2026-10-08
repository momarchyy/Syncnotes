import { useAuth } from '../../hooks/useAuth';
import { LogOut } from 'lucide-react';

interface TopBarProps {
  onToggleSidebar?: () => void;
}

export function TopBar({ onToggleSidebar }: TopBarProps) {
  const { user, profile, signOut } = useAuth();

  const displayName = profile?.display_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';

  return (
    <header className="h-14 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm px-4 flex items-center justify-between sticky top-0 z-30 transition-colors">
      <div className="flex items-center gap-3">
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="md:hidden p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            aria-label="Toggle Navigation"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white font-bold flex items-center justify-center text-sm shadow-sm">
            SN
          </div>
          <span className="font-semibold text-slate-900 dark:text-white tracking-tight hidden sm:inline">
            SyncNotes
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* User Info Chip */}
        <div className="flex items-center gap-2 pl-2 pr-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full border border-slate-200/60 dark:border-slate-700/60 text-xs">
          <div className="w-6 h-6 rounded-full bg-indigo-500 text-white flex items-center justify-center font-medium uppercase text-[11px]">
            {displayName[0]}
          </div>
          <span className="font-medium text-slate-700 dark:text-slate-200 max-w-[120px] sm:max-w-[180px] truncate">
            {displayName}
          </span>
        </div>

        {/* Logout Button */}
        <button
          type="button"
          onClick={() => signOut()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition cursor-pointer"
          title="Sign Out"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
}

export default TopBar;
