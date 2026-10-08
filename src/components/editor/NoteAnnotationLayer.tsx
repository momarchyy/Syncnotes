import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { getStroke } from 'perfect-freehand';
import { 
  Pen, 
  Highlighter, 
  Eraser, 
  RotateCcw, 
  RotateCw, 
  Trash2, 
  X,
  Check, 
  Eye, 
  EyeOff
} from 'lucide-react';
import type { StrokeData } from './DrawingCanvas';

interface NoteAnnotationLayerProps {
  noteId: string;
  isOpen: boolean;
  onClose: () => void;
  readOnly?: boolean;
  targetRef?: React.RefObject<HTMLDivElement | null>;
}

const COLOR_PRESETS = [
  '#ef4444', // Red
  '#f59e0b', // Amber/Orange
  '#10b981', // Green
  '#3b82f6', // Blue
  '#8b5cf6', // Purple
  '#000000', // Black
];

function getSvgPathFromStroke(stroke: number[][]): string {
  if (!stroke.length) return '';
  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ['M', ...stroke[0], 'Q']
  );
  d.push('Z');
  return d.join(' ');
}

export function NoteAnnotationLayer({
  noteId,
  isOpen,
  onClose,
  readOnly = false,
  targetRef,
}: NoteAnnotationLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = useState<StrokeData[]>([]);
  const [history, setHistory] = useState<StrokeData[][]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [currentTool, setCurrentTool] = useState<'pen' | 'highlighter' | 'eraser'>('pen');
  const [color, setColor] = useState<string>('#ef4444');
  const [size, setSize] = useState<number>(4);
  const [isVisible, setIsVisible] = useState<boolean>(true);
  const [bounds, setBounds] = useState<{ top: number; left: number; width: number; height: number }>({
    top: 0,
    left: 0,
    width: 0,
    height: 0,
  });

  const isDrawingRef = useRef<boolean>(false);
  const currentStrokeRef = useRef<StrokeData | null>(null);

  // Storage key for per-note annotation strokes
  const storageKey = `syncnotes_annotation_${noteId}`;

  // Load annotations from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        setStrokes(parsed);
        setHistory([parsed]);
        setHistoryIndex(0);
      } else {
        setStrokes([]);
        setHistory([[]]);
        setHistoryIndex(0);
      }
    } catch {
      setStrokes([]);
    }
  }, [storageKey]);

  // Save annotations to localStorage
  const saveStrokes = useCallback(
    (newStrokes: StrokeData[]) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(newStrokes));
      } catch (err) {
        console.error('Failed to save annotation strokes:', err);
      }
    },
    [storageKey]
  );

  // Resize canvas to match target container bounds (only the note taking area)
  useEffect(() => {
    if (!isOpen) return;

    const updateBounds = () => {
      const target = targetRef?.current;
      const canvas = canvasRef.current;
      if (!canvas) return;

      if (target) {
        const rect = target.getBoundingClientRect();
        setBounds({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        });
        canvas.width = rect.width;
        canvas.height = rect.height;
      } else {
        setBounds({
          top: 0,
          left: 0,
          width: window.innerWidth,
          height: window.innerHeight,
        });
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
      renderCanvas();
    };

    updateBounds();
    window.addEventListener('resize', updateBounds);
    return () => window.removeEventListener('resize', updateBounds);
  }, [isOpen, targetRef]);

  // Render strokes
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!isVisible) return;

    const allStrokes = currentStrokeRef.current
      ? [...strokes, currentStrokeRef.current]
      : strokes;

    for (const stroke of allStrokes) {
      if (!stroke.points.length) continue;

      const strokePoints = stroke.points.map(([x, y, p]) => [x, y, p ?? 0.5]);
      const outline = getStroke(strokePoints, {
        size: stroke.size * (stroke.tool === 'highlighter' ? 4 : 1),
        thinning: stroke.tool === 'highlighter' ? 0 : 0.5,
        smoothing: 0.5,
        streamline: 0.5,
      });

      const pathData = getSvgPathFromStroke(outline);
      if (!pathData) continue;

      const path = new Path2D(pathData);

      ctx.save();
      if (stroke.tool === 'highlighter') {
        ctx.globalAlpha = 0.38;
        ctx.fillStyle = stroke.color;
      } else {
        ctx.globalAlpha = 1;
        ctx.fillStyle = stroke.color;
      }

      ctx.fill(path);
      ctx.restore();
    }
  }, [strokes, isVisible]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>): [number, number, number] => {
    const canvas = canvasRef.current;
    if (!canvas) return [e.clientX, e.clientY, 0.5];
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const p = e.pressure || 0.5;
    return [x, y, p];
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (readOnly || !isVisible) return;
    isDrawingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    const [x, y, p] = getCanvasPoint(e);

    if (currentTool === 'eraser') {
      const filtered = strokes.filter((s) => {
        return !s.points.some(([px, py]) => Math.hypot(px - x, py - y) <= 20);
      });
      if (filtered.length !== strokes.length) {
        setStrokes(filtered);
      }
    } else {
      currentStrokeRef.current = {
        tool: currentTool,
        color,
        size,
        points: [[x, y, p]],
      };
      renderCanvas();
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || readOnly || !isVisible) return;
    const [x, y, p] = getCanvasPoint(e);

    if (currentTool === 'eraser') {
      const filtered = strokes.filter((s) => {
        return !s.points.some(([px, py]) => Math.hypot(px - x, py - y) <= 20);
      });
      if (filtered.length !== strokes.length) {
        setStrokes(filtered);
      }
    } else if (currentStrokeRef.current) {
      currentStrokeRef.current.points.push([x, y, p]);
      renderCanvas();
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || readOnly || !isVisible) return;
    isDrawingRef.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    if (currentTool === 'eraser') {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(strokes);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
      saveStrokes(strokes);
    } else if (currentStrokeRef.current) {
      const newStrokes = [...strokes, currentStrokeRef.current];
      currentStrokeRef.current = null;
      setStrokes(newStrokes);

      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(newStrokes);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
      saveStrokes(newStrokes);
    }
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      setStrokes(prev);
      saveStrokes(prev);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      setStrokes(next);
      saveStrokes(next);
    }
  };

  const handleClear = () => {
    if (strokes.length === 0) return;
    setStrokes([]);
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push([]);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    saveStrokes([]);
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed z-[9999] pointer-events-none select-none overflow-hidden"
      style={{
        top: bounds.top,
        left: bounds.left,
        width: bounds.width,
        height: bounds.height,
      }}
    >
      {/* Floating Markup Controls Bar positioned inside note area */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-3 py-1.5 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 flex items-center gap-2 pointer-events-auto text-xs animate-in fade-in slide-in-from-top-2 z-10">
        {/* Tool Selector */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl">
          <button
            type="button"
            onClick={() => setCurrentTool('pen')}
            className={`p-1.5 rounded-lg transition cursor-pointer ${
              currentTool === 'pen'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
            title="Pen markup"
          >
            <Pen className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setCurrentTool('highlighter')}
            className={`p-1.5 rounded-lg transition cursor-pointer ${
              currentTool === 'highlighter'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
            title="Highlighter"
          >
            <Highlighter className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setCurrentTool('eraser')}
            className={`p-1.5 rounded-lg transition cursor-pointer ${
              currentTool === 'eraser'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
            title="Eraser"
          >
            <Eraser className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Color Palette */}
        {currentTool !== 'eraser' && (
          <div className="flex items-center gap-1 px-1 bg-slate-100 dark:bg-slate-800 py-1 rounded-xl">
            {COLOR_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className="w-4 h-4 rounded-full border border-black/10 dark:border-white/10 flex items-center justify-center cursor-pointer transition-transform"
                style={{ backgroundColor: c }}
              >
                {color === c && (
                  <Check
                    className={`w-2.5 h-2.5 ${
                      c === '#f59e0b' || c === '#ffffff' ? 'text-black' : 'text-white'
                    }`}
                  />
                )}
              </button>
            ))}
          </div>
        )}

        {/* Size Slider */}
        <div className="flex items-center gap-1 px-1.5 bg-slate-100 dark:bg-slate-800 py-1 rounded-xl">
          <span className="text-[10px] text-slate-400 font-medium">Size</span>
          <input
            type="range"
            min="2"
            max="20"
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            className="w-14 h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          />
        </div>

        <div className="w-px h-4 bg-slate-200 dark:border-slate-800 mx-0.5" />

        {/* Undo / Redo / Visibility */}
        <button
          type="button"
          onClick={handleUndo}
          disabled={historyIndex <= 0}
          className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer"
          title="Undo"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={handleRedo}
          disabled={historyIndex >= history.length - 1}
          className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer"
          title="Redo"
        >
          <RotateCw className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={handleClear}
          className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 cursor-pointer transition"
          title="Clear all annotations"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => setIsVisible((v) => !v)}
          className={`p-1.5 rounded-lg transition cursor-pointer ${
            isVisible
              ? 'text-indigo-600 dark:text-indigo-400'
              : 'text-slate-400 hover:text-slate-600'
          }`}
          title={isVisible ? 'Hide annotations' : 'Show annotations'}
        >
          {isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
        </button>

        <div className="w-px h-4 bg-slate-200 dark:border-slate-800 mx-0.5" />

        {/* Exit Annotation Mode */}
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-600 hover:text-rose-600 dark:text-slate-300 dark:hover:text-rose-400 font-medium rounded-xl transition cursor-pointer"
          title="Close Annotation Markup"
        >
          <X className="w-3.5 h-3.5" />
          <span>Exit</span>
        </button>
      </div>

      {/* Transparent Annotation Canvas Overlay over note area only */}
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="w-full h-full pointer-events-auto cursor-crosshair touch-none bg-transparent"
        style={{ touchAction: 'none' }}
      />
    </div>,
    document.body
  );
}
