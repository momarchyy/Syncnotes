import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  AlertCircle,
  X,
  CloudOff,
  Folder,
  Plus,
  ChevronDown,
  Edit3,
  BookOpen,
  Highlighter,
} from 'lucide-react';
import { NoteAnnotationLayer } from './NoteAnnotationLayer';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Toolbar } from './Toolbar';
import { ConflictDialog } from './ConflictDialog';
import { 
  useNote, 
  useUpdateNote, 
  useTrashNote, 
  useRestoreNote, 
  useDeleteNotePermanently,
  useCreateNote,
  useSetNoteFolder,
  type Note
} from '../../hooks/useNotes';
import { useFolders } from '../../hooks/useFolders';
import { 
  useTags, 
  useNoteTags, 
  useAddTagToNote, 
  useRemoveTagFromNote 
} from '../../hooks/useTags';
import { useAuth } from '../../contexts/AuthContext';
import { StorageImageNode } from './StorageImageNode';
import { DrawingNode } from './DrawingNode';
import { uploadNoteImage } from '../../lib/imageUpload';
import { ImageCropModal } from './ImageCropModal';
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
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: note, isLoading } = useNote(noteId);
  const updateNote = useUpdateNote();
  const trashNote = useTrashNote();
  const restoreNote = useRestoreNote();
  const deletePermanently = useDeleteNotePermanently();
  const createNote = useCreateNote();
  const setNoteFolder = useSetNoteFolder();
  const { data: allFolders = [] } = useFolders();
  const { data: allTags = [] } = useTags();
  const { data: noteTags = [] } = useNoteTags(noteId);
  const addTagToNote = useAddTagToNote();
  const removeTagFromNote = useRemoveTagFromNote();
  const { success, error } = useToast();

  const [title, setTitle] = useState('');
  const [currentVersion, setCurrentVersion] = useState<number>(1);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [isEditing, setIsEditing] = useState(false); // Read mode by default
  const [isAnnotating, setIsAnnotating] = useState(false); // Annotation mode
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isAddingDrawing, setIsAddingDrawing] = useState(false);
  const [pendingCropFile, setPendingCropFile] = useState<File | null>(null);

  // Folder & Tag dropdown open states
  const [folderDropdownOpen, setFolderDropdownOpen] = useState(false);
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);

  const availableTags = useMemo(() => {
    const existingTagIds = new Set(noteTags.map((t) => t.id));
    return allTags.filter((t) => !existingTagIds.has(t.id));
  }, [allTags, noteTags]);

  const currentFolder = useMemo(() => {
    if (!note?.folder_id) return null;
    return allFolders.find((f) => f.id === note.folder_id) || null;
  }, [note?.folder_id, allFolders]);

  // Refs to prevent stale closures in callbacks and debounce handlers
  const noteContainerRef = useRef<HTMLDivElement>(null);
  const versionRef = useRef<number>(1);
  const titleRef = useRef<string>('');
  const isDirtyRef = useRef(false);
  const saveStatusRef = useRef<SaveStatus>('saved');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initialContentSetRef = useRef(false);

  // Conflict handling state
  const [conflictOpen, setConflictOpen] = useState(false);
  const [remoteNote, setRemoteNote] = useState<Note | null>(null);
  const [isResolvingConflict, setIsResolvingConflict] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  // Remote update banner state (Section 7.3: Realtime "changed elsewhere" banner)
  const [incomingRemoteNote, setIncomingRemoteNote] = useState<Note | null>(null);
  const [showRemoteBanner, setShowRemoteBanner] = useState(false);

  // Keep refs in sync with state
  useEffect(() => {
    versionRef.current = currentVersion;
  }, [currentVersion]);

  useEffect(() => {
    titleRef.current = title;
  }, [title]);

  useEffect(() => {
    saveStatusRef.current = saveStatus;
  }, [saveStatus]);

  // Fetch the latest remote version when a conflict occurs
  const handleConflictDetected = useCallback(async () => {
    setSaveStatus('conflict');
    try {
      const { data: latest } = await supabase
        .from('notes')
        .select('*')
        .eq('id', noteId)
        .single();

      if (latest) {
        setRemoteNote(latest);
      } else {
        setRemoteNote({
          id: noteId,
          owner_id: '',
          title: 'Remote Note',
          content: {},
          content_text: '',
          version: (note?.version ?? versionRef.current) + 1,
          is_pinned: false,
          is_favorite: false,
          is_archived: false,
          folder_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          deleted_at: null,
          search_vector: null,
        });
      }
      setConflictOpen(true);
    } catch (err) {
      console.error('Error fetching latest note for conflict resolution:', err);
      setConflictOpen(true);
    }
  }, [noteId, note]);

  const editorRef = useRef<any>(null);

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
          const contentToSave = newContent ?? (editorRef.current ? (editorRef.current.getJSON() as Json) : note?.content ?? {});
          const textToSave = newContentText ?? (editorRef.current ? editorRef.current.getText() : note?.content_text ?? '');
          const expectedVer = versionRef.current;

          const { data: savedNote, error: rpcError } = await supabase.rpc('save_note', {
            p_note_id: noteId,
            p_expected_version: expectedVer,
            p_title: newTitle.trim() || 'Untitled',
            p_content: contentToSave,
            p_content_text: textToSave,
          });

          if (rpcError) {
            // Check for Postgres SQLSTATE 40001 / P0001 / VERSION_CONFLICT
            if (
              rpcError.code === '40001' || 
              rpcError.code === 'P0001' ||
              rpcError.message?.includes('VERSION_CONFLICT') ||
              rpcError.details?.includes('VERSION_CONFLICT')
            ) {
              await handleConflictDetected();
              return;
            }
            throw new Error(rpcError.message);
          }

          if (savedNote) {
            versionRef.current = savedNote.version;
            setCurrentVersion(savedNote.version);
            isDirtyRef.current = false;
            saveTimeoutRef.current = null;
            setSaveStatus('saved');
            queryClient.setQueryData(['note', noteId], savedNote);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [noteId, note, handleConflictDetected, error, queryClient]
  );

  const triggerSaveRef = useRef(triggerSave);
  useEffect(() => {
    triggerSaveRef.current = triggerSave;
  }, [triggerSave]);

  // Perform actual upload after optional cropping/editing
  const performImageUpload = useCallback(
    async (file: File) => {
      const ownerId = note?.owner_id || user?.id;
      if (!ownerId) {
        error('Cannot upload image: missing user or note owner');
        return;
      }

      setIsUploadingImage(true);
      try {
        const uploadResult = await uploadNoteImage({
          file,
          noteId,
          ownerId,
        });

        if (editorRef.current) {
          editorRef.current
            .chain()
            .focus()
            .setStorageImage({ path: uploadResult.path, alt: file.name })
            .run();
        }
        success('Image uploaded');
      } catch (err) {
        console.error('Image upload failed:', err);
        error((err as Error).message || 'Failed to upload image');
      } finally {
        setIsUploadingImage(false);
      }
    },
    [note?.owner_id, user?.id, noteId, error, success]
  );

  // Triggered on paste, drop, or toolbar upload: prompt crop modal
  const handleInitiateImageUpload = useCallback((file: File) => {
    setPendingCropFile(file);
  }, []);

  const handleInitiateImageUploadRef = useRef(handleInitiateImageUpload);
  useEffect(() => {
    handleInitiateImageUploadRef.current = handleInitiateImageUpload;
  }, [handleInitiateImageUpload]);

  // Add drawing canvas handler (inserts row into drawings table then adds node)
  const handleAddDrawing = useCallback(async () => {
    setIsAddingDrawing(true);
    try {
      const { data, error: insertError } = await supabase
        .from('drawings')
        .insert({
          note_id: noteId,
          strokes: [],
          width: 1200,
          height: 800,
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      if (data && editorRef.current) {
        editorRef.current
          .chain()
          .focus()
          .setDrawing({ drawingId: data.id })
          .run();
        success('Drawing canvas added');
      }
    } catch (err) {
      console.error('Failed to create drawing:', err);
      error((err as Error).message || 'Failed to create drawing');
    } finally {
      setIsAddingDrawing(false);
    }
  }, [noteId, error, success]);

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
      StorageImageNode,
      DrawingNode,
    ],
    content: '',
    editable: false,
    editorProps: {
      attributes: {
        class: 'prose dark:prose-invert max-w-none focus:outline-none min-h-[350px] p-4 text-slate-800 dark:text-slate-200 text-sm leading-relaxed',
      },
      handlePaste: (_view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;

        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) {
              event.preventDefault();
              handleInitiateImageUploadRef.current(file);
              return true;
            }
          }
        }
        return false;
      },
      handleDrop: (_view, event) => {
        const files = event.dataTransfer?.files;
        if (!files || files.length === 0) return false;

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          if (file.type.startsWith('image/')) {
            event.preventDefault();
            handleInitiateImageUploadRef.current(file);
            return true;
          }
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      isDirtyRef.current = true;
      triggerSaveRef.current(titleRef.current, editor.getJSON() as Json, editor.getText());
    },
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  // Sync state when note data loads
  useEffect(() => {
    if (note) {
      if (!initialContentSetRef.current) {
        setTitle(note.title);
        titleRef.current = note.title;
        setCurrentVersion(note.version);
        versionRef.current = note.version;

        if (editor) {
          if (note.content && typeof note.content === 'object' && Object.keys(note.content).length > 0) {
            editor.commands.setContent(note.content as JSONContent, false);
          } else {
            editor.commands.setContent('', false);
          }
          initialContentSetRef.current = true;
        }
      } else if (!isDirtyRef.current && saveStatusRef.current === 'saved' && note.version > versionRef.current) {
        // Silently update if local has no unsaved changes and remote version is newer
        setTitle(note.title);
        titleRef.current = note.title;
        setCurrentVersion(note.version);
        versionRef.current = note.version;

        if (editor) {
          if (note.content && typeof note.content === 'object' && Object.keys(note.content).length > 0) {
            editor.commands.setContent(note.content as JSONContent, false);
          } else {
            editor.commands.setContent('', false);
          }
        }
      }
    }
  }, [note, editor]);

  // Synchronize Tiptap editable state with isEditing toggle
  useEffect(() => {
    if (editor) {
      editor.setEditable(isEditing);
    }
  }, [editor, isEditing]);

  // Reset content ref when switching notes
  useEffect(() => {
    initialContentSetRef.current = false;
    setIsEditing(false); // Read mode by default when opening note
    setIsAnnotating(false);
    setConflictOpen(false);
    setRemoteNote(null);
    setIncomingRemoteNote(null);
    setShowRemoteBanner(false);
    isDirtyRef.current = false;
    setSaveStatus('saved');
  }, [noteId]);

  // Online / offline listeners
  useEffect(() => {
    const handleOnline = () => {
      if (saveStatus === 'offline') triggerSave(titleRef.current);
    };
    const handleOffline = () => setSaveStatus('offline');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [saveStatus, triggerSave]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    isDirtyRef.current = true;
    const newTitle = e.target.value;
    setTitle(newTitle);
    titleRef.current = newTitle;
    triggerSave(newTitle);
  };

  // Realtime subscription for live updates from another device/tab (Section 7.3)
  useEffect(() => {
    if (!noteId) return;

    const channel = supabase
      .channel(`note-editor-realtime-${noteId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notes',
          filter: `id=eq.${noteId}`,
        },
        (payload) => {
          const incoming = payload.new as Note;
          if (!incoming || incoming.id !== noteId) return;

          // Ignore echoes of our own saves or equal/older versions
          if (incoming.version <= versionRef.current) {
            return;
          }

          // Check if local has unsaved changes
          const hasUnsavedChanges = 
            isDirtyRef.current || 
            saveStatusRef.current === 'saving' || 
            saveTimeoutRef.current !== null;

          if (!hasUnsavedChanges) {
            // Silently replace content without disrupting user
            versionRef.current = incoming.version;
            setCurrentVersion(incoming.version);
            setTitle(incoming.title);
            titleRef.current = incoming.title;

            if (editorRef.current) {
              if (incoming.content && typeof incoming.content === 'object' && Object.keys(incoming.content).length > 0) {
                editorRef.current.commands.setContent(incoming.content as JSONContent, false);
              } else {
                editorRef.current.commands.setContent('', false);
              }
            }

            queryClient.setQueryData(['note', noteId], incoming);
          } else {
            // Local changes exist -> do not clobber user text! Show banner instead
            setIncomingRemoteNote(incoming);
            setShowRemoteBanner(true);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [noteId, queryClient]);

  // Banner Action: Accept Remote Update (Reload Latest)
  const handleAcceptRemoteUpdate = () => {
    if (!incomingRemoteNote) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    versionRef.current = incomingRemoteNote.version;
    setCurrentVersion(incomingRemoteNote.version);
    setTitle(incomingRemoteNote.title);
    titleRef.current = incomingRemoteNote.title;

    if (editorRef.current) {
      if (incomingRemoteNote.content && typeof incomingRemoteNote.content === 'object' && Object.keys(incomingRemoteNote.content).length > 0) {
        editorRef.current.commands.setContent(incomingRemoteNote.content as JSONContent, false);
      } else {
        editorRef.current.commands.setContent('', false);
      }
    }

    isDirtyRef.current = false;
    setSaveStatus('saved');
    setShowRemoteBanner(false);
    setIncomingRemoteNote(null);
    queryClient.setQueryData(['note', noteId], incomingRemoteNote);
    success('Loaded latest version from database.');
  };

  // Banner Action: Keep My Edits
  const handleKeepLocalEdits = () => {
    setShowRemoteBanner(false);
  };

  const handleSelectFolder = async (folderId: string | null) => {
    setFolderDropdownOpen(false);
    try {
      await setNoteFolder.mutateAsync({ noteId, folderId });
      success(folderId ? 'Moved note to folder' : 'Removed note from folder');
    } catch (err) {
      error((err as Error).message);
    }
  };

  const handleAddTag = async (tagId: string) => {
    setTagDropdownOpen(false);
    try {
      await addTagToNote.mutateAsync({ noteId, tagId });
      success('Tag added');
    } catch (err) {
      error((err as Error).message);
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    try {
      await removeTagFromNote.mutateAsync({ noteId, tagId });
      success('Tag removed');
    } catch (err) {
      error((err as Error).message);
    }
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
        versionRef.current = savedNote.version;
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
    titleRef.current = remoteNote.title;
    setCurrentVersion(remoteNote.version);
    versionRef.current = remoteNote.version;

    if (editor) {
      if (remoteNote.content && typeof remoteNote.content === 'object' && Object.keys(remoteNote.content).length > 0) {
        editor.commands.setContent(remoteNote.content as JSONContent, false);
      } else {
        editor.commands.setContent('', false);
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
    <div
      ref={noteContainerRef}
      className="h-full flex flex-col bg-white dark:bg-slate-900 transition-colors relative"
    >
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
          {/* Read / Edit Mode Toggle & Annotate Button */}
          {!isDeleted && (
            <>
              <button
                type="button"
                onClick={() => setIsEditing((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                  isEditing
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
                }`}
                title={isEditing ? 'Finish editing (Switch to Read Mode)' : 'Edit note'}
              >
                {isEditing ? (
                  <>
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Done</span>
                  </>
                ) : (
                  <>
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setIsAnnotating(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60 transition cursor-pointer"
                title="Freehand Annotate & Markup note (Approach C)"
              >
                <Highlighter className="w-3.5 h-3.5 text-amber-600" />
                <span className="hidden sm:inline">Annotate</span>
              </button>

              <div className="w-px h-4 bg-slate-200 dark:border-slate-800 mx-1" />
            </>
          )}

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

      {/* Remote update banner when note is changed elsewhere while having unsaved edits */}
      {showRemoteBanner && incomingRemoteNote && (
        <div className="mx-6 mt-3 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-100 shadow-xs animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="truncate">
              <strong>Changed on another device (v{incomingRemoteNote.version}):</strong> Remote updates are available.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleAcceptRemoteUpdate}
              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg shadow-xs transition cursor-pointer"
            >
              Reload Latest
            </button>
            <button
              type="button"
              onClick={handleKeepLocalEdits}
              className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/60 dark:hover:bg-amber-900 text-amber-900 dark:text-amber-200 font-medium rounded-lg transition cursor-pointer"
            >
              Keep My Edits
            </button>
            <button
              type="button"
              onClick={() => setShowRemoteBanner(false)}
              className="p-1 text-amber-600 dark:text-amber-400 hover:bg-amber-200/50 dark:hover:bg-amber-800/50 rounded-lg cursor-pointer"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Title Input */}
      <div className="px-6 pt-4 pb-2">
        <input
          type="text"
          value={title}
          onChange={handleTitleChange}
          placeholder="Untitled Note"
          disabled={isDeleted || !isEditing}
          className="w-full text-2xl font-bold bg-transparent text-slate-900 dark:text-white placeholder-slate-300 dark:placeholder-slate-600 focus:outline-none tracking-tight disabled:opacity-90 disabled:cursor-default"
        />
      </div>

      {/* Note Meta Bar: Folder & Tags */}
      {!isDeleted && (
        <div className="px-6 pb-2.5 flex items-center gap-2 flex-wrap text-xs">
          {/* Folder Selector Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setFolderDropdownOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 transition cursor-pointer"
            >
              <Folder className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span className="max-w-[130px] truncate font-medium">
                {currentFolder ? currentFolder.name : 'No folder'}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
            </button>

            {folderDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setFolderDropdownOpen(false)}
                />
                <div className="absolute left-0 mt-1 w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg z-30 py-1.5 max-h-56 overflow-y-auto">
                  <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Organize Note
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSelectFolder(null)}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer ${
                      !note.folder_id ? 'font-semibold text-indigo-600' : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <span>No folder (Root)</span>
                  </button>
                  {allFolders.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => handleSelectFolder(f.id)}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer ${
                        note.folder_id === f.id
                          ? 'font-semibold text-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30'
                          : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <Folder className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate">{f.name}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Tags Chips */}
          {noteTags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-medium text-[11px]"
              style={{
                backgroundColor: `${tag.color}18`,
                color: tag.color,
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: tag.color }}
              />
              #{tag.name}
              <button
                type="button"
                onClick={() => handleRemoveTag(tag.id)}
                className="hover:opacity-75 cursor-pointer ml-0.5"
                title="Remove tag"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}

          {/* Add Tag Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setTagDropdownOpen((v) => !v)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 text-[11px] transition cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Tag</span>
            </button>

            {tagDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setTagDropdownOpen(false)}
                />
                <div className="absolute left-0 mt-1 w-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg z-30 py-1.5 max-h-48 overflow-y-auto">
                  <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Add Tag
                  </div>
                  {availableTags.length === 0 ? (
                    <p className="px-3 py-2 text-[11px] text-slate-400 italic">No more tags</p>
                  ) : (
                    availableTags.map((tag) => (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => handleAddTag(tag.id)}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300"
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="truncate">#{tag.name}</span>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Tiptap Toolbar - Only shown in Edit Mode */}
      {!isDeleted && isEditing && (
        <Toolbar
          editor={editor}
          onUploadImage={handleInitiateImageUpload}
          isUploadingImage={isUploadingImage}
          onAddDrawing={handleAddDrawing}
          isAddingDrawing={isAddingDrawing}
        />
      )}

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

      {/* Image Crop & Transformation Modal */}
      <ImageCropModal
        isOpen={Boolean(pendingCropFile)}
        file={pendingCropFile}
        onClose={() => setPendingCropFile(null)}
        onConfirm={(processedFile) => {
          setPendingCropFile(null);
          performImageUpload(processedFile);
        }}
      />

      {/* Note Freehand Annotation & Markup Layer (Approach C) */}
      <NoteAnnotationLayer
        noteId={noteId}
        isOpen={isAnnotating}
        onClose={() => setIsAnnotating(false)}
        targetRef={noteContainerRef}
      />
    </div>
  );
}

export default NoteEditor;
