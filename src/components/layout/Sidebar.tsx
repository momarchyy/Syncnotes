import { useState, useMemo } from 'react';
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
  Folder as FolderIcon,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Edit2
} from 'lucide-react';
import { useCreateNote } from '../../hooks/useNotes';
import { 
  useFolders, 
  useCreateFolder, 
  useDeleteFolder, 
  useUpdateFolder,
  buildFolderTree, 
  type FolderTreeNode,
  type Folder 
} from '../../hooks/useFolders';
import { 
  useTags, 
  useCreateTag, 
  useDeleteTag, 
  TAG_COLORS, 
  type Tag 
} from '../../hooks/useTags';
import { useToast } from '../ui/Toast';
import { Modal } from '../ui/Modal';

interface SidebarProps {
  onCloseMobile?: () => void;
}

export function Sidebar({ onCloseMobile }: SidebarProps) {
  const navigate = useNavigate();
  const createNote = useCreateNote();
  const { success, error } = useToast();

  // Folders state & hooks
  const { data: rawFolders = [] } = useFolders();
  const createFolder = useCreateFolder();
  const deleteFolder = useDeleteFolder();
  const updateFolder = useUpdateFolder();
  const folderTree = useMemo(() => buildFolderTree(rawFolders), [rawFolders]);

  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set());
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);

  // Tags state & hooks
  const { data: tags = [] } = useTags();
  const createTag = useCreateTag();
  const deleteTag = useDeleteTag();

  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [selectedTagColor, setSelectedTagColor] = useState(TAG_COLORS[0]);

  // Folder rename modal
  const [renameFolderModalOpen, setRenameFolderModalOpen] = useState(false);
  const [folderToRename, setFolderToRename] = useState<Folder | null>(null);
  const [renamedFolderName, setRenamedFolderName] = useState('');

  const toggleFolderExpand = (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const handleCreateNote = async () => {
    try {
      const newNote = await createNote.mutateAsync({ title: 'Untitled' });
      navigate(`/note/${newNote.id}`);
      if (onCloseMobile) onCloseMobile();
    } catch (err) {
      error((err as Error).message || 'Failed to create note');
    }
  };

  const handleOpenNewFolderModal = (parentId: string | null = null, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedParentId(parentId);
    setNewFolderName('');
    setFolderModalOpen(true);
  };

  const handleConfirmCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    try {
      const created = await createFolder.mutateAsync({
        name: newFolderName,
        parentId: selectedParentId,
      });
      if (selectedParentId) {
        setExpandedFolderIds((prev) => new Set([...prev, selectedParentId]));
      }
      setFolderModalOpen(false);
      setNewFolderName('');
      success(`Folder "${created.name}" created`);
      navigate(`/folder/${created.id}`);
      if (onCloseMobile) onCloseMobile();
    } catch (err) {
      error((err as Error).message);
    }
  };

  const handleDeleteFolder = async (folder: Folder, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Delete folder "${folder.name}" and any subfolders? Notes will be kept.`)) {
      return;
    }
    try {
      await deleteFolder.mutateAsync(folder.id);
      success(`Folder "${folder.name}" deleted`);
      navigate('/');
    } catch (err) {
      error((err as Error).message);
    }
  };

  const handleOpenRenameFolderModal = (folder: Folder, e: React.MouseEvent) => {
    e.stopPropagation();
    setFolderToRename(folder);
    setRenamedFolderName(folder.name);
    setRenameFolderModalOpen(true);
  };

  const handleConfirmRenameFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderToRename || !renamedFolderName.trim()) return;

    try {
      await updateFolder.mutateAsync({
        id: folderToRename.id,
        name: renamedFolderName,
      });
      setRenameFolderModalOpen(false);
      setFolderToRename(null);
      success('Folder renamed');
    } catch (err) {
      error((err as Error).message);
    }
  };

  const handleConfirmCreateTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim()) return;

    try {
      const created = await createTag.mutateAsync({
        name: newTagName,
        color: selectedTagColor,
      });
      setTagModalOpen(false);
      setNewTagName('');
      success(`Tag #${created.name} created`);
      navigate(`/tag/${created.id}`);
      if (onCloseMobile) onCloseMobile();
    } catch (err) {
      error((err as Error).message);
    }
  };

  const handleDeleteTag = async (tag: Tag, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Delete tag #${tag.name}?`)) return;

    try {
      await deleteTag.mutateAsync(tag.id);
      success(`Tag #${tag.name} deleted`);
      navigate('/');
    } catch (err) {
      error((err as Error).message);
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

  // Recursive tree renderer
  const renderFolderNode = (node: FolderTreeNode, depth = 0) => {
    const isExpanded = expandedFolderIds.has(node.id);
    const hasChildren = node.children.length > 0;
    const isCurrentActive = location.pathname === `/folder/${node.id}`;

    return (
      <div key={node.id} className="select-none">
        <div
          onClick={() => {
            navigate(`/folder/${node.id}`);
            if (onCloseMobile) onCloseMobile();
          }}
          style={{ paddingLeft: `${depth * 14 + 10}px` }}
          className={`group flex items-center justify-between pr-2 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
            isCurrentActive
              ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => toggleFolderExpand(node.id, e)}
                className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-400"
              >
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </button>
            ) : (
              <span className="w-4.5" />
            )}

            {isExpanded ? (
              <FolderOpen className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            ) : (
              <FolderIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            )}
            <span className="truncate">{node.name}</span>
          </div>

          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={(e) => handleOpenNewFolderModal(node.id, e)}
              className="p-1 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"
              title="Add subfolder"
            >
              <Plus className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={(e) => handleOpenRenameFolderModal(node, e)}
              className="p-1 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"
              title="Rename folder"
            >
              <Edit2 className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={(e) => handleDeleteFolder(node, e)}
              className="p-1 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"
              title="Delete folder"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="space-y-0.5">
            {node.children.map((child) => renderFolderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside className="w-64 h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-colors">
      {/* New Note Button */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-800/80">
        <button
          onClick={handleCreateNote}
          disabled={createNote.isPending}
          className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-medium text-sm rounded-xl shadow-xs shadow-indigo-500/20 transition flex items-center justify-center gap-2 cursor-pointer"
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

      {/* Navigation Scroll Container */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {/* Primary Navigation */}
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

        {/* Folders Section (Phase 5: Nested Folder Tree) */}
        <div>
          <div className="flex items-center justify-between px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            <span>Folders</span>
            <button
              type="button"
              onClick={() => handleOpenNewFolderModal(null)}
              className="p-1 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition cursor-pointer"
              title="Create Root Folder"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-0.5">
            {folderTree.length === 0 ? (
              <p className="px-3 py-2 text-xs text-slate-400 dark:text-slate-500 italic">
                No folders created yet
              </p>
            ) : (
              folderTree.map((rootNode) => renderFolderNode(rootNode))
            )}
          </div>
        </div>

        {/* Tags Section (Phase 5: Tags List) */}
        <div>
          <div className="flex items-center justify-between px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            <span>Tags</span>
            <button
              type="button"
              onClick={() => {
                setNewTagName('');
                setTagModalOpen(true);
              }}
              className="p-1 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition cursor-pointer"
              title="Create Tag"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-0.5">
            {tags.length === 0 ? (
              <p className="px-3 py-2 text-xs text-slate-400 dark:text-slate-500 italic">
                No tags created yet
              </p>
            ) : (
              tags.map((tag) => {
                const isCurrentActive = location.pathname === `/tag/${tag.id}`;
                return (
                  <div
                    key={tag.id}
                    onClick={() => {
                      navigate(`/tag/${tag.id}`);
                      if (onCloseMobile) onCloseMobile();
                    }}
                    className={`group flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                      isCurrentActive
                        ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="truncate">#{tag.name}</span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleDeleteTag(tag, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-opacity"
                      title="Delete tag"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })
            )}
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

      {/* New Folder Modal */}
      <Modal
        isOpen={folderModalOpen}
        onClose={() => setFolderModalOpen(false)}
        title={selectedParentId ? 'New Subfolder' : 'New Folder'}
        maxWidth="max-w-sm"
      >
        <form onSubmit={handleConfirmCreateFolder} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Folder Name
            </label>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="e.g. Work, Projects, Research"
              autoFocus
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setFolderModalOpen(false)}
              className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!newFolderName.trim() || createFolder.isPending}
              className="px-4 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium rounded-lg transition shadow-xs"
            >
              {createFolder.isPending ? 'Creating...' : 'Create Folder'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Rename Folder Modal */}
      <Modal
        isOpen={renameFolderModalOpen}
        onClose={() => setRenameFolderModalOpen(false)}
        title="Rename Folder"
        maxWidth="max-w-sm"
      >
        <form onSubmit={handleConfirmRenameFolder} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Folder Name
            </label>
            <input
              type="text"
              value={renamedFolderName}
              onChange={(e) => setRenamedFolderName(e.target.value)}
              autoFocus
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setRenameFolderModalOpen(false)}
              className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!renamedFolderName.trim() || updateFolder.isPending}
              className="px-4 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium rounded-lg transition shadow-xs"
            >
              {updateFolder.isPending ? 'Saving...' : 'Rename'}
            </button>
          </div>
        </form>
      </Modal>

      {/* New Tag Modal */}
      <Modal
        isOpen={tagModalOpen}
        onClose={() => setTagModalOpen(false)}
        title="New Tag"
        maxWidth="max-w-sm"
      >
        <form onSubmit={handleConfirmCreateTag} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Tag Name
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3 text-slate-400 text-sm font-semibold">#</span>
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value.replace(/^#/, ''))}
                placeholder="design, ideas, urgent"
                autoFocus
                className="w-full pl-7 pr-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
              Color Preset
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {TAG_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedTagColor(color)}
                  style={{ backgroundColor: color }}
                  className={`w-6 h-6 rounded-full transition-transform ${
                    selectedTagColor === color ? 'scale-125 ring-2 ring-offset-2 ring-indigo-500' : 'hover:scale-110'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setTagModalOpen(false)}
              className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!newTagName.trim() || createTag.isPending}
              className="px-4 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium rounded-lg transition shadow-xs"
            >
              {createTag.isPending ? 'Creating...' : 'Create Tag'}
            </button>
          </div>
        </form>
      </Modal>
    </aside>
  );
}

export default Sidebar;
