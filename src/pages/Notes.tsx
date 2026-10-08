import React, { useMemo } from 'react';
import { useLocation, useNavigate, useParams, NavLink } from 'react-router-dom';
import { 
  FileText, 
  Plus, 
  Star, 
  Archive, 
  Trash2, 
  Search, 
  Pin, 
  Sparkles, 
  Inbox,
  Folder as FolderIcon,
  Tag as TagIcon
} from 'lucide-react';
import { useNotes, useCreateNote, useUpdateNote, useTrashNote, useRestoreNote, useDeleteNotePermanently, NoteFilter } from '../hooks/useNotes';
import { useFolder, useFolderPath } from '../hooks/useFolders';
import { useTag, useAddTagToNote } from '../hooks/useTags';
import { NoteCard } from '../components/notes/NoteCard';
import { NoteEditor } from '../components/editor/NoteEditor';
import { useToast } from '../components/ui/Toast';

export function Notes() {
  const location = useLocation();
  const navigate = useNavigate();
  const { id: selectedNoteId } = useParams();

  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const trashNote = useTrashNote();
  const restoreNote = useRestoreNote();
  const deletePermanently = useDeleteNotePermanently();
  const addTagToNote = useAddTagToNote();
  const { success, error } = useToast();

  const [searchQuery, setSearchQuery] = React.useState('');

  // Determine current filter from route path
  const filter: NoteFilter = useMemo(() => {
    if (location.pathname.startsWith('/favorites')) return { type: 'favorites' };
    if (location.pathname.startsWith('/archive')) return { type: 'archive' };
    if (location.pathname.startsWith('/trash')) return { type: 'trash' };
    if (location.pathname.startsWith('/folder/')) {
      const parts = location.pathname.split('/folder/')[1]?.split('/');
      return { type: 'folder', folderId: parts?.[0] };
    }
    if (location.pathname.startsWith('/tag/')) {
      const parts = location.pathname.split('/tag/')[1]?.split('/');
      return { type: 'tag', tagId: parts?.[0] };
    }
    return { type: 'all' };
  }, [location.pathname]);

  const { data: currentFolder } = useFolder(filter.type === 'folder' ? filter.folderId ?? undefined : undefined);
  const { data: folderPath = [] } = useFolderPath(filter.type === 'folder' ? filter.folderId ?? undefined : undefined);
  const { data: currentTag } = useTag(filter.type === 'tag' ? filter.tagId ?? undefined : undefined);

  const { data: notes = [], isLoading } = useNotes(filter);

  // Client-side quick filter by title or text
  const filteredNotes = useMemo(() => {
    if (!searchQuery.trim()) return notes;
    const q = searchQuery.toLowerCase();
    return notes.filter(
      (n) => n.title.toLowerCase().includes(q) || n.content_text.toLowerCase().includes(q)
    );
  }, [notes, searchQuery]);

  const pinnedNotes = useMemo(() => filteredNotes.filter((n) => n.is_pinned), [filteredNotes]);
  const regularNotes = useMemo(() => filteredNotes.filter((n) => !n.is_pinned), [filteredNotes]);

  const handleCreateNote = async () => {
    try {
      const newNote = await createNote.mutateAsync({ 
        title: 'Untitled',
        folderId: filter.type === 'folder' ? filter.folderId : null,
      });
      if (filter.type === 'tag' && filter.tagId) {
        await addTagToNote.mutateAsync({ noteId: newNote.id, tagId: filter.tagId });
      }
      navigate(`/note/${newNote.id}`);
    } catch (err) {
      error((err as Error).message || 'Failed to create note');
    }
  };

  const getPageTitle = () => {
    switch (filter.type) {
      case 'favorites':
        return { title: 'Favorites', icon: Star, color: 'text-rose-500' };
      case 'archive':
        return { title: 'Archive', icon: Archive, color: 'text-indigo-500' };
      case 'trash':
        return { title: 'Trash', icon: Trash2, color: 'text-amber-500' };
      case 'folder':
        return { 
          title: currentFolder ? currentFolder.name : 'Folder', 
          icon: FolderIcon, 
          color: 'text-indigo-600' 
        };
      case 'tag':
        return { 
          title: currentTag ? `#${currentTag.name}` : 'Tag', 
          icon: TagIcon, 
          color: currentTag ? currentTag.color : 'text-indigo-600' 
        };
      default:
        return { title: 'All Notes', icon: FileText, color: 'text-indigo-600' };
    }
  };

  const pageInfo = getPageTitle();
  const PageIcon = pageInfo.icon;

  // Master-Detail layout when note is selected
  if (selectedNoteId) {
    return (
      <div className="h-full flex overflow-hidden">
        {/* Left List Pane (Visible on lg+ screens) */}
        <div className="hidden lg:flex w-80 xl:w-96 border-r border-slate-200 dark:border-slate-800 flex-col bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h2 className="font-semibold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <PageIcon className={`w-4 h-4 ${pageInfo.color}`} />
              <span>{pageInfo.title}</span>
            </h2>
            <button
              onClick={handleCreateNote}
              className="p-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition"
              title="New Note"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {filteredNotes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                isSelected={note.id === selectedNoteId}
                onClick={() => navigate(`/note/${note.id}`)}
              />
            ))}
          </div>
        </div>

        {/* Right Editor Pane */}
        <div className="flex-1 h-full min-w-0">
          <NoteEditor
            noteId={selectedNoteId}
            onClose={() => navigate(location.pathname.startsWith('/note') ? '/' : location.pathname)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-y-auto p-4 sm:p-6 lg:p-8">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center shadow-xs shrink-0">
            <PageIcon className={`w-5 h-5 ${pageInfo.color}`} />
          </div>
          <div>
            {filter.type === 'folder' && folderPath.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-0.5">
                <NavLink to="/" className="hover:text-indigo-600 transition">Notes</NavLink>
                {folderPath.map((item, idx) => (
                  <React.Fragment key={item.id}>
                    <span className="text-slate-300 dark:text-slate-600">/</span>
                    {idx === folderPath.length - 1 ? (
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{item.name}</span>
                    ) : (
                      <NavLink to={`/folder/${item.id}`} className="hover:text-indigo-600 transition">
                        {item.name}
                      </NavLink>
                    )}
                  </React.Fragment>
                ))}
              </div>
            )}
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              {pageInfo.title}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {notes.length} {notes.length === 1 ? 'note' : 'notes'}
            </p>
          </div>
        </div>

        {/* Search & Actions */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search in view..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
            />
          </div>

          <button
            onClick={handleCreateNote}
            disabled={createNote.isPending}
            className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium shadow-sm transition shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Note</span>
          </button>
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-pulse">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-36 rounded-xl bg-slate-200/70 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800"
            />
          ))}
        </div>
      ) : filteredNotes.length === 0 ? (
        /* Empty State */
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center my-auto">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center mb-4 text-slate-400">
            {filter.type === 'favorites' ? (
              <Star className="w-8 h-8 text-rose-400" />
            ) : filter.type === 'archive' ? (
              <Archive className="w-8 h-8 text-indigo-400" />
            ) : filter.type === 'trash' ? (
              <Trash2 className="w-8 h-8 text-amber-400" />
            ) : filter.type === 'folder' ? (
              <FolderIcon className="w-8 h-8 text-indigo-400" />
            ) : filter.type === 'tag' ? (
              <TagIcon className="w-8 h-8 text-indigo-400" />
            ) : (
              <Inbox className="w-8 h-8 text-indigo-500" />
            )}
          </div>
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-1">
            {filter.type === 'favorites'
              ? 'No favorite notes yet'
              : filter.type === 'archive'
              ? 'No archived notes'
              : filter.type === 'trash'
              ? 'Trash is empty'
              : filter.type === 'folder'
              ? 'This folder is empty'
              : filter.type === 'tag'
              ? 'No notes with this tag'
              : searchQuery
              ? 'No matching notes found'
              : 'You have no notes yet'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-6">
            {filter.type === 'trash'
              ? 'Notes you delete will appear here before being permanently removed.'
              : filter.type === 'favorites'
              ? 'Click the star icon on any note to add it to your favorites.'
              : filter.type === 'archive'
              ? 'Notes you archive are tucked away here safely.'
              : filter.type === 'folder'
              ? 'Add or move notes into this folder to keep your work organized.'
              : filter.type === 'tag'
              ? 'Assign tags to notes to categorize them across folders.'
              : 'Create your first note to start capturing your ideas and tasks.'}
          </p>
          {(filter.type === 'all' || filter.type === 'folder' || filter.type === 'tag') && !searchQuery && (
            <button
              onClick={handleCreateNote}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-medium shadow-sm transition cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{filter.type === 'folder' ? 'Create note in this folder' : 'Create note'}</span>
            </button>
          )}
        </div>
      ) : (
        /* Note Cards Grid */
        <div className="space-y-6">
          {/* Pinned Notes Section */}
          {pinnedNotes.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 mb-3 uppercase tracking-wider">
                <Pin className="w-3.5 h-3.5 fill-current" />
                <span>Pinned</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {pinnedNotes.map((note) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    onClick={() => navigate(`/note/${note.id}`)}
                    onTogglePin={(e) => {
                      e.stopPropagation();
                      updateNote.mutate({ id: note.id, is_pinned: !note.is_pinned });
                    }}
                    onToggleFavorite={(e) => {
                      e.stopPropagation();
                      updateNote.mutate({ id: note.id, is_favorite: !note.is_favorite });
                    }}
                    onToggleArchive={(e) => {
                      e.stopPropagation();
                      updateNote.mutate({ id: note.id, is_archived: !note.is_archived });
                    }}
                    onTrash={(e) => {
                      e.stopPropagation();
                      trashNote.mutate(note.id);
                      success('Note moved to trash');
                    }}
                    onRestore={(e) => {
                      e.stopPropagation();
                      restoreNote.mutate(note.id);
                      success('Note restored');
                    }}
                    onDeletePermanently={(e) => {
                      e.stopPropagation();
                      deletePermanently.mutate(note.id);
                      success('Note permanently deleted');
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Regular Notes Section */}
          <div>
            {pinnedNotes.length > 0 && regularNotes.length > 0 && (
              <div className="text-xs font-semibold text-slate-400 dark:text-slate-500 mb-3 uppercase tracking-wider">
                Other Notes
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {regularNotes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  onClick={() => navigate(`/note/${note.id}`)}
                  onTogglePin={(e) => {
                    e.stopPropagation();
                    updateNote.mutate({ id: note.id, is_pinned: !note.is_pinned });
                  }}
                  onToggleFavorite={(e) => {
                    e.stopPropagation();
                    updateNote.mutate({ id: note.id, is_favorite: !note.is_favorite });
                  }}
                  onToggleArchive={(e) => {
                    e.stopPropagation();
                    updateNote.mutate({ id: note.id, is_archived: !note.is_archived });
                  }}
                  onTrash={(e) => {
                    e.stopPropagation();
                    trashNote.mutate(note.id);
                    success('Note moved to trash');
                  }}
                  onRestore={(e) => {
                    e.stopPropagation();
                    restoreNote.mutate(note.id);
                    success('Note restored');
                  }}
                  onDeletePermanently={(e) => {
                    e.stopPropagation();
                    deletePermanently.mutate(note.id);
                    success('Note permanently deleted');
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Button for Mobile */}
      <button
        onClick={handleCreateNote}
        disabled={createNote.isPending}
        className="sm:hidden fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg shadow-indigo-600/30 flex items-center justify-center transition active:scale-95 z-30"
        aria-label="Create New Note"
      >
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );
}

export default Notes;
