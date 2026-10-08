import { useState, useRef, useEffect, useCallback } from 'react';
import { Modal } from '../ui/Modal';
import { 
  RotateCw, 
  FlipHorizontal, 
  FlipVertical, 
  Check, 
  RotateCcw, 
  Crop,
} from 'lucide-react';

interface ImageCropModalProps {
  isOpen: boolean;
  file: File | null;
  onClose: () => void;
  onConfirm: (croppedFile: File) => void;
}

interface CropRect {
  x: number; // 0 to 1 relative
  y: number;
  width: number;
  height: number;
}

export function ImageCropModal({
  isOpen,
  file,
  onClose,
  onConfirm,
}: ImageCropModalProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [rotation, setRotation] = useState<number>(0); // 0, 90, 180, 270
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [aspectPreset, setAspectPreset] = useState<'free' | '1:1' | '4:3' | '16:9'>('free');

  // Normalized crop coordinates [0, 1] relative to the displayed image area
  const [crop, setCrop] = useState<CropRect>({ x: 0.05, y: 0.05, width: 0.9, height: 0.9 });
  const [isDragging, setIsDragging] = useState<string | null>(null); // 'move' or handle name

  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const dragStartRef = useRef<{ clientX: number; clientY: number; initialCrop: CropRect }>({
    clientX: 0,
    clientY: 0,
    initialCrop: { x: 0.05, y: 0.05, width: 0.9, height: 0.9 },
  });

  // Load image object URL
  useEffect(() => {
    if (!file) {
      setImageSrc(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setImageSrc(url);
    // Reset transforms
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
    setAspectPreset('free');
    setCrop({ x: 0.05, y: 0.05, width: 0.9, height: 0.9 });

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const handleRotate = () => {
    setRotation((r) => (r + 90) % 360);
  };

  const handleFlipHorizontal = () => {
    setFlipH((f) => !f);
  };

  const handleFlipVertical = () => {
    setFlipV((f) => !f);
  };

  const handleReset = () => {
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
    setAspectPreset('free');
    setCrop({ x: 0.05, y: 0.05, width: 0.9, height: 0.9 });
  };

  // Adjust crop when aspect ratio preset changes
  const applyAspectPreset = (preset: 'free' | '1:1' | '4:3' | '16:9') => {
    setAspectPreset(preset);
    if (preset === 'free') return;

    let targetRatio = 1;
    if (preset === '1:1') targetRatio = 1;
    if (preset === '4:3') targetRatio = 4 / 3;
    if (preset === '16:9') targetRatio = 16 / 9;

    const img = imgRef.current;
    if (!img) return;

    const imgAspect = (img.naturalWidth || 1) / (img.naturalHeight || 1);
    // target width/height relative to image aspect
    const relativeTargetAspect = targetRatio / imgAspect;

    let w = 0.8;
    let h = w / relativeTargetAspect;
    if (h > 0.9) {
      h = 0.8;
      w = h * relativeTargetAspect;
    }

    setCrop({
      x: Math.max(0, (1 - w) / 2),
      y: Math.max(0, (1 - h) / 2),
      width: Math.min(1, w),
      height: Math.min(1, h),
    });
  };

  // Drag handles logic
  const handlePointerDown = (type: string, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(type);
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      initialCrop: { ...crop },
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !imgRef.current) return;

    const imgRect = imgRef.current.getBoundingClientRect();
    if (imgRect.width === 0 || imgRect.height === 0) return;

    const dx = (e.clientX - dragStartRef.current.clientX) / imgRect.width;
    const dy = (e.clientY - dragStartRef.current.clientY) / imgRect.height;
    const init = dragStartRef.current.initialCrop;

    let newCrop = { ...init };

    if (isDragging === 'move') {
      newCrop.x = Math.max(0, Math.min(1 - init.width, init.x + dx));
      newCrop.y = Math.max(0, Math.min(1 - init.height, init.y + dy));
    } else {
      // Resize corners / edges
      if (isDragging.includes('e')) {
        newCrop.width = Math.max(0.1, Math.min(1 - init.x, init.width + dx));
      }
      if (isDragging.includes('s')) {
        newCrop.height = Math.max(0.1, Math.min(1 - init.y, init.height + dy));
      }
      if (isDragging.includes('w')) {
        const potentialW = init.width - dx;
        if (potentialW >= 0.1 && init.x + dx >= 0) {
          newCrop.x = init.x + dx;
          newCrop.width = potentialW;
        }
      }
      if (isDragging.includes('n')) {
        const potentialH = init.height - dy;
        if (potentialH >= 0.1 && init.y + dy >= 0) {
          newCrop.y = init.y + dy;
          newCrop.height = potentialH;
        }
      }
    }

    setCrop(newCrop);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      setIsDragging(null);
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Ignored
      }
    }
  };

  // Execute crop and transformations on a canvas and return new File
  const handleApply = useCallback(() => {
    if (!file || !imageSrc) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageSrc;
    img.onload = () => {
      const origW = img.naturalWidth;
      const origH = img.naturalHeight;

      // 1. Setup intermediate canvas for rotation & flipping
      const transformCanvas = document.createElement('canvas');
      const tCtx = transformCanvas.getContext('2d');
      if (!tCtx) return;

      const isSideways = rotation === 90 || rotation === 270;
      transformCanvas.width = isSideways ? origH : origW;
      transformCanvas.height = isSideways ? origW : origH;

      tCtx.translate(transformCanvas.width / 2, transformCanvas.height / 2);
      tCtx.rotate((rotation * Math.PI) / 180);
      tCtx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
      tCtx.drawImage(img, -origW / 2, -origH / 2);

      // 2. Crop from transformed canvas
      const tw = transformCanvas.width;
      const th = transformCanvas.height;

      const cropX = Math.round(crop.x * tw);
      const cropY = Math.round(crop.y * th);
      const cropW = Math.max(1, Math.round(crop.width * tw));
      const cropH = Math.max(1, Math.round(crop.height * th));

      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = cropW;
      cropCanvas.height = cropH;
      const cCtx = cropCanvas.getContext('2d');
      if (!cCtx) return;

      cCtx.drawImage(
        transformCanvas,
        cropX, cropY, cropW, cropH,
        0, 0, cropW, cropH
      );

      cropCanvas.toBlob(
        (blob) => {
          if (!blob) {
            onConfirm(file);
            return;
          }
          const croppedFile = new File([blob], file.name.replace(/\.[^/.]+$/, '') + '.png', {
            type: 'image/png',
          });
          onConfirm(croppedFile);
        },
        'image/png',
        0.95
      );
    };
  }, [file, imageSrc, rotation, flipH, flipV, crop, onConfirm]);

  if (!isOpen || !file) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit & Crop Image"
      maxWidth="max-w-2xl"
    >
      <div className="flex flex-col gap-4">
        {/* Transform Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
          {/* Quick Tools */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleRotate}
              className="p-1.5 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center gap-1 cursor-pointer transition"
              title="Rotate 90° clockwise"
            >
              <RotateCw className="w-4 h-4" />
              <span className="hidden sm:inline">Rotate</span>
            </button>
            <button
              type="button"
              onClick={handleFlipHorizontal}
              className={`p-1.5 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center gap-1 cursor-pointer transition ${
                flipH ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400' : ''
              }`}
              title="Flip Horizontal"
            >
              <FlipHorizontal className="w-4 h-4" />
              <span className="hidden sm:inline">Flip H</span>
            </button>
            <button
              type="button"
              onClick={handleFlipVertical}
              className={`p-1.5 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center gap-1 cursor-pointer transition ${
                flipV ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400' : ''
              }`}
              title="Flip Vertical"
            >
              <FlipVertical className="w-4 h-4" />
              <span className="hidden sm:inline">Flip V</span>
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="p-1.5 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1 cursor-pointer transition"
              title="Reset transformations"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          </div>

          {/* Aspect Ratio Presets */}
          <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
            {(['free', '1:1', '4:3', '16:9'] as const).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => applyAspectPreset(preset)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer transition ${
                  aspectPreset === preset
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        {/* Crop Workspace Canvas / Container */}
        <div
          ref={containerRef}
          className="relative w-full h-[360px] sm:h-[420px] bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center select-none"
        >
          {imageSrc && (
            <div
              className="relative max-w-full max-h-full inline-flex items-center justify-center"
              style={{
                transform: `rotate(${rotation}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`,
                transition: 'transform 0.15s ease-out',
              }}
            >
              <img
                ref={imgRef}
                src={imageSrc}
                alt="Crop preview"
                className="max-h-[340px] sm:max-h-[390px] max-w-full w-auto object-contain block pointer-events-none"
                draggable={false}
              />

              {/* Crop Overlay Area */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  transform: `scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1}) rotate(${-rotation}deg)`,
                }}
              >
                {/* Darkened mask around the crop box */}
                <div
                  className="absolute border-2 border-indigo-500 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] pointer-events-auto cursor-move"
                  style={{
                    left: `${crop.x * 100}%`,
                    top: `${crop.y * 100}%`,
                    width: `${crop.width * 100}%`,
                    height: `${crop.height * 100}%`,
                  }}
                  onPointerDown={(e) => handlePointerDown('move', e)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                >
                  {/* Grid Lines inside crop box */}
                  <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
                    <div className="border-r border-b border-indigo-400/30" />
                    <div className="border-r border-b border-indigo-400/30" />
                    <div className="border-b border-indigo-400/30" />
                    <div className="border-r border-b border-indigo-400/30" />
                    <div className="border-r border-b border-indigo-400/30" />
                    <div className="border-b border-indigo-400/30" />
                    <div className="border-r border-indigo-400/30" />
                    <div className="border-r border-indigo-400/30" />
                    <div />
                  </div>

                  {/* Corner Handles */}
                  <div
                    className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-indigo-600 rounded-full cursor-nwse-resize pointer-events-auto shadow-xs"
                    onPointerDown={(e) => handlePointerDown('nw', e)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                  />
                  <div
                    className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-indigo-600 rounded-full cursor-nesw-resize pointer-events-auto shadow-xs"
                    onPointerDown={(e) => handlePointerDown('ne', e)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                  />
                  <div
                    className="absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-indigo-600 rounded-full cursor-nesw-resize pointer-events-auto shadow-xs"
                    onPointerDown={(e) => handlePointerDown('sw', e)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                  />
                  <div
                    className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-indigo-600 rounded-full cursor-nwse-resize pointer-events-auto shadow-xs"
                    onPointerDown={(e) => handlePointerDown('se', e)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="text-slate-400 flex items-center gap-1.5">
            <Crop className="w-3.5 h-3.5 text-indigo-500" />
            <span>Drag corners to crop, or drag inside box to reposition</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition font-medium cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() => onConfirm(file)}
              className="px-3 py-1.5 text-slate-700 dark:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg transition font-medium cursor-pointer"
              title="Insert the original image without cropping"
            >
              Insert Original
            </button>

            <button
              type="button"
              onClick={handleApply}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition font-medium flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Apply & Insert</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
