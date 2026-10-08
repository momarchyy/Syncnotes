import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Pin, Star, Archive, Trash2, RotateCcw, Folder } from 'lucide-react';
import type { Note } from '../../hooks/useNotes';

interface NoteCardProps {
  note: Note;
  isSelected?: boolean;
  onClick: () => void;
  onTogglePin?: (e: React.MouseEvent) => void;
  onToggleFavorite?: (e: React.MouseEvent) => void;
  onToggleArchive?: (e: React.MouseEvent) => void;
  onTrash?: (e: React.MouseEvent) => void;
  onRestore?: (e: React.MouseEvent) => void;
  onDeletePermanently?: (e: React.MouseEvent) => void;
}

export function NoteCard({
  note,
  isSelected,
  onClick,
  onTogglePin,
  onToggleFavorite,
  onToggleArchive,
  onTrash,
  onRestore,
  onDeletePermanently,
}: NoteCardProps) {
  const isDeleted = !!note.deleted_at;

  const timeAgo = note.updated_at
    ? formatDistanceToNow(new Date(note.updated_at), { addSuffix: true })
    : '';

  const snippet = note.content_text?.trim()
    ? note.content_text.slice(0, 140)
    : 'No content';

  return (
    <div
      onClick={onClick}
      className={`group relative p-4 rounded-xl border transition-all cursor-pointer select-none ${
        isSelected
          ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-500/50 shadow-sm'
          : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-xs'
      }`}
    >
      {/* Header: Title and Quick Action Badges */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0 flex-1 flex-wrap">
          <h3 className="font-semibold text-sm text-slate-900 dark:text-white line-clamp-1">
            {note.title || 'Untitled'}
          </h3>
          {note.is_archived && !isDeleted && (
            <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-medium border border-slate-200 dark:border-slate-700">
              Archived
            </span>
          )}
          {note.folder && !isDeleted && (
            <span className="shrink-0 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-medium border border-indigo-100 dark:border-indigo-900/40">
              <Folder className="w-2.5 h-2.5" />
              {note.folder.name}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {!isDeleted && onTogglePin && (
            <button
              type="button"
              onClick={onTogglePin}
              title={note.is_pinned ? 'Unpin note' : 'Pin note'}
              className={`p-1 rounded-md transition ${
                note.is_pinned
                  ? 'text-amber-500 hover:text-amber-600'
                  : 'text-slate-300 hover:text-slate-500 dark:text-slate-600 dark:hover:text-slate-400 opacity-0 group-hover:opacity-100'
              }`}
            >
              <Pin className={`w-3.5 h-3.5 ${note.is_pinned ? 'fill-current' : ''}`} />
            </button>
          )}

          {!isDeleted && onToggleFavorite && (
            <button
              type="button"
              onClick={onToggleFavorite}
              title={note.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
              className={`p-1 rounded-md transition ${
                note.is_favorite
                  ? 'text-rose-500 hover:text-rose-600'
                  : 'text-slate-300 hover:text-slate-500 dark:text-slate-600 dark:hover:text-slate-400 opacity-0 group-hover:opacity-100'
              }`}
            >
              <Star className={`w-3.5 h-3.5 ${note.is_favorite ? 'fill-current' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* Snippet */}
      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed mb-2.5">
        {snippet}
      </p>

      {/* Tags chips */}
      {note.tags && note.tags.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap mb-2.5">
          {note.tags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md font-medium"
              style={{
                backgroundColor: `${tag.color}15`,
                color: tag.color,
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: tag.color }}
              />
              #{tag.name}
            </span>
          ))}
        </div>
      )}

      {/* Footer: Date and Action Buttons */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-800/80">
        <span>{timeAgo}</span>

        {/* Hover action buttons */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {isDeleted ? (
            <>
              {onRestore && (
                <button
                  type="button"
                  onClick={onRestore}
                  title="Restore note"
                  className="p-1 rounded-md text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
              {onDeletePermanently && (
                <button
                  type="button"
                  onClick={onDeletePermanently}
                  title="Delete permanently"
                  className="p-1 rounded-md text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          ) : (
            <>
              {onToggleArchive && (
                <button
                  type="button"
                  onClick={onToggleArchive}
                  title={note.is_archived ? 'Unarchive note' : 'Archive note'}
                  className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  <Archive className="w-3.5 h-3.5" />
                </button>
              )}
              {onTrash && (
                <button
                  type="button"
                  onClick={onTrash}
                  title="Move to trash"
                  className="p-1 rounded-md hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default NoteCard;
