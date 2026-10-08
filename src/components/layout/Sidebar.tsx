import { NavLink, useNavigate } from 'react-router-dom';
import { 
  FileText, 
  Star, 
  Users, 
  Archive, 
  Trash2, 
  BarChart2, 
  Clock, 
  Settings, 
  Plus, 
  Folder
} from 'lucide-react';
import { useCreateNote } from '../../hooks/useNotes';
import { useToast } from '../ui/Toast';

interface SidebarProps {
  onCloseMobile?: () => void;
}

export function Sidebar({ onCloseMobile }: SidebarProps) {
  const navigate = useNavigate();
  const createNote = useCreateNote();
  const { error } = useToast();

  const handleCreateNote = async () => {
    try {
      const newNote = await createNote.mutateAsync({ title: 'Untitled' });
      navigate(`/note/${newNote.id}`);
      if (onCloseMobile) onCloseMobile();
    } catch (err) {
      error((err as Error).message || 'Failed to create note');
    }
  };

  const navItems = [
    { label: 'All Notes', to: '/', icon: FileText },
    { label: 'Favorites', to: '/favorites', icon: Star },
    { label: 'Shared with me', to: '/shared', icon: Users },
    { label: 'Archive', to: '/archive', icon: Archive },
    { label: 'Trash', to: '/trash', icon: Trash2 },
  ];

  const secondaryItems = [
    { label: 'Analytics', to: '/analytics', icon: BarChart2 },
    { label: 'Activity', to: '/activity', icon: Clock },
    { label: 'Settings', to: '/settings', icon: Settings },
  ];

  return (
    <aside className="w-64 h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-colors">
      {/* New Note Button */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-800/80">
        <button
          onClick={handleCreateNote}
          disabled={createNote.isPending}
          className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-medium text-sm rounded-xl shadow-sm shadow-indigo-500/20 transition flex items-center justify-center gap-2 cursor-pointer"
        >
          {createNote.isPending ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Plus className="w-4 h-4" />
              <span>New Note</span>
            </>
          )}
        </button>
      </div>

      {/* Primary Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        <div>
          <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Notes
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={onCloseMobile}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      isActive
                        ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Folders preview section (full tree in Phase 5) */}
        <div>
          <div className="flex items-center justify-between px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            <span>Folders</span>
          </div>
          <div className="px-3 py-2 text-xs text-slate-400 dark:text-slate-500 flex items-center gap-2">
            <Folder className="w-3.5 h-3.5 text-slate-400" />
            <span>Folder tree active in Phase 5</span>
          </div>
        </div>

        {/* Secondary Navigation */}
        <div>
          <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Workspace
          </div>
          <nav className="space-y-1">
            {secondaryItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onCloseMobile}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      isActive
                        ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
