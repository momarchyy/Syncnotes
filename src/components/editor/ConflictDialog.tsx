import { Modal } from '../ui/Modal';
import { AlertTriangle, Copy, ArrowDownToLine, ArrowUpToLine } from 'lucide-react';
import type { Note } from '../../hooks/useNotes';

interface ConflictDialogProps {
  isOpen: boolean;
  onClose: () => void;
  localTitle: string;
  localContentText: string;
  remoteNote: Note | null;
  onKeepMine: () => void;
  onTakeTheirs: () => void;
  onCopyMine: () => void;
  isResolving?: boolean;
}

export function ConflictDialog({
  isOpen,
  onClose,
  localTitle,
  localContentText,
  remoteNote,
  onKeepMine,
  onTakeTheirs,
  onCopyMine,
  isResolving = false,
}: ConflictDialogProps) {
  if (!remoteNote) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Conflict Detected (Version Conflict)"
      maxWidth="max-w-xl"
    >
      <div className="space-y-4">
        {/* Warning Banner */}
        <div className="flex items-start gap-3 p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl text-xs text-amber-800 dark:text-amber-200">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-900 dark:text-amber-100">
              This note was updated in another tab or device.
            </p>
            <p className="mt-0.5 text-amber-700 dark:text-amber-300">
              Database error <code>40001 (VERSION_CONFLICT)</code> prevented your changes from silently overwriting the other version. Please choose how to resolve:
            </p>
          </div>
        </div>

        {/* Diff Previews */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {/* Your Local Version */}
          <div className="p-3 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/30">
            <div className="font-semibold text-indigo-700 dark:text-indigo-300 mb-1 flex items-center justify-between">
              <span>Your Version (Local)</span>
              <span className="text-[10px] px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 rounded">
                Unsaved
              </span>
            </div>
            <p className="font-medium text-slate-800 dark:text-slate-200 truncate mb-1">
              {localTitle || 'Untitled'}
            </p>
            <p className="text-slate-600 dark:text-slate-400 line-clamp-4 font-mono text-[11px] bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200/60 dark:border-slate-800">
              {localContentText.trim() || '(Empty note)'}
            </p>
          </div>

          {/* Database Version */}
          <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
            <div className="font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
              <span>Remote Version (Database)</span>
              <span className="text-[10px] px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded">
                v{remoteNote.version}
              </span>
            </div>
            <p className="font-medium text-slate-800 dark:text-slate-200 truncate mb-1">
              {remoteNote.title || 'Untitled'}
            </p>
            <p className="text-slate-600 dark:text-slate-400 line-clamp-4 font-mono text-[11px] bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200/60 dark:border-slate-800">
              {remoteNote.content_text?.trim() || '(Empty note)'}
            </p>
          </div>
        </div>

        {/* Resolution Options */}
        <div className="pt-2 space-y-2">
          {/* Option 1: Keep Mine */}
          <button
            type="button"
            onClick={onKeepMine}
            disabled={isResolving}
            className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-600 bg-white dark:bg-slate-900 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 text-left transition flex items-start gap-3 group cursor-pointer"
          >
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition">
              <ArrowUpToLine className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-white">
                Keep Mine (Overwrite)
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Overwrite the database with your local edits against version {remoteNote.version}.
              </div>
            </div>
          </button>

          {/* Option 2: Take Theirs */}
          <button
            type="button"
            onClick={onTakeTheirs}
            disabled={isResolving}
            className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-amber-400 dark:hover:border-amber-600 bg-white dark:bg-slate-900 hover:bg-amber-50/50 dark:hover:bg-amber-950/20 text-left transition flex items-start gap-3 group cursor-pointer"
          >
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 group-hover:bg-amber-600 group-hover:text-white transition">
              <ArrowDownToLine className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-white">
                Take Theirs (Discard Mine)
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Discard your local unsaved changes and load the latest version from the database.
              </div>
            </div>
          </button>

          {/* Option 3: Copy Mine to a New Note */}
          <button
            type="button"
            onClick={onCopyMine}
            disabled={isResolving}
            className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-400 dark:hover:border-emerald-600 bg-white dark:bg-slate-900 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 text-left transition flex items-start gap-3 group cursor-pointer"
          >
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white transition">
              <Copy className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-white">
                Copy Mine to a New Note
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Keep the database note as-is, and create a brand new note containing your local edits.
              </div>
            </div>
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default ConflictDialog;
