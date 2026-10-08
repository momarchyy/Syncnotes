import { useState, useEffect, useRef, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import type { JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { 
  Pin, 
  Star, 
  Archive, 
  Trash2, 
  RotateCcw, 
  ArrowLeft, 
  Check, 
  Loader2,
  AlertTriangle,
  CloudOff
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Toolbar } from './Toolbar';
import { ConflictDialog } from './ConflictDialog';
import { 
  useNote, 
  useUpdateNote, 
  useTrashNote, 
  useRestoreNote, 
  useDeleteNotePermanently,
  useCreateNote,
  type Note
} from '../../hooks/useNotes';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/Toast';
import { Modal } from '../ui/Modal';
import type { Json } from '../../types/database';

export type SaveStatus = 'saved' | 'saving' | 'offline' | 'conflict';

interface NoteEditorProps {
  noteId: string;
  onClose?: () => void;
}

export function NoteEditor({ noteId, onClose }: NoteEditorProps) {
  const navigate = useNavigate();
  const { data: note, isLoading } = useNote(noteId);
  const updateNote = useUpdateNote();
  const trashNote = useTrashNote();
  const restoreNote = useRestoreNote();
  const deletePermanently = useDeleteNotePermanently();
  const createNote = useCreateNote();
  const { success, error } = useToast();

  const [title, setTitle] = useState('');
  const [currentVersion, setCurrentVersion] = useState<number>(1);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');

  // Conflict handling state
  const [conflictOpen, setConflictOpen] = useState(false);
  const [remoteNote, setRemoteNote] = useState<Note | null>(null);
  const [isResolvingConflict, setIsResolvingConflict] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initialContentSetRef = useRef(false);

  // Initialize Tiptap
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: 'Start typing your note...',
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'prose dark:prose-invert max-w-none focus:outline-none min-h-[350px] p-4 text-slate-800 dark:text-slate-200 text-sm leading-relaxed',
      },
    },
    onUpdate: ({ editor }) => {
      triggerSave(title, editor.getJSON() as Json, editor.getText());
    },
  });

  // Sync state when note data loads
  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setCurrentVersion(note.version);
      if (editor && !initialContentSetRef.current) {
        if (note.content && typeof note.content === 'object' && Object.keys(note.content).length > 0) {
          editor.commands.setContent(note.content as JSONContent);
        } else {
          editor.commands.setContent('');
        }
        initialContentSetRef.current = true;
      }
    }
  }, [note, editor]);

  // Reset content ref when switching notes
  useEffect(() => {
    initialContentSetRef.current = false;
    setConflictOpen(false);
    setRemoteNote(null);
    setSaveStatus('saved');
  }, [noteId]);

  // Online / offline listeners
  useEffect(() => {
    const handleOnline = () => {
      if (saveStatus === 'offline') triggerSave(title);
    };
    const handleOffline = () => setSaveStatus('offline');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [saveStatus, title]);

  // Fetch the latest remote version when a conflict occurs
  const handleConflictDetected = async () => {
    setSaveStatus('conflict');
    try {
      const { data: latest } = await supabase
        .from('notes')
        .select('*')
        .eq('id', noteId)
        .single();

      if (latest) {
        setRemoteNote(latest);
        setConflictOpen(true);
      }
    } catch (err) {
      console.error('Error fetching latest note for conflict resolution:', err);
    }
  };

  // Debounced save using save_note RPC (Section 7.3: 1500 ms)
  const triggerSave = useCallback(
    (newTitle: string, newContent?: Json, newContentText?: string) => {
      if (!navigator.onLine) {
        setSaveStatus('offline');
        return;
      }

      setSaveStatus('saving');
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

      saveTimeoutRef.current = setTimeout(async () => {
        try {
          const contentToSave = newContent ?? (editor ? (editor.getJSON() as Json) : note?.content ?? {});
          const textToSave = newContentText ?? (editor ? editor.getText() : note?.content_text ?? '');

          const { data: savedNote, error: rpcError } = await supabase.rpc('save_note', {
            p_note_id: noteId,
            p_expected_version: currentVersion,
            p_title: newTitle.trim() || 'Untitled',
            p_content: contentToSave,
            p_content_text: textToSave,
          });

          if (rpcError) {
            // Check for Postgres SQLSTATE 40001 (VERSION_CONFLICT)
            if (rpcError.code === '40001' || rpcError.message?.includes('VERSION_CONFLICT')) {
              await handleConflictDetected();
              return;
            }
            throw new Error(rpcError.message);
          }

          if (savedNote) {
            setCurrentVersion(savedNote.version);
            setSaveStatus('saved');
          }
        } catch (err) {
          if (!navigator.onLine) {
            setSaveStatus('offline');
          } else {
            error((err as Error).message || 'Failed to save note');
            setSaveStatus('saved');
          }
        }
      }, 1500);
    },
    [noteId, currentVersion, editor, note, error]
  );

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    triggerSave(newTitle);
  };

  // Conflict Resolution: Keep Mine (Overwrite remote note with local version)
  const handleResolveKeepMine = async () => {
    if (!remoteNote) return;
    setIsResolvingConflict(true);
    try {
      const contentToSave = editor ? (editor.getJSON() as Json) : {};
      const textToSave = editor ? editor.getText() : '';

      const { data: savedNote, error: rpcError } = await supabase.rpc('save_note', {
        p_note_id: noteId,
        p_expected_version: remoteNote.version,
        p_title: title.trim() || 'Untitled',
        p_content: contentToSave,
        p_content_text: textToSave,
      });

      if (rpcError) throw new Error(rpcError.message);

      if (savedNote) {
        setCurrentVersion(savedNote.version);
        setSaveStatus('saved');
        setConflictOpen(false);
        success('Resolved: Your version was saved.');
      }
    } catch (err) {
      error((err as Error).message || 'Failed to overwrite note');
    } finally {
      setIsResolvingConflict(false);
    }
  };

  // Conflict Resolution: Take Theirs (Discard local changes and load database version)
  const handleResolveTakeTheirs = () => {
    if (!remoteNote) return;
    setTitle(remoteNote.title);
    setCurrentVersion(remoteNote.version);

    if (editor) {
      if (remoteNote.content && typeof remoteNote.content === 'object' && Object.keys(remoteNote.content).length > 0) {
        editor.commands.setContent(remoteNote.content as JSONContent);
      } else {
        editor.commands.setContent('');
      }
    }

    setSaveStatus('saved');
    setConflictOpen(false);
    success('Resolved: Loaded latest version from database.');
  };

  // Conflict Resolution: Copy Mine to a New Note
  const handleResolveCopyMine = async () => {
    setIsResolvingConflict(true);
    try {
      const contentToSave = editor ? (editor.getJSON() as Json) : {};
      const textToSave = editor ? editor.getText() : '';

      const newNote = await createNote.mutateAsync({
        title: `${title || 'Untitled'} (My Version)`,
      });

      // Save our local content into the new note
      await supabase.from('notes').update({
        content: contentToSave,
        content_text: textToSave,
      }).eq('id', newNote.id);

      setConflictOpen(false);
      success('Created a new note with your version.');
      navigate(`/note/${newNote.id}`);
    } catch (err) {
      error((err as Error).message || 'Failed to copy note');
    } finally {
      setIsResolvingConflict(false);
    }
  };

  const handleTogglePin = async () => {
    if (!note) return;
    try {
      await updateNote.mutateAsync({ id: note.id, is_pinned: !note.is_pinned });
      success(note.is_pinned ? 'Note unpinned' : 'Note pinned');
    } catch (err) {
      error((err as Error).message);
    }
  };

  const handleToggleFavorite = async () => {
    if (!note) return;
    try {
      await updateNote.mutateAsync({ id: note.id, is_favorite: !note.is_favorite });
      success(note.is_favorite ? 'Removed from favorites' : 'Added to favorites');
    } catch (err) {
      error((err as Error).message);
    }
  };

  const handleToggleArchive = async () => {
    if (!note) return;
    try {
      await updateNote.mutateAsync({ id: note.id, is_archived: !note.is_archived });
      success(note.is_archived ? 'Note unarchived' : 'Note archived');
      if (onClose) onClose();
    } catch (err) {
      error((err as Error).message);
    }
  };

  const handleTrash = async () => {
    if (!note) return;
    try {
      await trashNote.mutateAsync(note.id);
      success('Note moved to trash');
      if (onClose) onClose();
    } catch (err) {
      error((err as Error).message);
    }
  };

  const handleRestore = async () => {
    if (!note) return;
    try {
      await restoreNote.mutateAsync(note.id);
      success('Note restored from trash');
    } catch (err) {
      error((err as Error).message);
    }
  };

  const handleDeletePermanently = async () => {
    if (!note) return;
    try {
      await deletePermanently.mutateAsync(note.id);
      success('Note permanently deleted');
      setConfirmDeleteOpen(false);
      if (onClose) onClose();
    } catch (err) {
      error((err as Error).message);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center p-8 bg-white dark:bg-slate-900">
        <div className="flex flex-col items-center gap-2 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
          <span className="text-xs">Loading note...</span>
        </div>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="h-full flex items-center justify-center p-8 bg-white dark:bg-slate-900">
        <div className="text-center">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Note not found or deleted.</p>
          {onClose && (
            <button
              onClick={onClose}
              className="mt-4 px-3 py-1.5 text-xs bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 transition"
            >
              Back to notes
            </button>
          )}
        </div>
      </div>
    );
  }

  const isDeleted = !!note.deleted_at;

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900 transition-colors">
      {/* Editor Header Bar */}
      <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2">
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}

          {/* Save Status Chip (Section 7.3: Saving / Saved / Offline / Conflict) */}
          <div>
            {saveStatus === 'saving' && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 text-xs font-medium border border-indigo-200/50 dark:border-indigo-800/50">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Saving…</span>
              </div>
            )}
            {saveStatus === 'saved' && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 text-xs font-medium border border-emerald-200/50 dark:border-emerald-800/50">
                <Check className="w-3.5 h-3.5" />
                <span>Saved (v{currentVersion})</span>
              </div>
            )}
            {saveStatus === 'offline' && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-medium border border-slate-200 dark:border-slate-700">
                <CloudOff className="w-3.5 h-3.5" />
                <span>Offline</span>
              </div>
            )}
            {saveStatus === 'conflict' && (
              <button
                type="button"
                onClick={() => setConflictOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 hover:bg-red-100 text-xs font-semibold border border-red-300 dark:border-red-800 transition animate-pulse cursor-pointer"
                title="Click to resolve conflict"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Conflict (Resolve)</span>
              </button>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1">
          {isDeleted ? (
            <>
              <button
                type="button"
                onClick={handleRestore}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition"
                title="Restore note"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Restore</span>
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeleteOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition"
                title="Delete permanently"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete forever</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleTogglePin}
                title={note.is_pinned ? 'Unpin note' : 'Pin note'}
                className={`p-1.5 rounded-lg transition ${
                  note.is_pinned
                    ? 'text-amber-500 bg-amber-50 dark:bg-amber-950/40'
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Pin className={`w-4 h-4 ${note.is_pinned ? 'fill-current' : ''}`} />
              </button>

              <button
                type="button"
                onClick={handleToggleFavorite}
                title={note.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
                className={`p-1.5 rounded-lg transition ${
                  note.is_favorite
                    ? 'text-rose-500 bg-rose-50 dark:bg-rose-950/40'
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Star className={`w-4 h-4 ${note.is_favorite ? 'fill-current' : ''}`} />
              </button>

              <button
                type="button"
                onClick={handleToggleArchive}
                title={note.is_archived ? 'Unarchive note' : 'Archive note'}
                className={`p-1.5 rounded-lg transition ${
                  note.is_archived
                    ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40'
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Archive className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleTrash}
                title="Move to trash"
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Title Input */}
      <div className="px-6 pt-4 pb-2">
        <input
          type="text"
          value={title}
          onChange={handleTitleChange}
          placeholder="Untitled Note"
          disabled={isDeleted}
          className="w-full text-2xl font-bold bg-transparent text-slate-900 dark:text-white placeholder-slate-300 dark:placeholder-slate-600 focus:outline-none tracking-tight disabled:opacity-75"
        />
      </div>

      {/* Tiptap Toolbar */}
      {!isDeleted && <Toolbar editor={editor} />}

      {/* Tiptap Document Body */}
      <div className="flex-1 overflow-y-auto px-2">
        <EditorContent editor={editor} />
      </div>

      {/* Conflict Resolution Dialog */}
      <ConflictDialog
        isOpen={conflictOpen}
        onClose={() => setConflictOpen(false)}
        localTitle={title}
        localContentText={editor ? editor.getText() : ''}
        remoteNote={remoteNote}
        onKeepMine={handleResolveKeepMine}
        onTakeTheirs={handleResolveTakeTheirs}
        onCopyMine={handleResolveCopyMine}
        isResolving={isResolvingConflict}
      />

      {/* Confirmation Modal for Permanent Delete */}
      <Modal
        isOpen={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        title="Delete note permanently?"
      >
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
          This note will be permanently erased from your database. This action cannot be undone.
        </p>
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => setConfirmDeleteOpen(false)}
            className="px-4 py-2 text-sm font-medium rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDeletePermanently}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 hover:bg-red-700 text-white transition shadow-sm"
          >
            Delete Permanently
          </button>
        </div>
      </Modal>
    </div>
  );
}

export default NoteEditor;
