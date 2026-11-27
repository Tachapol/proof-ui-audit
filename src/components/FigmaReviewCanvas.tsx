'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Columns2,
  Copy,
  Maximize2,
  Minus,
  Monitor,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Square,
  Tablet,
  XCircle,
} from 'lucide-react';
import type { AutoIterationResult, IterationSnapshot } from '@/lib/checklist/types';

type ViewportPreset = 'desktop' | 'tablet' | 'mobile';
type CompareMode = 'split' | 'slider' | 'after';

interface FigmaReviewCanvasProps {
  selectedPage: string;
  result: AutoIterationResult;
  selectedIter: number;
  onSelectIter: (iter: number) => void;
  approvedIter: number | null;
  savedApprovalInfo: { label: string; score: string; approvedAt: string } | null;
  onApprove: (snapshot: IterationSnapshot) => Promise<void> | void;
  onCopyHtml: () => void;
  copied: boolean;
  onBackToPriorities: () => void;
  onOpenChecklistTab: () => void;
  injectHighlightCss: (html: string, selectors: string[]) => string;
}

export function FigmaReviewCanvas({
  selectedPage,
  result,
  selectedIter,
  onSelectIter,
  approvedIter,
  savedApprovalInfo,
  onApprove,
  onCopyHtml,
  copied,
  onBackToPriorities,
  onOpenChecklistTab,
  injectHighlightCss,
}: FigmaReviewCanvasProps) {
  const baselineSnapshot = result.iterations[0];
  const activeSnapshot = result.iterations[selectedIter] || baselineSnapshot;

  const [viewportPreset, setViewportPreset] = useState<ViewportPreset>('desktop');
  const [frameWidth, setFrameWidth] = useState<number>(1280);
  const [frameHeight, setFrameHeight] = useState<number>(920);
  const [compareMode, setCompareMode] = useState<CompareMode>('split');
  const [spacePressed, setSpacePressed] = useState(false);

  const [zoom, setZoom] = useState<number>(0.7);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 40, y: 12 });
  const [sliderPct, setSliderPct] = useState<number>(50);

  const [leftOpen, setLeftOpen] = useState<boolean>(true);
  const [rightOpen, setRightOpen] = useState<boolean>(true);
  const [highlightedMetricId, setHighlightedMetricId] = useState<string | null>(null);

  const viewportRef = useRef<HTMLDivElement>(null);
  const sliderContainerRef = useRef<HTMLDivElement>(null);
  const beforeFrameRef = useRef<HTMLIFrameElement>(null);
  const afterFrameRef = useRef<HTMLIFrameElement>(null);
  const syncingScrollRef = useRef<boolean>(false);
  const dragStateRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const resizeStateRef = useRef<{
    axis: 'w' | 'h' | 'wh';
    startX: number;
    startY: number;
    origW: number;
    origH: number;
  } | null>(null);

  const [isPanning, setIsPanning] = useState(false);
  const [isSliding, setIsSliding] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  const isPanActive = spacePressed;

  const highlightSelectors = useMemo(() => {
    if (!highlightedMetricId || !activeSnapshot) return [];
    const item = activeSnapshot.summary.items.find((i) => i.id === highlightedMetricId);
    return item?.rawSelectors || [];
  }, [highlightedMetricId, activeSnapshot]);

  const highlightedItem = useMemo(() => {
    if (!highlightedMetricId || !activeSnapshot) return null;
    return activeSnapshot.summary.items.find((i) => i.id === highlightedMetricId) || null;
  }, [highlightedMetricId, activeSnapshot]);

  const remainingIssues = useMemo(() => {
    if (!activeSnapshot) return [];
    return activeSnapshot.summary.priorityList;
  }, [activeSnapshot]);

  const fitCanvasToView = useCallback(
    (targetW?: number) => {
      const el = viewportRef.current;
      if (!el) return;
      const leftPad = leftOpen ? 252 : 16;
      const rightPad = rightOpen ? 292 : 16;
      const availW = Math.max(320, el.clientWidth - leftPad - rightPad - 32);
      const availH = Math.max(360, el.clientHeight - 36);

      const w = targetW ?? frameWidth;
      const totalArtboardW =
        compareMode === 'split' && activeSnapshot.iteration !== 0 ? w * 2 + 32 : w;

      const nextZoom = Math.max(0.25, Math.min(1, Number((availW / totalArtboardW).toFixed(2))));
      const autoHeight = Math.max(720, Math.min(2400, Math.round((availH - 24) / nextZoom)));

      const renderedW = totalArtboardW * nextZoom;
      const centerX = leftPad + Math.max(12, (availW + 32 - renderedW) / 2);
      setZoom(nextZoom);
      setFrameHeight(autoHeight);
      setPan({ x: Math.round(centerX), y: 12 });
    },
    [frameWidth, compareMode, activeSnapshot.iteration, leftOpen, rightOpen]
  );

  useEffect(() => {
    fitCanvasToView();
  }, [fitCanvasToView]);

  const selectViewportPreset = (preset: ViewportPreset) => {
    setViewportPreset(preset);
    const width = preset === 'desktop' ? 1280 : preset === 'tablet' ? 768 : 375;
    setFrameWidth(width);
    fitCanvasToView(width);
  };

  const toggleOneToOneZoom = () => {
    if (Math.abs(zoom - 1) < 0.02) {
      fitCanvasToView();
    } else {
      const leftPad = leftOpen ? 256 : 20;
      setZoom(1);
      setPan({ x: leftPad, y: 12 });
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        setSpacePressed(true);
      } else if (e.key === 'Escape') {
        onBackToPriorities();
      } else if (e.key === '=' || e.key === '+') {
        setZoom((z) => Math.min(2, Number((z + 0.1).toFixed(2))));
      } else if (e.key === '-') {
        setZoom((z) => Math.max(0.25, Number((z - 0.1).toFixed(2))));
      } else if (e.key === '0') {
        fitCanvasToView();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpacePressed(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [fitCanvasToView, onBackToPriorities]);

  // Smooth global pointer tracking for Pan, Slider & Artboard Resizing so iframes never swallow drag events
  useEffect(() => {
    if (!isPanning && !isSliding && !isResizing) return;

    const onPointerMove = (e: PointerEvent) => {
      if (isPanning && dragStateRef.current) {
        const dx = e.clientX - dragStateRef.current.startX;
        const dy = e.clientY - dragStateRef.current.startY;
        setPan({ x: dragStateRef.current.origX + dx, y: dragStateRef.current.origY + dy });
      } else if (isSliding && sliderContainerRef.current) {
        const rect = sliderContainerRef.current.getBoundingClientRect();
        const pct = ((e.clientX - rect.left) / rect.width) * 100;
        setSliderPct(Math.max(0, Math.min(100, pct)));
      } else if (isResizing && resizeStateRef.current) {
        const { axis, startX, startY, origW, origH } = resizeStateRef.current;
        const dx = (e.clientX - startX) / zoom;
        const dy = (e.clientY - startY) / zoom;
        if (axis === 'w' || axis === 'wh') {
          setFrameWidth(Math.round(Math.max(280, Math.min(1920, origW + dx))));
        }
        if (axis === 'h' || axis === 'wh') {
          setFrameHeight(Math.round(Math.max(360, Math.min(2400, origH + dy))));
        }
      }
    };

    const onPointerUp = () => {
      dragStateRef.current = null;
      setIsPanning(false);
      setIsSliding(false);
      setIsResizing(false);
      resizeStateRef.current = null;
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [isPanning, isSliding, isResizing, zoom]);

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.08 : 0.08;
      setZoom((z) => Math.max(0.25, Math.min(2, Number((z + delta).toFixed(2)))));
    } else {
      // Scrolling outside iframes smoothly pans the canvas like Figma
      setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
    }
  };

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.button !== 1) return;
    e.preventDefault();
    dragStateRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: pan.x,
      origY: pan.y,
    };
    setIsPanning(true);
  };

  // Keep Before and After iframes synchronized on vertical & horizontal scroll (Slider + Split modes)
  const syncScrollFrom = useCallback((source: 'before' | 'after') => {
    if (syncingScrollRef.current) return;
    const beforeWin = beforeFrameRef.current?.contentWindow;
    const afterWin = afterFrameRef.current?.contentWindow;
    if (!beforeWin || !afterWin) return;
    const srcWin = source === 'before' ? beforeWin : afterWin;
    const dstWin = source === 'before' ? afterWin : beforeWin;
    syncingScrollRef.current = true;
    dstWin.scrollTo(srcWin.scrollX, srcWin.scrollY);
    requestAnimationFrame(() => {
      syncingScrollRef.current = false;
    });
  }, []);

  useEffect(() => {
    const beforeWin = beforeFrameRef.current?.contentWindow;
    const afterWin = afterFrameRef.current?.contentWindow;
    if (!beforeWin || !afterWin) return;

    const onBeforeScroll = () => syncScrollFrom('before');
    const onAfterScroll = () => syncScrollFrom('after');

    beforeWin.addEventListener('scroll', onBeforeScroll, { passive: true });
    afterWin.addEventListener('scroll', onAfterScroll, { passive: true });
    return () => {
      beforeWin.removeEventListener('scroll', onBeforeScroll);
      afterWin.removeEventListener('scroll', onAfterScroll);
    };
  });

  const startResize = (axis: 'w' | 'h' | 'wh', e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    resizeStateRef.current = {
      axis,
      startX: e.clientX,
      startY: e.clientY,
      origW: frameWidth,
      origH: frameHeight,
    };
    setIsResizing(true);
  };

  const afterHtml = useMemo(
    () => injectHighlightCss(activeSnapshot.html, highlightSelectors),
    [activeSnapshot.html, highlightSelectors, injectHighlightCss]
  );

  const showBaselineComparison =
    compareMode === 'split' && baselineSnapshot && activeSnapshot.iteration !== 0;

  const isInteractingBlocked = isPanActive || isSliding || isResizing;

  const renderResizeHandles = () => (
    <>
      {/* Right edge width resize */}
      <div
        onPointerDown={(e) => startResize('w', e)}
        title="Drag to resize width"
        className="absolute top-0 right-0 bottom-3 w-2 cursor-ew-resize hover:bg-[#0d99ff]/60 transition-colors z-20"
      />
      {/* Bottom edge height resize */}
      <div
        onPointerDown={(e) => startResize('h', e)}
        title="Drag to resize height"
        className="absolute bottom-0 left-0 right-3 h-2 cursor-ns-resize hover:bg-[#0d99ff]/60 transition-colors z-20"
      />
      {/* Corner resize */}
      <div
        onPointerDown={(e) => startResize('wh', e)}
        title="Drag to resize width & height"
        className="absolute bottom-0 right-0 w-3.5 h-3.5 cursor-nwse-resize bg-[#0d99ff]/80 rounded-tl z-30"
      />
    </>
  );

  return (
    <div className="fixed inset-0 !m-0 z-50 bg-[#1e1e1e] text-[#ececec] flex flex-col select-none">
      {/* Transparent drag shield while panning/sliding/resizing so iframes cannot capture pointer events */}
      {(isPanning || isSliding || isResizing) && (
        <div
          className={`fixed inset-0 z-[100] ${
            isPanning ? 'cursor-grabbing' : isSliding ? 'cursor-ew-resize' : 'cursor-nwse-resize'
          }`}
        />
      )}

      {/* Top Figma-style Toolbar */}
      <header className="figma-toolbar h-14 px-3.5 bg-[#2c2c2c] border-b border-white/[0.1] flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onBackToPriorities}
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-[#383838] hover:bg-[#444] text-[11px] font-medium text-white transition-colors"
          >
            <ArrowLeft className="w-3 h-3" />
            Priorities
          </button>
          <span className="text-[11px] font-mono text-[#b4b4b4] truncate max-w-[130px]" title={selectedPage}>
            {selectedPage}
          </span>
          <div className="hidden md:inline-flex items-center rounded-full bg-[#1e1e1e] p-0.5 border border-white/[0.08] gap-0.5">
            <span className="inline-flex items-center h-6 px-2.5 rounded-full text-[11px] leading-none bg-[#3f3f3f] text-white font-medium shadow-sm">
              Canvas
            </span>
            <button
              type="button"
              onClick={onOpenChecklistTab}
              className="inline-flex items-center h-6 px-2.5 rounded-full text-[11px] leading-none text-[#9b9b9b] hover:text-white transition-colors"
            >
              Checklist ({activeSnapshot.summary.totalPassed}/{activeSnapshot.summary.totalMetrics})
            </button>
          </div>
        </div>

        {/* Center Controls: Desktop / Tablet / Mobile Pill + Compare */}
        <div className="flex items-center gap-2 overflow-x-auto">
          <div className="inline-flex items-center rounded-full bg-[#1e1e1e] p-0.5 border border-white/[0.08] gap-0.5">
            <button
              type="button"
              onClick={() => selectViewportPreset('desktop')}
              title="Desktop (1280px)"
              aria-label="Desktop viewport"
              className={`inline-flex items-center justify-center h-6 px-2 rounded-full transition-colors ${
                viewportPreset === 'desktop'
                  ? 'bg-[#3f3f3f] text-white shadow-sm'
                  : 'text-[#8e8e8e] hover:text-white'
              }`}
            >
              <Monitor className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => selectViewportPreset('tablet')}
              title="Tablet (768px)"
              aria-label="Tablet viewport"
              className={`inline-flex items-center justify-center h-6 px-2 rounded-full transition-colors ${
                viewportPreset === 'tablet'
                  ? 'bg-[#3f3f3f] text-white shadow-sm'
                  : 'text-[#8e8e8e] hover:text-white'
              }`}
            >
              <Tablet className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => selectViewportPreset('mobile')}
              title="Mobile (375px)"
              aria-label="Mobile viewport"
              className={`inline-flex items-center justify-center h-6 px-2 rounded-full transition-colors ${
                viewportPreset === 'mobile'
                  ? 'bg-[#3f3f3f] text-white shadow-sm'
                  : 'text-[#8e8e8e] hover:text-white'
              }`}
            >
              <Smartphone className="w-3 h-3" />
            </button>
          </div>

          {activeSnapshot.iteration !== 0 && (
            <div className="inline-flex items-center rounded-full bg-[#1e1e1e] p-0.5 border border-white/[0.08] gap-0.5">
              <button
                type="button"
                onClick={() => setCompareMode('split')}
                className={`inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-[11px] leading-none transition-colors ${
                  compareMode === 'split' ? 'bg-[#3f3f3f] text-white shadow-sm' : 'text-[#9b9b9b] hover:text-white'
                }`}
              >
                <Columns2 className="w-3 h-3" />
                Split
              </button>
              <button
                type="button"
                onClick={() => setCompareMode('slider')}
                className={`inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-[11px] leading-none transition-colors ${
                  compareMode === 'slider' ? 'bg-[#3f3f3f] text-white shadow-sm' : 'text-[#9b9b9b] hover:text-white'
                }`}
              >
                <SlidersHorizontal className="w-3 h-3" />
                Slider
              </button>
              <button
                type="button"
                onClick={() => setCompareMode('after')}
                className={`inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-[11px] leading-none transition-colors ${
                  compareMode === 'after' ? 'bg-[#3f3f3f] text-white shadow-sm' : 'text-[#9b9b9b] hover:text-white'
                }`}
              >
                <Square className="w-3 h-3" />
                After
              </button>
            </div>
          )}
        </div>

        {/* Right Controls: Zoom + 100% + Fit + Approve + Copy */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="hidden sm:inline-flex items-center rounded-full bg-[#1e1e1e] border border-white/[0.08] h-7 px-1.5 gap-1">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.25, Number((z - 0.1).toFixed(2))))}
              className="h-5 w-5 inline-flex items-center justify-center text-[#b4b4b4] hover:text-white rounded-full"
              title="Zoom out (-)"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="text-[11px] font-mono w-9 text-center text-white">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(2, Number((z + 0.1).toFixed(2))))}
              className="h-5 w-5 inline-flex items-center justify-center text-[#b4b4b4] hover:text-white rounded-full"
              title="Zoom in (+)"
            >
              <Plus className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={toggleOneToOneZoom}
              className={`h-5 px-2 inline-flex items-center rounded-full text-[10px] leading-none ${
                Math.abs(zoom - 1) < 0.02
                  ? 'bg-[#0d99ff] text-white'
                  : 'bg-[#383838] hover:bg-[#444] text-white'
              }`}
              title="Toggle 100% zoom"
            >
              100%
            </button>
            <button
              type="button"
              onClick={() => fitCanvasToView()}
              className="h-5 px-2 inline-flex items-center rounded-full bg-[#383838] hover:bg-[#444] text-[10px] leading-none text-white"
              title="Fit to screen (0)"
            >
              Fit
            </button>
          </div>

          <button
            type="button"
            onClick={() => void onApprove(activeSnapshot)}
            className={`inline-flex items-center gap-1 h-7 px-3 rounded-full text-[11px] font-medium transition-colors ${
              approvedIter === activeSnapshot.iteration
                ? 'bg-[#10a37f] text-white'
                : 'bg-[#0d99ff] hover:bg-[#007be5] text-white'
            }`}
          >
            <Check className="w-3 h-3" />
            {approvedIter === activeSnapshot.iteration ? 'Approved' : 'Approve'}
          </button>

          <button
            type="button"
            onClick={onCopyHtml}
            className="inline-flex items-center gap-1 h-7 px-3 rounded-full bg-[#ececec] text-[#171717] font-medium text-[11px] hover:bg-white transition-colors"
          >
            <Copy className="w-3 h-3" />
            {copied ? 'Copied' : 'Copy HTML'}
          </button>
        </div>
      </header>

      {/* Main Infinite Canvas Area */}
      <div
        ref={viewportRef}
        onWheel={handleWheel}
        onPointerDown={handleCanvasPointerDown}
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.12) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
          cursor: isPanning ? 'grabbing' : 'grab',
        }}
        className="relative flex-1 overflow-hidden bg-[#1e1e1e]"
      >
        {/* Scaled & Panned Artboards Layer */}
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'top left',
          }}
          className="absolute top-0 left-0 flex items-start gap-10"
        >
          {compareMode === 'slider' && activeSnapshot.iteration !== 0 ? (
            <div className="flex flex-col shrink-0">
              <div
                onDoubleClick={toggleOneToOneZoom}
                className="flex items-center justify-between mb-2 px-1 text-xs cursor-pointer"
                title="Double-click to toggle 100% zoom"
              >
                <span className="text-[#b4b4b4]">
                  Before ({baselineSnapshot.summary.totalPassed}/{baselineSnapshot.summary.totalMetrics})
                </span>
                <span className="font-medium text-[#10a37f]">
                  {Math.round(sliderPct)}% &middot; After {activeSnapshot.label} (
                  {frameWidth}&times;{frameHeight})
                </span>
              </div>
              <div
                ref={sliderContainerRef}
                style={{ width: frameWidth, height: frameHeight }}
                className="relative rounded-md overflow-hidden shadow-2xl ring-1 ring-[#10a37f]/50 bg-white"
              >
                {/* After (Full Layer Underneath) */}
                <iframe
                  ref={afterFrameRef}
                  title="After Slider Layer"
                  srcDoc={afterHtml}
                  sandbox="allow-same-origin"
                  onLoad={() => syncScrollFrom('after')}
                  style={{ width: frameWidth, height: frameHeight }}
                  className="absolute inset-0 border-0 block bg-white"
                />
                {/* Before (Clip-path avoids iframe reflow so sliding is 60fps smooth) */}
                <iframe
                  ref={beforeFrameRef}
                  title="Before Slider Layer"
                  srcDoc={baselineSnapshot.html}
                  sandbox="allow-same-origin"
                  onLoad={() => syncScrollFrom('after')}
                  style={{
                    width: frameWidth,
                    height: frameHeight,
                    clipPath: `inset(0 ${100 - sliderPct}% 0 0)`,
                  }}
                  className="absolute inset-0 border-0 block bg-white pointer-events-none"
                />
                {isInteractingBlocked && <div className="absolute inset-0 z-10" />}
                {/* Draggable Divider */}
                <div
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setIsSliding(true);
                  }}
                  style={{ left: `${sliderPct}%` }}
                  className="absolute inset-y-0 z-30 w-1 -ml-0.5 bg-[#0d99ff] cursor-ew-resize flex items-center justify-center shadow"
                >
                  <div className="w-8 h-8 rounded-full bg-[#0d99ff] text-white shadow-lg flex items-center justify-center text-xs font-bold ring-2 ring-white/80">
                    &#8596;
                  </div>
                </div>
                {renderResizeHandles()}
              </div>
            </div>
          ) : (
            <>
              {showBaselineComparison && (
                <div className="flex flex-col shrink-0">
                  <div
                    onDoubleClick={toggleOneToOneZoom}
                    className="flex items-center justify-between mb-2 px-1 text-xs text-[#b4b4b4] cursor-pointer"
                    title="Double-click to toggle 100% zoom"
                  >
                    <span>
                      Baseline (Before) &middot; {frameWidth}&times;{frameHeight}
                    </span>
                    <span className="font-mono">
                      {baselineSnapshot.summary.totalPassed}/{baselineSnapshot.summary.totalMetrics}
                    </span>
                  </div>
                  <div
                    style={{ width: frameWidth, height: frameHeight }}
                    className="relative rounded-md overflow-hidden shadow-2xl ring-1 ring-white/15 bg-white"
                  >
                    <iframe
                      ref={beforeFrameRef}
                      title="Baseline Frame"
                      srcDoc={baselineSnapshot.html}
                      sandbox="allow-same-origin"
                      onLoad={() => syncScrollFrom('after')}
                      style={{ width: frameWidth, height: frameHeight }}
                      className="border-0 block bg-white"
                    />
                    {isInteractingBlocked && <div className="absolute inset-0 z-10" />}
                    {renderResizeHandles()}
                  </div>
                </div>
              )}

              <div className="flex flex-col shrink-0">
                <div
                  onDoubleClick={toggleOneToOneZoom}
                  className="flex items-center justify-between mb-2 px-1 text-xs cursor-pointer"
                  title="Double-click to toggle 100% zoom"
                >
                  <span className="font-medium text-white flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#10a37f]" />
                    {activeSnapshot.label} &middot; {frameWidth}&times;{frameHeight}
                  </span>
                  <span className="font-mono text-[#10a37f]">
                    {activeSnapshot.summary.totalPassed}/{activeSnapshot.summary.totalMetrics}
                  </span>
                </div>
                <div
                  style={{ width: frameWidth, height: frameHeight }}
                  className="relative rounded-md overflow-hidden shadow-2xl ring-2 ring-[#10a37f]/60 bg-white"
                >
                  <iframe
                    ref={afterFrameRef}
                    title="Optimized Frame"
                    srcDoc={afterHtml}
                    sandbox="allow-same-origin"
                    onLoad={() => syncScrollFrom('after')}
                    style={{ width: frameWidth, height: frameHeight }}
                    className="border-0 block bg-white"
                  />
                  {isInteractingBlocked && <div className="absolute inset-0 z-10" />}
                  {renderResizeHandles()}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Floating Left Panel: Iterations */}
        {!leftOpen ? (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setLeftOpen(true)}
            className="absolute top-3 left-3 z-30 p-2 rounded-lg bg-[#2c2c2c]/95 border border-white/[0.1] shadow-lg text-[#ececec] hover:bg-[#383838]"
            title="Show Iterations"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        ) : (
          <aside
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute top-3 left-3 bottom-3 w-[240px] z-30 rounded-xl bg-[#2c2c2c]/95 backdrop-blur border border-white/[0.1] shadow-2xl flex flex-col overflow-hidden"
          >
            <div className="px-3 py-2 border-b border-white/[0.08] flex items-center justify-between">
              <span className="text-xs font-semibold text-white">Iterations</span>
              <button
                type="button"
                onClick={() => setLeftOpen(false)}
                className="p-1 rounded hover:bg-[#383838] text-[#9b9b9b]"
                title="Collapse panel"
              >
                <PanelLeftClose className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="p-2.5 space-y-2 overflow-y-auto flex-1">
              {result.iterations.map((it) => {
                const isSelected = selectedIter === it.iteration;
                const isBest = result.bestIteration === it.iteration;
                const remainingCount = it.summary.totalFailed + it.summary.totalNeedsReview;
                return (
                  <button
                    key={it.iteration}
                    type="button"
                    onClick={() => onSelectIter(it.iteration)}
                    className={`w-full text-left p-2.5 rounded-lg border text-xs transition-colors ${
                      isSelected
                        ? 'bg-[#383838] border-[#0d99ff]'
                        : 'bg-[#212121] border-white/[0.08] hover:bg-[#2a2a2a]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-medium text-white">{it.label}</span>
                      <div className="flex items-center gap-1">
                        {approvedIter === it.iteration && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#10a37f] text-white">
                            Approved
                          </span>
                        )}
                        {isBest && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#10a37f]/20 text-[#10a37f]">
                            Best
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="font-mono text-[#ececec]">
                        {it.summary.totalPassed}/{it.summary.totalMetrics} ({it.summary.passRate}%)
                      </span>
                      {it.iteration > 0 && it.deltaFromBaseline !== 0 && (
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            it.deltaFromBaseline > 0
                              ? 'bg-[#10a37f]/20 text-[#10a37f]'
                              : 'bg-rose-500/20 text-rose-300'
                          }`}
                        >
                          {it.deltaFromBaseline > 0 ? `+${it.deltaFromBaseline}` : it.deltaFromBaseline} vs Base
                        </span>
                      )}
                    </div>
                    {it.resolvedIds.length > 0 && (
                      <div className="text-[10px] text-[#10a37f] mt-1.5 leading-relaxed break-words">
                        Fixed: {it.resolvedIds.join(', ')}
                      </div>
                    )}
                    <div className="text-[10px] text-[#9b9b9b] mt-1">
                      Remaining: {remainingCount} {remainingCount === 1 ? 'issue' : 'issues'}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="px-3 py-2 border-t border-white/[0.08] text-[10px] text-[#9b9b9b] space-y-0.5">
              <div>Drag or scroll outside frame to pan &middot; Drag edge to resize</div>
              <div>
                <kbd className="px-1 py-0.5 rounded bg-[#1e1e1e] text-white">Ctrl</kbd>+Scroll to zoom
              </div>
            </div>
          </aside>
        )}

        {/* Floating Right Panel: Designer-Friendly Inspector */}
        {!rightOpen ? (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setRightOpen(true)}
            className="absolute top-3 right-3 z-30 p-2 rounded-lg bg-[#2c2c2c]/95 border border-white/[0.1] shadow-lg text-[#ececec] hover:bg-[#383838]"
            title="Show Inspector"
          >
            <PanelRightOpen className="w-4 h-4" />
          </button>
        ) : (
          <aside
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute top-3 right-3 bottom-3 w-[280px] z-30 rounded-xl bg-[#2c2c2c]/95 backdrop-blur border border-white/[0.1] shadow-2xl flex flex-col overflow-hidden"
          >
            <div className="px-3 py-2 border-b border-white/[0.08] flex items-center justify-between">
              <span className="text-xs font-semibold text-white">Design Inspector</span>
              <button
                type="button"
                onClick={() => setRightOpen(false)}
                className="p-1 rounded hover:bg-[#383838] text-[#9b9b9b]"
                title="Collapse panel"
              >
                <PanelRightClose className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="p-3 space-y-3 overflow-y-auto flex-1 text-xs">
              {/* Human-readable Change Summary */}
              <div className="p-2.5 rounded-lg bg-[#212121] border border-white/[0.08] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">{activeSnapshot.label}</span>
                  <span className="font-mono text-[#10a37f]">
                    {activeSnapshot.summary.totalPassed}/{activeSnapshot.summary.totalMetrics}
                  </span>
                </div>
                <p className="text-[11px] text-[#d4d4d4] leading-relaxed select-text">
                  {activeSnapshot.notes}
                </p>
                {savedApprovalInfo && (
                  <div className="text-[11px] text-[#10a37f] pt-0.5">
                    Saved: {savedApprovalInfo.label} ({savedApprovalInfo.score})
                  </div>
                )}
              </div>

              {/* Fixed Metrics */}
              {activeSnapshot.resolvedIds.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-medium text-[#b4b4b4] flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#10a37f]" />
                    Fixed in this round (click to highlight)
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {activeSnapshot.resolvedIds.map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setHighlightedMetricId((prev) => (prev === id ? null : id))}
                        className={`text-[11px] px-2 py-0.5 rounded-full border ${
                          highlightedMetricId === id
                            ? 'bg-[#10a37f] text-white border-[#10a37f]'
                            : 'bg-[#10a37f]/15 text-[#10a37f] border-[#10a37f]/30'
                        }`}
                      >
                        ✓ {id}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Remaining Issues */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-medium text-[#b4b4b4]">
                  Remaining Issues ({remainingIssues.length})
                </div>
                {remainingIssues.length === 0 ? (
                  <div className="text-[11px] text-[#10a37f]">All applicable metrics passed!</div>
                ) : (
                  <div className="space-y-1 max-h-[240px] overflow-y-auto pr-0.5">
                    {remainingIssues.map((item) => {
                      const isActive = highlightedMetricId === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setHighlightedMetricId((prev) => (prev === item.id ? null : item.id))}
                          className={`w-full text-left p-2 rounded-lg border text-[11px] transition-colors ${
                            isActive
                              ? 'bg-[#383838] border-[#0d99ff]'
                              : 'bg-[#212121] border-white/[0.06] hover:bg-[#2a2a2a]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="flex items-center gap-1.5 font-medium text-[#ececec] truncate">
                              {item.status === 'fail' ? (
                                <XCircle className="w-3 h-3 text-rose-400 shrink-0" />
                              ) : (
                                <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                              )}
                              <span className="truncate">{item.title}</span>
                            </span>
                            <span className="text-[10px] font-mono text-[#9b9b9b] shrink-0">
                              {item.priority}
                            </span>
                          </div>
                          <div className="text-[10px] text-[#9b9b9b] mt-0.5 line-clamp-2">
                            {item.measuredSummary}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Selected Highlight Details */}
              {highlightedItem && (
                <div className="p-2.5 rounded-lg bg-[#212121] border border-[#0d99ff]/40 space-y-1">
                  <div className="font-medium text-white flex items-center gap-1">
                    <Maximize2 className="w-3 h-3 text-[#0d99ff]" />
                    {highlightedItem.title}
                  </div>
                  <div className="text-[11px] text-[#d4d4d4]">{highlightedItem.recommendation}</div>
                  {highlightedItem.samples.length > 0 && (
                    <div className="text-[10px] font-mono text-[#9b9b9b] whitespace-pre-wrap select-text">
                      {highlightedItem.samples.join('\n')}
                    </div>
                  )}
                </div>
              )}

              {/* Technical JSON Patch collapsed by default */}
              {activeSnapshot.appliedPatch && (
                <details className="pt-1 border-t border-white/[0.08]">
                  <summary className="cursor-pointer text-[11px] text-[#9b9b9b] hover:text-white">
                    View Technical Patch (JSON)
                  </summary>
                  <pre className="mt-2 p-2 rounded-lg bg-[#1e1e1e] border border-white/[0.08] text-[10px] font-mono text-[#d4d4d4] overflow-x-auto max-h-[220px] whitespace-pre-wrap select-text">
                    {JSON.stringify(activeSnapshot.appliedPatch, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
