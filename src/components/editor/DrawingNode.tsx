import { useState, useEffect } from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { DrawingCanvas } from './DrawingCanvas';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    drawing: {
      setDrawing: (options: { drawingId: string }) => ReturnType;
    };
  }
}

function DrawingComponent({ node, deleteNode, editor }: NodeViewProps) {
  const { drawingId } = node.attrs;
  const [editable, setEditable] = useState(editor.isEditable);

  useEffect(() => {
    const updateEditable = () => {
      setEditable(editor.isEditable);
    };

    editor.on('transaction', updateEditable);
    return () => {
      editor.off('transaction', updateEditable);
    };
  }, [editor]);

  return (
    <NodeViewWrapper className="my-6 relative block select-none">
      <DrawingCanvas
        drawingId={drawingId}
        readOnly={!editable}
        onDelete={editable ? deleteNode : undefined}
      />
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
