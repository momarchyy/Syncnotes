import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { useState, useEffect } from 'react';
import { getSignedImageUrl } from '../../lib/signedUrlCache';
import { Loader2, AlertCircle, Trash2 } from 'lucide-react';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    storageImage: {
      setStorageImage: (options: { path: string; alt?: string; caption?: string }) => ReturnType;
    };
  }
}

function StorageImageComponent({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const { path, alt = '', caption = '' } = node.attrs;
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (!path) {
      setLoading(false);
      setError(true);
      return;
    }

    setLoading(true);
    setError(false);

    getSignedImageUrl(path)
      .then((url) => {
        if (!isMounted) return;
        if (url) {
          setSignedUrl(url);
        } else {
          setError(true);
        }
      })
      .catch(() => {
        if (isMounted) setError(true);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [path]);

  return (
    <NodeViewWrapper className="my-4 relative group block select-none">
      <div
        className={`relative inline-block max-w-full rounded-xl overflow-hidden border transition-all ${
          selected
            ? 'ring-2 ring-indigo-500 border-transparent shadow-lg'
            : 'border-slate-200 dark:border-slate-800'
        }`}
      >
        {loading && (
          <div className="w-64 h-48 sm:w-96 sm:h-64 bg-slate-100 dark:bg-slate-800 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            <span className="text-xs">Loading image...</span>
          </div>
        )}

        {error && !loading && (
          <div className="w-64 h-40 sm:w-96 sm:h-48 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl flex flex-col items-center justify-center text-rose-600 dark:text-rose-400 gap-2 p-4 text-center">
            <AlertCircle className="w-6 h-6" />
            <span className="text-xs font-medium">Failed to load image</span>
            <span className="text-[10px] text-slate-400 truncate max-w-xs">{path}</span>
          </div>
        )}

        {!loading && !error && signedUrl && (
          <img
            src={signedUrl}
            alt={alt || 'Note image'}
            className="max-h-[600px] w-auto max-w-full object-contain rounded-xl block"
            loading="lazy"
          />
        )}

        {/* Action Overlay: Delete button */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-black/60 backdrop-blur-xs p-1 rounded-lg">
          <button
            type="button"
            onClick={deleteNode}
            className="p-1 rounded text-white hover:bg-rose-600 transition"
            title="Delete image"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Optional Caption */}
      <input
        type="text"
        value={caption}
        onChange={(e) => updateAttributes({ caption: e.target.value })}
        placeholder="Add a caption..."
        className="block mt-1 text-xs text-center text-slate-500 dark:text-slate-400 bg-transparent border-0 outline-hidden hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded py-0.5 px-2 max-w-md mx-auto focus:ring-1 focus:ring-indigo-400"
      />
    </NodeViewWrapper>
  );
}

export const StorageImageNode = Node.create({
  name: 'storageImage',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      path: {
        default: null,
      },
      alt: {
        default: null,
      },
      caption: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'img[data-storage-path]',
        getAttrs: (dom) => {
          if (typeof dom === 'string') return {};
          const element = dom as HTMLElement;
          return {
            path: element.getAttribute('data-storage-path'),
            alt: element.getAttribute('alt'),
            caption: element.getAttribute('data-caption'),
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'img',
      mergeAttributes(HTMLAttributes, {
        'data-storage-path': HTMLAttributes.path,
        'data-caption': HTMLAttributes.caption,
      }),
    ];
  },

  addCommands() {
    return {
      setStorageImage:
        (options) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          });
        },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(StorageImageComponent);
  },
});
