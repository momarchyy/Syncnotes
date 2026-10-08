import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { 
  MessageSquare, 
  Send, 
  Trash2, 
  X, 
  Loader2, 
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useNoteComments, useAddComment, useDeleteComment, type Comment } from '../../hooks/useComments';
import { useToast } from '../ui/Toast';

interface CommentsDrawerProps {
  noteId: string;
  isOpen: boolean;
  onClose: () => void;
  canComment: boolean;
  isOwner: boolean;
}

export function CommentsDrawer({
  noteId,
  isOpen,
  onClose,
  canComment,
  isOwner,
}: CommentsDrawerProps) {
  const { user } = useAuth();
  const { data: comments = [], isLoading, error } = useNoteComments(noteId);
  const addCommentMutation = useAddComment();
  const deleteCommentMutation = useDeleteComment();
  const { success, error: toastError } = useToast();

  const [newCommentBody, setNewCommentBody] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentBody.trim()) return;

    try {
      await addCommentMutation.mutateAsync({
        noteId,
        body: newCommentBody.trim(),
      });
      setNewCommentBody('');
    } catch (err) {
      toastError((err as Error).message || 'Failed to post comment');
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      await deleteCommentMutation.mutateAsync({ commentId, noteId });
      success('Comment deleted');
    } catch (err) {
      toastError((err as Error).message || 'Failed to delete comment');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end animate-in fade-in">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 h-full shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white leading-tight">
                Comments
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
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

        {/* Comments Feed */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading && (
            <div className="flex flex-col items-center justify-center p-8 text-slate-400 text-xs gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
              <span>Loading comments...</span>
            </div>
          )}

          {error && (
            <div className="p-4 text-xs text-rose-500 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Failed to load comments</span>
            </div>
          )}

          {!isLoading && comments.length === 0 && (
            <div className="flex flex-col items-center justify-center p-12 text-center text-slate-400 text-xs">
              <MessageSquare className="w-8 h-8 text-slate-300 dark:text-slate-700 mb-2" />
              <p className="font-medium text-slate-600 dark:text-slate-400">No comments yet</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Collaborators can discuss and leave thoughts here in realtime.
              </p>
            </div>
          )}

          {comments.map((comment: Comment) => {
            const isAuthor = comment.author_id === user?.id;
            const canDelete = isAuthor || isOwner;
            const displayName = comment.profiles?.display_name || (isAuthor ? 'You' : 'Collaborator');

            return (
              <div
                key={comment.id}
                className="group p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 transition"
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 font-semibold flex items-center justify-center text-[10px] shrink-0">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {displayName} {isAuthor && <span className="font-normal text-slate-400">(You)</span>}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-slate-400">
                      {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                    </span>

                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => handleDelete(comment.id)}
                        disabled={deleteCommentMutation.isPending}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded transition cursor-pointer"
                        title="Delete comment"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap pl-8">
                  {comment.body}
                </p>
              </div>
            );
          })}
        </div>

        {/* Post Comment Input */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
          {canComment ? (
            <form onSubmit={handleSubmit} className="flex items-end gap-2">
              <textarea
                value={newCommentBody}
                onChange={(e) => setNewCommentBody(e.target.value)}
                placeholder="Write a comment..."
                rows={2}
                maxLength={2000}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                className="flex-1 p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/70 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none transition"
              />

              <button
                type="submit"
                disabled={addCommentMutation.isPending || !newCommentBody.trim()}
                className="p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer shrink-0"
                title="Send comment"
              >
                {addCommentMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </form>
          ) : (
            <div className="p-2.5 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
              You have view-only access. Only commenters and editors can post comments.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
