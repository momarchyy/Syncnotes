import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { DrawingCanvas } from './DrawingCanvas';
import { Trash2 } from 'lucide-react';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    drawing: {
      setDrawing: (options: { drawingId: string }) => ReturnType;
    };
  }
}

function DrawingComponent({ node, deleteNode, editor }: NodeViewProps) {
  const { drawingId } = node.attrs;
  const isEditable = editor.isEditable;

  return (
    <NodeViewWrapper className="my-6 relative group block select-none">
      <div className="relative">
        <DrawingCanvas drawingId={drawingId} readOnly={!isEditable} />

        {isEditable && (
          <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-10">
            <button
              type="button"
              onClick={deleteNode}
              className="p-1.5 rounded-lg bg-black/60 hover:bg-rose-600 text-white backdrop-blur-xs transition shadow-xs cursor-pointer"
              title="Delete drawing canvas"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}

export const DrawingNode = Node.create({
  name: 'drawing',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      drawingId: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-drawing-id]',
        getAttrs: (dom) => {
          if (typeof dom === 'string') return {};
          const element = dom as HTMLElement;
          return {
            drawingId: element.getAttribute('data-drawing-id'),
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-drawing-id': HTMLAttributes.drawingId,
      }),
    ];
  },

  addCommands() {
    return {
      setDrawing:
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
    return ReactNodeViewRenderer(DrawingComponent);
  },
});
