import { useState, useEffect, useRef, useCallback } from 'react';
import { getStroke } from 'perfect-freehand';
import { supabase } from '../../lib/supabase';
import { 
  Pen, 
  Highlighter, 
  Eraser, 
  RotateCcw, 
  RotateCw, 
  Trash2, 
  Maximize2, 
  Minimize2,
  Loader2,
  Check
} from 'lucide-react';

export interface StrokePoint {
  0: number; // x
  1: number; // y
  2?: number; // pressure
}

export interface StrokeData {
  points: [number, number, number?][];
  color: string;
  size: number;
  tool: 'pen' | 'highlighter' | 'eraser';
}

interface DrawingCanvasProps {
  drawingId: string;
  noteId?: string;
  readOnly?: boolean;
}

const LOGICAL_WIDTH = 1200;
const LOGICAL_HEIGHT = 800;

const COLOR_PRESETS = [
  '#000000', // Black
  '#ef4444', // Red
  '#3b82f6', // Blue
  '#10b981', // Green
  '#f59e0b', // Amber/Yellow
  '#8b5cf6', // Purple
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

export function DrawingCanvas({ drawingId, readOnly = false }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Drawing state
  const [strokes, setStrokes] = useState<StrokeData[]>([]);
  const [history, setHistory] = useState<StrokeData[][]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [currentTool, setCurrentTool] = useState<'pen' | 'highlighter' | 'eraser'>('pen');
  const [color, setColor] = useState<string>('#000000');
  const [size, setSize] = useState<number>(4);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Palm rejection tracking: if stylus/pen detected, reject touch
  const penDetectedRef = useRef<boolean>(false);
  const isDrawingRef = useRef<boolean>(false);
  const currentStrokeRef = useRef<StrokeData | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Load initial drawing strokes from database
  useEffect(() => {
    let isMounted = true;
    async function loadDrawing() {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('drawings')
          .select('*')
          .eq('id', drawingId)
          .single();

        if (error) throw error;
        if (data && isMounted) {
          const loadedStrokes = (data.strokes as unknown as StrokeData[]) || [];
          setStrokes(loadedStrokes);
          setHistory([loadedStrokes]);
          setHistoryIndex(0);
        }
      } catch (err) {
        console.error('Failed to load drawing:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadDrawing();
    return () => {
      isMounted = false;
    };
  }, [drawingId]);

  // 2. Realtime sync subscription for collaborative drawings
  useEffect(() => {
    const channel = supabase
      .channel(`drawing-${drawingId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'drawings',
          filter: `id=eq.${drawingId}`,
        },
        (payload) => {
          if (!isDrawingRef.current && payload.new) {
            const remoteStrokes = (payload.new.strokes as unknown as StrokeData[]) || [];
            setStrokes(remoteStrokes);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [drawingId]);

  // 3. Debounced save to Supabase (1000 ms per ARCHITECTURE.md 7.4)
  const triggerDebouncedSave = useCallback(
    (newStrokes: StrokeData[]) => {
      if (readOnly) return;
      setIsSaving(true);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

      saveTimeoutRef.current = setTimeout(async () => {
        try {
          await supabase
            .from('drawings')
            .update({ strokes: newStrokes as any })
            .eq('id', drawingId);
        } catch (err) {
          console.error('Failed to save drawing strokes:', err);
        } finally {
          setIsSaving(false);
        }
      }, 1000);
    },
    [drawingId, readOnly]
  );

  // 4. Render strokes on canvas
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    // Draw all completed strokes + current in-progress stroke
    const allStrokes = currentStrokeRef.current
      ? [...strokes, currentStrokeRef.current]
      : strokes;

    for (const stroke of allStrokes) {
      if (!stroke.points.length) continue;

      const strokePoints = stroke.points.map(([x, y, p]) => [x, y, p ?? 0.5]);
      const outline = getStroke(strokePoints, {
        size: stroke.size * (stroke.tool === 'highlighter' ? 3.5 : 1),
        thinning: stroke.tool === 'highlighter' ? 0 : 0.5,
        smoothing: 0.5,
        streamline: 0.5,
      });

      const pathData = getSvgPathFromStroke(outline);
      if (!pathData) continue;

      const path = new Path2D(pathData);

      ctx.save();
      if (stroke.tool === 'highlighter') {
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = stroke.color;
      } else {
        ctx.globalAlpha = 1;
        ctx.fillStyle = stroke.color;
      }

      ctx.fill(path);
      ctx.restore();
    }
  }, [strokes]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // 5. Logical Coordinate Mapping
  const getLogicalPoint = (e: React.PointerEvent<HTMLCanvasElement>): [number, number, number] => {
    const canvas = canvasRef.current;
    if (!canvas) return [0, 0, 0.5];
    const rect = canvas.getBoundingClientRect();
    const scaleX = LOGICAL_WIDTH / rect.width;
    const scaleY = LOGICAL_HEIGHT / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const pressure = e.pressure !== undefined && e.pressure > 0 ? e.pressure : 0.5;

    return [x, y, pressure];
  };

  // Check if point touches a stroke (for eraser)
  const isPointNearStroke = (x: number, y: number, stroke: StrokeData, radius: number = 15): boolean => {
    return stroke.points.some(([px, py]) => {
      const dx = px - x;
      const dy = py - y;
      return Math.sqrt(dx * dx + dy * dy) <= radius + stroke.size;
    });
  };

  // 6. Pointer event handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (readOnly) return;

    // Palm rejection
    if (e.pointerType === 'pen') {
      penDetectedRef.current = true;
    } else if (e.pointerType === 'touch' && penDetectedRef.current) {
      return; // Ignore touch if stylus is active
    }

    const [x, y, pressure] = getLogicalPoint(e);
    isDrawingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    if (currentTool === 'eraser') {
      // Erase strokes touching this point
      const filtered = strokes.filter((s) => !isPointNearStroke(x, y, s));
      if (filtered.length !== strokes.length) {
        setStrokes(filtered);
      }
    } else {
      currentStrokeRef.current = {
        tool: currentTool,
        color: currentTool === 'highlighter' && color === '#000000' ? '#f59e0b' : color,
        size,
        points: [[x, y, pressure]],
      };
      renderCanvas();
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || readOnly) return;
    if (e.pointerType === 'touch' && penDetectedRef.current) return;

    const [x, y, pressure] = getLogicalPoint(e);

    if (currentTool === 'eraser') {
      const filtered = strokes.filter((s) => !isPointNearStroke(x, y, s));
      if (filtered.length !== strokes.length) {
        setStrokes(filtered);
      }
    } else if (currentStrokeRef.current) {
      currentStrokeRef.current.points.push([x, y, pressure]);
      renderCanvas();
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || readOnly) return;
    isDrawingRef.current = false;

    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    if (currentTool === 'eraser') {
      // Record history & trigger save
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(strokes);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
      triggerDebouncedSave(strokes);
    } else if (currentStrokeRef.current) {
      const newStrokes = [...strokes, currentStrokeRef.current];
      currentStrokeRef.current = null;
      setStrokes(newStrokes);

      // Record history
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(newStrokes);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);

      triggerDebouncedSave(newStrokes);
    }
  };

  // 7. Undo, Redo, Clear
  const handleUndo = () => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      setStrokes(prev);
      triggerDebouncedSave(prev);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      setStrokes(next);
      triggerDebouncedSave(next);
    }
  };

  const handleClear = () => {
    if (strokes.length === 0) return;
    setStrokes([]);
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push([]);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    triggerDebouncedSave([]);
  };

  return (
    <div
      ref={containerRef}
      className={`relative my-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden select-none transition-all ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none border-0' : 'w-full'
      }`}
    >
      {/* Top Toolbar */}
      {!readOnly && (
        <div className="flex flex-wrap items-center justify-between gap-2 p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-xs text-xs">
          {/* Tools & Colors */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Tool buttons */}
            <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setCurrentTool('pen')}
                className={`p-1.5 rounded-md transition cursor-pointer ${
                  currentTool === 'pen'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
                title="Pen"
              >
                <Pen className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setCurrentTool('highlighter')}
                className={`p-1.5 rounded-md transition cursor-pointer ${
                  currentTool === 'highlighter'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
                title="Highlighter"
              >
                <Highlighter className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setCurrentTool('eraser')}
                className={`p-1.5 rounded-md transition cursor-pointer ${
                  currentTool === 'eraser'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
                title="Stroke Eraser"
              >
                <Eraser className="w-4 h-4" />
              </button>
            </div>

            {/* Color Palette */}
            {currentTool !== 'eraser' && (
              <div className="flex items-center gap-1 px-1 bg-white dark:bg-slate-800 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className="w-5 h-5 rounded-full border border-black/10 dark:border-white/10 transition-transform flex items-center justify-center cursor-pointer"
                    style={{ backgroundColor: c }}
                  >
                    {color === c && (
                      <Check
                        className={`w-3 h-3 ${
                          c === '#f59e0b' || c === '#ffffff' ? 'text-black' : 'text-white'
                        }`}
                      />
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Stroke Size Slider */}
            <div className="flex items-center gap-1.5 px-2 bg-white dark:bg-slate-800 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] text-slate-400 font-medium">Size</span>
              <input
                type="range"
                min="2"
                max="24"
                value={size}
                onChange={(e) => setSize(Number(e.target.value))}
                className="w-16 h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>
          </div>

          {/* Actions & Utilities */}
          <div className="flex items-center gap-1">
            {isSaving ? (
              <span className="text-[11px] text-indigo-500 flex items-center gap-1 mr-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span className="hidden sm:inline">Saving</span>
              </span>
            ) : null}

            <button
              type="button"
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700 disabled:opacity-40 cursor-pointer"
              title="Undo"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700 disabled:opacity-40 cursor-pointer"
              title="Redo"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleClear}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer transition"
              title="Clear all strokes"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setIsFullscreen((f) => !f)}
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700 cursor-pointer transition"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Canvas'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}

      {/* Canvas Drawing Area */}
      <div className="relative w-full aspect-3/2 bg-white dark:bg-slate-950 flex items-center justify-center overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center gap-2 text-slate-400 text-xs">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            <span>Loading canvas...</span>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            width={LOGICAL_WIDTH}
            height={LOGICAL_HEIGHT}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="w-full h-full object-contain cursor-crosshair touch-none"
            style={{ touchAction: 'none' }}
          />
        )}
      </div>
    </div>
  );
}
