import { Editor } from '@tiptap/react';
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Code,
  Quote,
  Minus,
  ImageIcon,
  Loader2,
} from 'lucide-react';
import { useRef } from 'react';

interface ToolbarProps {
  editor: Editor | null;
  onUploadImage?: (file: File) => void;
  isUploadingImage?: boolean;
}

export function Toolbar({ editor, onUploadImage, isUploadingImage }: ToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  if (!editor) return null;

  return (
    <div className="flex flex-wrap items-center gap-0.5 p-1.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 backdrop-blur-xs text-slate-600 dark:text-slate-300">
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        disabled={!editor.can().chain().focus().toggleBold().run()}
        className={`p-1.5 rounded-lg text-xs transition ${
          editor.isActive('bold')
            ? 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold'
            : 'hover:bg-slate-200/60 dark:hover:bg-slate-800'
        }`}
        title="Bold (Ctrl+B)"
      >
        <Bold className="w-4 h-4" />
      </button>

      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        disabled={!editor.can().chain().focus().toggleItalic().run()}
        className={`p-1.5 rounded-lg text-xs transition ${
          editor.isActive('italic')
            ? 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold'
            : 'hover:bg-slate-200/60 dark:hover:bg-slate-800'
        }`}
        title="Italic (Ctrl+I)"
      >
        <Italic className="w-4 h-4" />
      </button>

      <div className="w-px h-4 bg-slate-200 dark:border-slate-800 mx-1" />

      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={`p-1.5 rounded-lg text-xs transition ${
          editor.isActive('heading', { level: 1 })
            ? 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold'
            : 'hover:bg-slate-200/60 dark:hover:bg-slate-800'
        }`}
        title="Heading 1"
      >
        <Heading1 className="w-4 h-4" />
      </button>

      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={`p-1.5 rounded-lg text-xs transition ${
          editor.isActive('heading', { level: 2 })
            ? 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold'
            : 'hover:bg-slate-200/60 dark:hover:bg-slate-800'
        }`}
        title="Heading 2"
      >
        <Heading2 className="w-4 h-4" />
      </button>

      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={`p-1.5 rounded-lg text-xs transition ${
          editor.isActive('heading', { level: 3 })
            ? 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold'
            : 'hover:bg-slate-200/60 dark:hover:bg-slate-800'
        }`}
        title="Heading 3"
      >
        <Heading3 className="w-4 h-4" />
      </button>

      <div className="w-px h-4 bg-slate-200 dark:border-slate-800 mx-1" />

      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={`p-1.5 rounded-lg text-xs transition ${
          editor.isActive('bulletList')
            ? 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300'
            : 'hover:bg-slate-200/60 dark:hover:bg-slate-800'
        }`}
        title="Bullet list"
      >
        <List className="w-4 h-4" />
      </button>

      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={`p-1.5 rounded-lg text-xs transition ${
          editor.isActive('orderedList')
            ? 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300'
            : 'hover:bg-slate-200/60 dark:hover:bg-slate-800'
        }`}
        title="Numbered list"
      >
        <ListOrdered className="w-4 h-4" />
      </button>

      <button
        type="button"
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        className={`p-1.5 rounded-lg text-xs transition ${
          editor.isActive('taskList')
            ? 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300'
            : 'hover:bg-slate-200/60 dark:hover:bg-slate-800'
        }`}
        title="Task list"
      >
        <CheckSquare className="w-4 h-4" />
      </button>

      <div className="w-px h-4 bg-slate-200 dark:border-slate-800 mx-1" />

      <button
        type="button"
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        className={`p-1.5 rounded-lg text-xs transition ${
          editor.isActive('codeBlock')
            ? 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300'
            : 'hover:bg-slate-200/60 dark:hover:bg-slate-800'
        }`}
        title="Code block"
      >
        <Code className="w-4 h-4" />
      </button>

      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={`p-1.5 rounded-lg text-xs transition ${
          editor.isActive('blockquote')
            ? 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300'
            : 'hover:bg-slate-200/60 dark:hover:bg-slate-800'
        }`}
        title="Blockquote"
      >
        <Quote className="w-4 h-4" />
      </button>

      <button
        type="button"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        className="p-1.5 rounded-lg text-xs hover:bg-slate-200/60 dark:hover:bg-slate-800 transition"
        title="Divider"
      >
        <Minus className="w-4 h-4" />
      </button>

      <div className="w-px h-4 bg-slate-200 dark:border-slate-800 mx-1" />

      {onUploadImage && (
        <>
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                onUploadImage(file);
                e.target.value = '';
              }
            }}
            accept="image/*"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingImage}
            className={`p-1.5 rounded-lg text-xs transition flex items-center gap-1.5 ${
              isUploadingImage
                ? 'opacity-60 cursor-not-allowed bg-slate-100 dark:bg-slate-800'
                : 'hover:bg-slate-200/60 dark:hover:bg-slate-800'
            }`}
            title="Add image"
          >
            {isUploadingImage ? (
              <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
            ) : (
              <ImageIcon className="w-4 h-4" />
            )}
            <span className="hidden sm:inline text-xs font-medium">Image</span>
          </button>
        </>
      )}
    </div>
  );
}

export default Toolbar;
