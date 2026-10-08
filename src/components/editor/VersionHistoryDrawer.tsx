import { useState } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { useNoteVersions, useRestoreVersion, type NoteVersion } from '../../hooks/useVersions';
import { 
  History, 
  RotateCcw, 
  X, 
  Clock, 
  User, 
  FileText, 
  Loader2,
  AlertCircle
} from 'lucide-react';
import { useToast } from '../ui/Toast';

interface VersionHistoryDrawerProps {
  noteId: string;
  isOpen: boolean;
  onClose: () => void;
  currentVersionNo?: number;
  onVersionRestored?: (restoredVersionNo: number) => void;
}

export function VersionHistoryDrawer({
  noteId,
  isOpen,
  onClose,
  onVersionRestored,
}: VersionHistoryDrawerProps) {
  const { data: versions = [], isLoading, error } = useNoteVersions(noteId);
  const restoreVersionMutation = useRestoreVersion();
  const { success, error: toastError } = useToast();

  const [selectedVersion, setSelectedVersion] = useState<NoteVersion | null>(null);

  if (!isOpen) return null;

  const handleRestore = async (versionNo: number) => {
    try {
      const restored = await restoreVersionMutation.mutateAsync({
        noteId,
        versionNo,
      });
      success(`Version ${versionNo} restored`);
      if (onVersionRestored && restored) {
        onVersionRestored(restored.version);
      }
      onClose();
    } catch (err) {
      toastError((err as Error).message || 'Failed to restore version');
    }
  };

  const activePreview = selectedVersion || versions[0] || null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end animate-in fade-in">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 h-full shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white leading-tight">
                Version History
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Snapshots captured every 1 minute of active editing
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body: Master / Detail (List on Left, Preview on Right) */}
        <div className="flex-1 flex overflow-hidden">
          {/* Versions List */}
          <div className="w-64 sm:w-72 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
            <div className="p-3 border-b border-slate-100 dark:border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {versions.length} Snapshots
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {isLoading && (
                <div className="flex flex-col items-center justify-center p-8 text-slate-400 text-xs gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
                  <span>Loading history...</span>
                </div>
              )}

              {error && (
                <div className="p-4 text-xs text-rose-500 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Failed to load versions</span>
                </div>
              )}

              {!isLoading && versions.length === 0 && (
                <div className="p-6 text-center text-xs text-slate-400 italic">
                  No previous snapshots yet. Snapshots are recorded when editing continues past 1 minute.
                </div>
              )}

              {versions.map((ver) => {
                const isSelected = activePreview?.version_no === ver.version_no;
                const author = (ver as any).profiles?.display_name || 'You';

                return (
                  <button
                    key={ver.version_no}
                    type="button"
                    onClick={() => setSelectedVersion(ver as unknown as NoteVersion)}
                    className={`w-full text-left p-2.5 rounded-xl border transition cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800 shadow-xs'
                        : 'bg-white dark:bg-slate-800/60 border-slate-200/70 dark:border-slate-700/60 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                        <span>Version {ver.version_no}</span>
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {formatDistanceToNow(new Date(ver.created_at), { addSuffix: true })}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {ver.title || 'Untitled'}
                    </div>

                    <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-400">
                      <User className="w-2.5 h-2.5" />
                      <span>{author}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Version Preview Pane */}
          <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 overflow-hidden">
            {activePreview ? (
              <>
                {/* Preview Topbar with Restore Action */}
                <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/40">
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <Clock className="w-3.5 h-3.5 text-indigo-500" />
                    <span>
                      Snapshot from {format(new Date(activePreview.created_at), 'MMM d, yyyy h:mm a')}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRestore(activePreview.version_no)}
                    disabled={restoreVersionMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-xs transition cursor-pointer disabled:opacity-50"
                  >
                    {restoreVersionMutation.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="w-3.5 h-3.5" />
                    )}
                    <span>Restore this version</span>
                  </button>
                </div>

                {/* Preview Document View */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                      Title
                    </span>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                      {activePreview.title || 'Untitled'}
                    </h3>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                      Plain Text Preview
                    </span>
                    <div className="mt-2 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/70 dark:border-slate-700/60 text-xs leading-relaxed text-slate-700 dark:text-slate-300 font-mono whitespace-pre-wrap max-h-[380px] overflow-y-auto">
                      {activePreview.content_text || '(No text content in this snapshot)'}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 text-xs">
                <FileText className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2" />
                <p>Select a snapshot from the list to preview</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
