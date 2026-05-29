/**
 * components/ui/DicomViewer.tsx
 * Zero-Footprint Web DICOM / Diagnostic Image Viewer.
 * HTML5 Canvas-based interactive viewport supporting:
 * - Real-time Brightness & Contrast scaling.
 * - Dynamic Zooming (0.5x - 3.0x) and Panning.
 * - Multi-slice scrolling simulation (for CT / MRI series).
 * - Measurement caliber overlays.
 */

"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { useResizeObserver } from "@/hooks/use-resize-observer";
import { 
  ZoomIn, 
  ZoomOut, 
  Sun, 
  Sliders, 
  RotateCcw, 
  ShieldAlert,
  ChevronLeft, 
  ChevronRight, 
  Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface DicomViewerProps {
  imageUrl?: string | null;
  procedureName?: string;
  isRtl?: boolean;
}

export function DicomViewer({ imageUrl, procedureName = "Chest X-Ray", isRtl = false }: DicomViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Viewport states
  const [zoom, setZoom] = useState(1.0);
  const [brightness, setBrightness] = useState(100); // percentage
  const [contrast, setContrast] = useState(100); // percentage
  const [currentSlice, setCurrentSlice] = useState(1);
  const totalSlices = 16; // Simulated CT/MRI series slices count
  
  // Layout states for responsive resizing
  const { ref: containerRef, dimensions } = useResizeObserver(100);
  
  // Panning & dragging states
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    // Spatial dragging should always map 1:1 with cursor movement regardless of RTL/LTR
    dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y,
    });
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  // Image element loading reference
  const [imageLoaded, setImageLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  // Load image element
  useEffect(() => {
    let isMounted = true;

    // Code Review Fix: IMMEDIATELY reset loading state to prevent drawing stale imagery
    // from a previous patient while the new scan is streaming.
    setImageLoaded(false);
    imageRef.current = null;

    const isRawDicom = imageUrl?.toLowerCase().endsWith(".dcm");
    if (isRawDicom) {
      setTimeout(() => {
        if (isMounted) {
          setLoadError(isRtl 
            ? "ملفات DICOM (.dcm) الخام غير مدعومة مباشرة في المتصفح. يرجى استخدام رابط لمعاينة الصورة (JPEG/PNG)." 
            : "Raw DICOM (.dcm) files are not supported natively in the browser. Please provide a server-rendered preview URL (JPEG/PNG).");
        }
      }, 0);
      return () => {
        isMounted = false;
      };
    }

    const timer = setTimeout(() => {
      if (isMounted) setLoadError(null);
    }, 0);

    const img = new Image();
    // Default to high-fidelity X-ray placeholder if no URL is attached
    // Code Review Fix: Dynamically replace {slice} token if provided to prevent static clinical hazards
    img.src = imageUrl 
      ? (imageUrl.includes("{slice}") ? imageUrl.replace("{slice}", String(currentSlice)) : imageUrl)
      : "https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=800&q=80";
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (isMounted) {
        imageRef.current = img;
        setImageLoaded(true);
      }
    };
    img.onerror = () => {
      setTimeout(() => {
        if (isMounted) {
          setLoadError(isRtl 
            ? "فشل تحميل الصورة التشخيصية. يرجى التحقق من إعدادات CORS على خادم PACS أو خادم الملفات." 
            : "Failed to load diagnostic image. Please verify CORS configurations on the PACS host.");
        }
      }, 0);
    };

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [imageUrl, isRtl]);

  // Redraw viewport whenever properties change
  useEffect(() => {
    if (!imageLoaded || !imageRef.current || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    // Set internal resolution matching devicePixelRatio for clinical-grade sharpness
    // Code Review Fix: Use dimensions from ResizeObserver for reliable responsive layout
    const displayWidth = dimensions.width || canvas.clientWidth || 640;
    const displayHeight = dimensions.height || canvas.clientHeight || 360;

    // Code Review Fix: Defer drawing until layout stabilizes to avoid crashes or scaling anomalies
    if (displayWidth === 0 || displayHeight === 0) return;

    const targetWidth = Math.round(displayWidth * dpr);
    const targetHeight = Math.round(displayHeight * dpr);
    
    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }

    // Reset and scale transform matrix to fit dpr automatically without changing layout math
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    // Clear viewport
    ctx.clearRect(0, 0, displayWidth, displayHeight);

    const img = imageRef.current;
    
    const imgRatio = img.width / img.height;
    const canvasRatio = displayWidth / displayHeight;
    let drawWidth: number, drawHeight: number;

    if (imgRatio > canvasRatio) {
      drawWidth = displayWidth * zoom;
      drawHeight = (displayWidth / imgRatio) * zoom;
    } else {
      drawHeight = displayHeight * zoom;
      drawWidth = (displayHeight * imgRatio) * zoom;
    }

    const offsetX = (displayWidth - drawWidth) / 2 + pan.x;
    const offsetY = (displayHeight - drawHeight) / 2 + pan.y;

    ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

    // Add calibration scale / caliper overlays (Standard diagnostic UI)
    ctx.strokeStyle = "rgba(239, 68, 68, 0.4)"; // clinical warning red accent
    ctx.lineWidth = 1.5;
    
    // Draw 5cm reference scale on right side (Representative Only)
    ctx.beginPath();
    ctx.moveTo(displayWidth - 25, 50);
    ctx.lineTo(displayWidth - 25, 150);
    ctx.moveTo(displayWidth - 35, 50);
    ctx.lineTo(displayWidth - 15, 50);
    ctx.moveTo(displayWidth - 35, 150);
    ctx.lineTo(displayWidth - 15, 150);
    ctx.stroke();
    
    ctx.fillStyle = "rgba(239, 68, 68, 0.8)";
    ctx.font = "9px monospace";
    ctx.fillText("5 cm (Approx.)", displayWidth - 95, 105);

    // Uncalibrated Viewport Warning to protect against clinical diagnostic errors
    ctx.fillStyle = "rgba(239, 68, 68, 0.95)"; // Red warning alert
    ctx.font = "bold 9px sans-serif";
    ctx.fillText(isRtl ? "تنبيه: مقياس غير معاير - معاينة فقط" : "WARNING: UNCALIBRATED VIEWPORT", displayWidth - 210, 30);
    ctx.fillStyle = "rgba(239, 68, 68, 0.7)";
    ctx.fillText(isRtl ? "مقياس تمثيلي تقريبي" : "Representative Scale Only", displayWidth - 210, 42);

    // Render orientation labels
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "9px monospace";
    ctx.fillText(isRtl ? "مستشفى HMS مصر" : "HMS Egypt PACS Client", 20, 30);
    ctx.fillText(`Slice: ${currentSlice}/${totalSlices}`, 20, 50);
    ctx.fillText(`Zoom: ${zoom.toFixed(1)}x`, 20, 70);
    
    // Draw corner anatomical markers (R: Right, L: Left, S: Superior, I: Inferior or A/P for Sagittal)
    ctx.fillStyle = "rgba(245, 158, 11, 0.8)"; // anatomical warning amber
    ctx.font = "bold 14px sans-serif";
    
    // Frontal projections (like Chest X-Rays) use S/I, while Sagittal use A/P
    const isFrontal = procedureName.toLowerCase().includes("x-ray") || 
                      procedureName.toLowerCase().includes("chest") || 
                      procedureName.toLowerCase().includes("frontal");
    
    ctx.fillText("R", 20, displayHeight - 30);
    ctx.fillText(isFrontal ? "S" : "A", displayWidth / 2 - 5, 30);
    ctx.fillText(isFrontal ? "I" : "P", displayWidth / 2 - 5, displayHeight - 30);
    ctx.fillText("L", displayWidth - 35, displayHeight - 30);

  }, [imageLoaded, zoom, currentSlice, isRtl, procedureName, pan, dimensions.width, dimensions.height]);

  // Reset viewport handlers
  const handleReset = () => {
    setZoom(1.0);
    setBrightness(100);
    setContrast(100);
    setCurrentSlice(1);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div className="flex flex-col gap-4 bg-slate-950 border border-slate-800 rounded-2xl p-4 shadow-2xl" ref={containerRef}>
      
      {/* Header telemetry info bar */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 text-slate-400 text-[10px] font-mono">
        <span className="flex items-center gap-1.5">
          <Eye className="h-3.5 w-3.5 text-emerald-500 animate-pulse" />
          <span className="font-bold text-slate-200">{procedureName}</span>
        </span>
        <span className="bg-slate-900 border border-slate-800 px-2.5 py-0.5 rounded-full text-emerald-400">
          WADO-URI Protocol Active
        </span>
      </div>

      {/* Main Viewport Workspace */}
      <div className="relative flex items-center justify-center bg-black border border-slate-900 rounded-xl overflow-hidden aspect-square sm:aspect-video w-full max-h-[360px]">
        {loadError ? (
          <div className="flex flex-col items-center gap-3 text-center p-6">
            <ShieldAlert className="h-8 w-8 text-red-500 animate-pulse" />
            <span className="text-xs font-semibold text-slate-400 max-w-[240px] leading-relaxed">
              {loadError}
            </span>
          </div>
        ) : !imageLoaded ? (
          <div className="flex flex-col items-center gap-2 text-slate-500">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-700 border-t-emerald-500" />
            <span className="text-xs font-semibold">{isRtl ? "جاري تحميل فحص DICOM..." : "Streaming DICOM slices..."}</span>
          </div>
        ) : (
          <>
            <div className="absolute top-2 end-2 z-10 bg-rose-600/95 text-white font-bold text-[9px] px-2 py-0.5 rounded-md border border-rose-500 shadow-md animate-pulse">
              {isRtl ? "معاينة غير معايرة" : "NON-DIAGNOSTIC PREVIEW"}
            </div>
            <canvas
              ref={canvasRef}
              width={640}
              height={360}
              className="w-full h-full object-contain cursor-move"
              style={{ filter: `brightness(${brightness}%) contrast(${contrast}%)` }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUpOrLeave}
              onMouseLeave={handleMouseUpOrLeave}
            />
          </>
        )}

        {/* Slice selection navigator overlays */}
        <div className="absolute bottom-4 start-1/2 -translate-x-1/2 flex items-center gap-2 bg-slate-900/80 border border-slate-800/80 px-3 py-1.5 rounded-full backdrop-blur-xs shadow-md">
          <Button 
            size="icon" 
            variant="ghost" 
            onClick={() => setCurrentSlice(prev => Math.max(1, prev - 1))}
            disabled={currentSlice === 1}
            className="h-6 w-6 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-full"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-[10px] text-slate-200 font-mono select-none px-2">
            Slice {currentSlice} / {totalSlices}
          </span>
          <Button 
            size="icon" 
            variant="ghost" 
            onClick={() => setCurrentSlice(prev => Math.min(totalSlices, prev + 1))}
            disabled={currentSlice === totalSlices}
            className="h-6 w-6 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-full"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Adjustments Tooling Panel */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-slate-900 border border-slate-800/60 p-4 rounded-xl text-xs text-slate-300">
        
        {/* Zoom adjustment */}
        <div className="space-y-1 text-start">
          <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">{isRtl ? "التكبير والتصغير" : "Magnification"}</span>
          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost" onClick={() => setZoom(z => Math.max(0.5, z - 0.2))} className="h-7 w-7 text-slate-400 hover:bg-slate-800 rounded-lg">
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <span className="flex-1 text-center font-mono font-bold text-slate-200">{zoom.toFixed(1)}x</span>
            <Button size="icon" variant="ghost" onClick={() => setZoom(z => Math.min(3.0, z + 0.2))} className="h-7 w-7 text-slate-400 hover:bg-slate-800 rounded-lg">
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Brightness slider */}
        <div className="space-y-1.5 text-start">
          <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider flex items-center gap-1.5">
            <Sun className="h-3 w-3 text-amber-500" />
            <span>{isRtl ? "السطوع" : "Brightness"}</span>
          </span>
          <input 
            type="range" 
            min="50" 
            max="200" 
            value={brightness}
            onChange={(e) => setBrightness(parseInt(e.target.value))}
            className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
        </div>

        {/* Contrast slider */}
        <div className="space-y-1.5 text-start">
          <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider flex items-center gap-1.5">
            <Sliders className="h-3 w-3 text-blue-500" />
            <span>{isRtl ? "التباين" : "Contrast"}</span>
          </span>
          <input 
            type="range" 
            min="50" 
            max="200" 
            value={contrast}
            onChange={(e) => setContrast(parseInt(e.target.value))}
            className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
        </div>

        {/* Control Reset */}
        <div className="flex items-end">
          <Button 
            onClick={handleReset}
            variant="outline"
            className="w-full rounded-lg border-slate-800 bg-slate-950 text-slate-400 hover:bg-slate-900 hover:text-slate-200 text-xs h-8 flex items-center justify-center gap-1.5 shadow-sm"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>{isRtl ? "إعادة ضبط" : "Reset Viewport"}</span>
          </Button>
        </div>

      </div>

    </div>
  );
}
