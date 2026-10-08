import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Clock, 
  Plus, 
  Edit3, 
  Trash2, 
  RotateCcw, 
  FolderInput, 
  Share2, 
  Image, 
  History, 
  ChevronLeft, 
  ChevronRight,
  FileText,
  Activity as ActivityIcon
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { useActivityLog, type ActivityLogItem } from '../hooks/useActivity';
import type { ActivityAction } from '../types/database';

function getActionConfig(action: ActivityAction) {
  switch (action) {
    case 'CREATE_NOTE':
      return {
        label: 'Created note',
        icon: Plus,
        color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800',
      };
    case 'EDIT_NOTE':
      return {
        label: 'Edited note',
        icon: Edit3,
        color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800',
      };
    case 'TRASH_NOTE':
      return {
        label: 'Moved note to trash',
        icon: Trash2,
        color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800',
      };
    case 'RESTORE_NOTE':
      return {
        label: 'Restored note',
        icon: RotateCcw,
        color: 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/50 border-teal-200 dark:border-teal-800',
      };
    case 'DELETE_NOTE':
      return {
        label: 'Permanently deleted note',
        icon: Trash2,
        color: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800',
      };
    case 'MOVE_NOTE':
      return {
        label: 'Moved note',
        icon: FolderInput,
        color: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/50 border-purple-200 dark:border-purple-800',
      };
    case 'SHARE_NOTE':
      return {
        label: 'Shared note',
        icon: Share2,
        color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800',
      };
    case 'ADD_ATTACHMENT':
      return {
        label: 'Uploaded attachment',
        icon: Image,
        color: 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/50 border-sky-200 dark:border-sky-800',
      };
    case 'RESTORE_VERSION':
      return {
        label: 'Restored version',
        icon: History,
        color: 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/50 border-violet-200 dark:border-violet-800',
      };
    default:
      return {
        label: 'Action performed',
        icon: ActivityIcon,
        color: 'text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700',
      };
  }
}

function getDetailsDescription(item: ActivityLogItem): string | null {
  const details = (item.details as Record<string, unknown>) || {};
  if (item.action === 'EDIT_NOTE' && details.version) {
    return `Saved version ${details.version}`;
  }
  if (item.action === 'RESTORE_VERSION' && details.version_no) {
    return `Rolled back to version ${details.version_no}`;
  }
  if (item.action === 'SHARE_NOTE' && details.role) {
    return `Assigned role: ${details.role}`;
  }
  if (item.action === 'ADD_ATTACHMENT' && details.file) {
    return `File: ${details.file}`;
  }
  return null;
}

function getDayHeader(dateStr: string): string {
  const d = new Date(dateStr);
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'EEEE, MMMM d, yyyy');
}

export function Activity() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const { data, isLoading } = useActivityLog(page, pageSize);
  const items = data?.items || [];
  const totalCount = data?.totalCount || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // Group items by day
  const groupedItems = useMemo(() => {
    const groups: { dateHeader: string; items: ActivityLogItem[] }[] = [];
    let currentHeader = '';
    let currentGroup: ActivityLogItem[] = [];

    items.forEach((item) => {
      const header = getDayHeader(item.created_at);
      if (header !== currentHeader) {
        if (currentGroup.length > 0) {
          groups.push({ dateHeader: currentHeader, items: currentGroup });
        }
        currentHeader = header;
        currentGroup = [item];
      } else {
        currentGroup.push(item);
      }
    });

    if (currentGroup.length > 0) {
      groups.push({ dateHeader: currentHeader, items: currentGroup });
    }

    return groups;
  }, [items]);

  return (
    <div className="h-full flex flex-col overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto w-full">
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-xs">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Activity History
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Audit log of note edits, versions, shares, and folder changes
            </p>
          </div>
        </div>

        {totalCount > 0 && (
          <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-800/60 px-2.5 py-1 rounded-full font-medium">
            {totalCount} {totalCount === 1 ? 'event' : 'events'}
          </span>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {isLoading ? (
          <div className="space-y-4 animate-pulse">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="h-16 bg-slate-100 dark:bg-slate-800/50 rounded-xl border border-slate-200/60 dark:border-slate-800"
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="my-auto py-16 text-center">
            <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 mx-auto flex items-center justify-center text-slate-400 mb-3">
              <ActivityIcon className="w-6 h-6 text-indigo-500" />
            </div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              No activity recorded yet
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
              Your actions like creating, editing, and sharing notes will automatically show up here.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedItems.map((group) => (
              <div key={group.dateHeader} className="space-y-2">
                <div className="sticky top-0 z-10 py-1 bg-slate-50/90 dark:bg-slate-950/90 backdrop-blur-xs">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {group.dateHeader}
                  </span>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800/60 shadow-xs overflow-hidden">
                  {group.items.map((item) => {
                    const config = getActionConfig(item.action);
                    const Icon = config.icon;
                    const detailsDesc = getDetailsDescription(item);
                    const noteTitle =
                      item.notes?.title ||
                      ((item.details as Record<string, unknown>)?.title as string) ||
                      (item.note_id ? 'Untitled Note' : null);

                    return (
                      <div
                        key={item.id}
                        className="p-3.5 flex items-start gap-3 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition"
                      >
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 ${config.color}`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-medium text-slate-900 dark:text-white">
                              {config.label}
                            </span>
                            <span className="text-[11px] text-slate-400 shrink-0">
                              {format(new Date(item.created_at), 'p')}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 mt-0.5">
                            {noteTitle && (
                              <button
                                type="button"
                                onClick={() => item.note_id && navigate(`/note/${item.note_id}`)}
                                disabled={!item.note_id || item.action === 'DELETE_NOTE'}
                                className={`text-xs flex items-center gap-1 truncate ${
                                  item.note_id && item.action !== 'DELETE_NOTE'
                                    ? 'text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer'
                                    : 'text-slate-600 dark:text-slate-300'
                                }`}
                              >
                                <FileText className="w-3 h-3 shrink-0" />
                                <span className="truncate">{noteTitle}</span>
                              </button>
                            )}

                            {detailsDesc && (
                              <span className="text-[11px] text-slate-400 truncate">
                                • {detailsDesc}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="pt-4 flex items-center justify-between border-t border-slate-200 dark:border-slate-800">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Page {page} of {totalPages}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 transition cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 transition cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Activity;
