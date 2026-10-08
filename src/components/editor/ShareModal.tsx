import React, { useState } from 'react';
import { 
  Users, 
  UserPlus, 
  Shield, 
  Trash2, 
  Copy, 
  Check, 
  Loader2, 
  AlertCircle,
  Eye,
  MessageSquare,
  Edit3
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { useToast } from '../ui/Toast';
import { useAuth } from '../../hooks/useAuth';
import { 
  useCollaborators, 
  useShareNote, 
  useRemoveCollaborator, 
  useUpdateCollaboratorRole,
  type CollabRole 
} from '../../hooks/useCollaborators';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  noteId: string;
  noteTitle: string;
  isOwner: boolean;
}

export function ShareModal({
  isOpen,
  onClose,
  noteId,
  noteTitle,
  isOwner,
}: ShareModalProps) {
  const { user } = useAuth();
  const { data: collaborators = [], isLoading, error: collabError } = useCollaborators(noteId);
  const shareNoteMutation = useShareNote();
  const removeCollabMutation = useRemoveCollaborator();
  const updateRoleMutation = useUpdateCollaboratorRole();
  const { success, error } = useToast();

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<CollabRole>('editor');
  const [copiedLink, setCopiedLink] = useState(false);

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    try {
      await shareNoteMutation.mutateAsync({
        noteId,
        email: email.trim(),
        role,
      });
      success(`Shared with ${email}`);
      setEmail('');
    } catch (err) {
      error((err as Error).message || 'Failed to share note');
    }
  };

  const handleRemove = async (userId: string) => {
    try {
      await removeCollabMutation.mutateAsync({ noteId, userId });
      success('Collaborator removed');
    } catch (err) {
      error((err as Error).message || 'Failed to remove collaborator');
    }
  };

  const handleRoleChange = async (userId: string, newRole: CollabRole) => {
    try {
      await updateRoleMutation.mutateAsync({ noteId, userId, role: newRole });
      success('Permission updated');
    } catch (err) {
      error((err as Error).message || 'Failed to update permission');
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    success('Note link copied to clipboard');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const getRoleIcon = (r: CollabRole) => {
    switch (r) {
      case 'editor':
        return <Edit3 className="w-3.5 h-3.5 text-indigo-500" />;
      case 'commenter':
        return <MessageSquare className="w-3.5 h-3.5 text-amber-500" />;
      case 'viewer':
      default:
        return <Eye className="w-3.5 h-3.5 text-emerald-500" />;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Share "${noteTitle || 'Untitled Note'}"`}
    >
      <div className="space-y-5">
        {/* Share Invite Form (Owner only) */}
        {isOwner ? (
          <form onSubmit={handleShare} className="space-y-3">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Invite by Email
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                placeholder="colleague@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="flex-1 px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
              />

              <select
                value={role}
                onChange={(e) => setRole(e.target.value as CollabRole)}
                className="px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
              >
                <option value="editor">Can edit</option>
                <option value="commenter">Can comment</option>
                <option value="viewer">Can view</option>
              </select>

              <button
                type="submit"
                disabled={shareNoteMutation.isPending || !email.trim()}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer"
              >
                {shareNoteMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
                <span>Invite</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2">
            <Shield className="w-4 h-4 text-indigo-500 shrink-0" />
            <span>Only the note owner can invite or change collaborators.</span>
          </div>
        )}

        {/* Collaborators List */}
        <div>
          <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-slate-400" />
            <span>People with access</span>
          </h4>

          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {isLoading && (
              <div className="flex items-center justify-center p-4 text-xs text-slate-400 gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                <span>Loading collaborators...</span>
              </div>
            )}

            {collabError && (
              <div className="p-3 text-xs text-rose-500 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Failed to load collaborators</span>
              </div>
            )}

            {/* Owner Row */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-full bg-indigo-600 text-white font-semibold flex items-center justify-center text-xs shrink-0">
                  {user?.email?.charAt(0).toUpperCase() || 'O'}
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-slate-900 dark:text-white truncate">
                    {user?.email} {isOwner && '(You)'}
                  </div>
                  <div className="text-[10px] text-slate-400">Note Owner</div>
                </div>
              </div>
              <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60">
                Owner
              </span>
            </div>

            {/* Collaborators List */}
            {collaborators.map((collab) => {
              const displayName = collab.profiles?.display_name || 'Collaborator';
              const isCurrentUser = collab.user_id === user?.id;

              return (
                <div
                  key={collab.user_id}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200/70 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold flex items-center justify-center text-xs shrink-0">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 dark:text-white truncate">
                        {displayName} {isCurrentUser && '(You)'}
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1">
                        {getRoleIcon(collab.role)}
                        <span className="capitalize">{collab.role}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isOwner ? (
                      <>
                        <select
                          value={collab.role}
                          onChange={(e) =>
                            handleRoleChange(collab.user_id, e.target.value as CollabRole)
                          }
                          className="px-2 py-1 text-[11px] font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
                        >
                          <option value="editor">Can edit</option>
                          <option value="commenter">Can comment</option>
                          <option value="viewer">Can view</option>
                        </select>

                        <button
                          type="button"
                          onClick={() => handleRemove(collab.user_id)}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                          title="Remove collaborator"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <span className="text-[11px] font-medium text-slate-500 capitalize px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800">
                        {collab.role}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Copy Link Footer */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={handleCopyLink}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            {copiedLink ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-emerald-600 dark:text-emerald-400">Link Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>Copy Note Link</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}
