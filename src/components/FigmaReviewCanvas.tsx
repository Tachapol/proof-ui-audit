'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  CheckCircle2,
  Columns2,
  Copy,
  Download,
  ListChecks,
  Loader2,
  Maximize2,
  Minus,
  MinusCircle,
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
import type {
  AutoIterationResult,
  ChecklistItemResult,
  ChecklistPillarSummary,
  ChecklistStatus,
  IterationSnapshot,
} from '@/lib/checklist/types';

export type CanvasViewportPreset = 'desktop' | 'tablet' | 'mobile';
export type CanvasCompareMode = 'split' | 'slider' | 'after';
export type RightPanelMode = 'priorities' | 'inspector' | 'checklist';

const PRESET_DIMENSIONS: Record<CanvasViewportPreset, { width: number; height: number; label: string }> = {
  desktop: { width: 1280, height: 800, label: 'Desktop (1280 × 800)' },
  tablet: { width: 768, height: 1024, label: 'Tablet (768 × 1024)' },
  mobile: { width: 375, height: 812, label: 'Mobile (375 × 812)' },
};

function ChecklistStatusIcon({ status }: { status: ChecklistStatus }) {
  if (status === 'pass') return <CheckCircle2 className="w-4 h-4 text-[#10a37f] shrink-0" />;
  if (status === 'fail') return <XCircle className="w-4 h-4 text-rose-400 shrink-0" />;
  if (status === 'needsReview') return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />;
  return <MinusCircle className="w-4 h-4 text-[#6b7280] shrink-0" />;
}

interface FigmaReviewCanvasProps {
  selectedPage: string;
  result: AutoIterationResult;
  selectedIter: number;
  onSelectIter: (iter: number) => void;
  activeTab?: 'canvas' | 'checklist';
  onTabChange?: (tab: 'canvas' | 'checklist') => void;
  viewportPreset?: CanvasViewportPreset;
  onViewportPresetChange?: (preset: CanvasViewportPreset) => void;
  compareMode?: CanvasCompareMode;
  onCompareModeChange?: (mode: CanvasCompareMode) => void;
  approvedIter: number | null;
  savedApprovalInfo: { label: string; score: string; approvedAt: string } | null;
  onApprove: (snapshot: IterationSnapshot) => Promise<void> | void;
  onCopyHtml: () => void;
  copied: boolean;
  onDownloadHtml?: () => void;
  onBackToInput: () => void;
  onOpenChecklistTab?: () => void;
  injectHighlightCss: (html: string, selectors: string[]) => string;
  priorityOrder: string[];
  selectedMetricIds: Set<string>;
  reviewedMetricIds: Set<string>;
  onToggleMetric: (id: string) => void;
  onMovePriority: (id: string, dir: -1 | 1) => void;
  onConfirmNeedsReview: (id: string) => void;
  maxIterations: number;
  onMaxIterationsChange: (n: number) => void;
  isOptimizing: boolean;
  onRunOptimization: () => void;
}

function injectColoredHighlightCss(
  html: string,
  selectors: string[],
  colorHex: string,
  bgRgba: string
): string {
  const valid = selectors
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('missing '));
  if (valid.length === 0) return html;
  const css = `${valid.join(', ')} { outline: 3px solid ${colorHex} !important; outline-offset: 2px !important; background-color: ${bgRgba} !important; }`;
  const tag = `<style data-proofui-highlight="true">${css}</style>`;
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${tag}\n</head>`);
  return `${tag}\n${html}`;
}

export function FigmaReviewCanvas({
  selectedPage,
  result,
  selectedIter,
  onSelectIter,
  activeTab: controlledActiveTab,
  onTabChange,
  viewportPreset: controlledViewportPreset,
  onViewportPresetChange,
  compareMode: controlledCompareMode,
  onCompareModeChange,
  approvedIter,
  savedApprovalInfo,
  onApprove,
  onCopyHtml,
  copied,
  onDownloadHtml,
  onBackToInput,
  onOpenChecklistTab,
  injectHighlightCss,
  priorityOrder,
  selectedMetricIds,
  reviewedMetricIds,
  onToggleMetric,
  onMovePriority,
  onConfirmNeedsReview,
  maxIterations,
  onMaxIterationsChange,
  isOptimizing,
  onRunOptimization,
}: FigmaReviewCanvasProps) {
  const baselineSnapshot = result.iterations[0];
  const activeSnapshot = result.iterations[selectedIter] || baselineSnapshot;

  const [internalActiveTab, setInternalActiveTab] = useState<'canvas' | 'checklist'>('canvas');
  const activeTab = controlledActiveTab ?? internalActiveTab;
  const setActiveTab = (tab: 'canvas' | 'checklist') => {
    setInternalActiveTab(tab);
    onTabChange?.(tab);
  };
  const [rightPanelMode, setRightPanelMode] = useState<RightPanelMode>(
    activeTab === 'checklist'
      ? 'checklist'
      : result.iterations.length === 1
        ? 'priorities'
        : 'inspector'
  );
  const isChecklistDrawerOpen = rightPanelMode === 'checklist';

  const prevIterCountRef = useRef(result.iterations.length);
  useEffect(() => {
    const prev = prevIterCountRef.current;
    prevIterCountRef.current = result.iterations.length;
    if (result.iterations.length > 1 && prev <= 1) {
      setRightPanelMode('inspector');
      setActiveTab('canvas');
      setRightOpen(true);
    } else if (result.iterations.length === 1 && prev > 1) {
      setRightPanelMode('priorities');
      setActiveTab('canvas');
      setRightOpen(true);
    }
  }, [result.iterations.length]);

  const orderedPriorityItems = useMemo(() => {
    const map = new Map(baselineSnapshot.summary.priorityList.map((m) => [m.id, m]));
    return priorityOrder
      .map((id) => map.get(id))
      .filter((m): m is ChecklistItemResult => Boolean(m));
  }, [baselineSnapshot.summary.priorityList, priorityOrder]);

  const selectedReadyCount = useMemo(
    () =>
      orderedPriorityItems.filter(
        (item) =>
          selectedMetricIds.has(item.id) &&
          (item.status !== 'needsReview' || reviewedMetricIds.has(item.id))
      ).length,
    [orderedPriorityItems, selectedMetricIds, reviewedMetricIds]
  );

  const selectedReviewCount = useMemo(
    () =>
      orderedPriorityItems.filter(
        (item) =>
          selectedMetricIds.has(item.id) &&
          item.status === 'needsReview' &&
          !reviewedMetricIds.has(item.id)
      ).length,
    [orderedPriorityItems, selectedMetricIds, reviewedMetricIds]
  );

  const [internalViewportPreset, setInternalViewportPreset] = useState<CanvasViewportPreset>('desktop');
  const viewportPreset = controlledViewportPreset ?? internalViewportPreset;
  const setViewportPreset = (preset: CanvasViewportPreset) => {
    setInternalViewportPreset(preset);
    onViewportPresetChange?.(preset);
  };

  const [frameWidth, setFrameWidth] = useState<number>(PRESET_DIMENSIONS[viewportPreset].width);
  const [frameHeight, setFrameHeight] = useState<number>(PRESET_DIMENSIONS[viewportPreset].height);
  const [internalCompareMode, setInternalCompareMode] = useState<CanvasCompareMode>('split');
  const compareMode = controlledCompareMode ?? internalCompareMode;
  const setCompareMode = (mode: CanvasCompareMode) => {
    setInternalCompareMode(mode);
    onCompareModeChange?.(mode);
  };
  const [spacePressed, setSpacePressed] = useState(false);

  const [zoom, setZoom] = useState<number>(0.7);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 40, y: 12 });
  const [sliderPct, setSliderPct] = useState<number>(50);

  const [leftOpen, setLeftOpen] = useState<boolean>(true);
  const [rightOpen, setRightOpen] = useState<boolean>(true);
  const [highlightedMetricId, setHighlightedMetricId] = useState<string | null>(null);
  const [showOnboardingTip, setShowOnboardingTip] = useState<boolean>(false);

  useEffect(() => {
    try {
      if (localStorage.getItem('proofui_canvas_tip_seen') !== '1') {
        setShowOnboardingTip(true);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const dismissOnboardingTip = () => {
    setShowOnboardingTip(false);
    try {
      localStorage.setItem('proofui_canvas_tip_seen', '1');
    } catch {
      // ignore storage errors
    }
  };

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

  const highlightState = useMemo(() => {
    if (!highlightedMetricId || !activeSnapshot) {
      return { selectors: [] as string[], isFixed: false, isReview: false };
    }
    const isFixed = activeSnapshot.resolvedIds.includes(highlightedMetricId);
    const activeItem = activeSnapshot.summary.items.find((i) => i.id === highlightedMetricId);
    const baselineItem = baselineSnapshot?.summary.items.find((i) => i.id === highlightedMetricId);

    const selectors = new Set<string>();
    if (isFixed) {
      for (const p of activeSnapshot.appliedPatch?.attributePatches || []) {
        if (p.metricId === highlightedMetricId && p.selector) selectors.add(p.selector);
      }
      for (const r of activeSnapshot.appliedPatch?.tagRenames || []) {
        if (r.metricId === highlightedMetricId && r.selector) selectors.add(r.selector);
      }
      for (const s of baselineItem?.rawSelectors || []) {
        selectors.add(s);
      }
    }
    for (const s of activeItem?.rawSelectors || []) {
      selectors.add(s);
    }

    return {
      selectors: Array.from(selectors),
      isFixed,
      isReview: activeItem?.status === 'needsReview',
    };
  }, [highlightedMetricId, activeSnapshot, baselineSnapshot]);

  const highlightedItem = useMemo(() => {
    if (!highlightedMetricId || !activeSnapshot) return null;
    return activeSnapshot.summary.items.find((i) => i.id === highlightedMetricId) || null;
  }, [highlightedMetricId, activeSnapshot]);

  const remainingIssues = useMemo(() => {
    if (!activeSnapshot) return [];
    return activeSnapshot.summary.priorityList;
  }, [activeSnapshot]);

  const failIssues = useMemo(
    () => remainingIssues.filter((item) => item.status === 'fail'),
    [remainingIssues]
  );

  const reviewIssues = useMemo(
    () => remainingIssues.filter((item) => item.status === 'needsReview'),
    [remainingIssues]
  );

  const metricTitleMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of activeSnapshot?.summary.items || []) {
      map.set(item.id, item.title);
    }
    return map;
  }, [activeSnapshot]);

  const fitCanvasToView = useCallback(
    (targetW?: number, targetH?: number) => {
      const el = viewportRef.current;
      if (!el) return;
      const leftPad = leftOpen ? 252 : 16;
      const checklistW = Math.min(720, Math.max(420, Math.round(el.clientWidth * 0.5)));
      const rightPad = rightOpen ? (isChecklistDrawerOpen ? checklistW + 16 : 292) : 16;
      const availW = Math.max(280, el.clientWidth - leftPad - rightPad - 32);
      const availH = Math.max(360, el.clientHeight - 36);

      const w = targetW ?? frameWidth;
      const h = targetH ?? frameHeight;
      const totalArtboardW =
        compareMode === 'split' && activeSnapshot.iteration !== 0 ? w * 2 + 32 : w;

      const zoomByW = availW / totalArtboardW;
      const zoomByH = (availH - 24) / h;
      const nextZoom = Math.max(0.25, Math.min(1, Number(Math.min(zoomByW, zoomByH).toFixed(2))));

      const renderedW = totalArtboardW * nextZoom;
      const centerX = leftPad + Math.max(12, (availW + 32 - renderedW) / 2);
      setZoom(nextZoom);
      setPan({ x: Math.round(centerX), y: 12 });
    },
    [frameWidth, frameHeight, compareMode, activeSnapshot.iteration, leftOpen, rightOpen, isChecklistDrawerOpen]
  );

  useEffect(() => {
    fitCanvasToView();
  }, [fitCanvasToView]);

  const selectViewportPreset = (preset: CanvasViewportPreset) => {
    setViewportPreset(preset);
    const { width, height } = PRESET_DIMENSIONS[preset];
    setFrameWidth(width);
    setFrameHeight(height);
    fitCanvasToView(width, height);
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
        onBackToInput();
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
  }, [fitCanvasToView, onBackToInput]);

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

  const beforeHtml = useMemo(() => {
    if (!highlightState.isFixed || highlightState.selectors.length === 0) {
      return baselineSnapshot.html;
    }
    return injectColoredHighlightCss(
      baselineSnapshot.html,
      highlightState.selectors,
      '#f43f5e',
      'rgba(244, 63, 94, 0.08)'
    );
  }, [baselineSnapshot.html, highlightState]);

  const afterHtml = useMemo(() => {
    if (highlightState.selectors.length === 0) return activeSnapshot.html;
    if (highlightState.isFixed) {
      return injectColoredHighlightCss(
        activeSnapshot.html,
        highlightState.selectors,
        '#10a37f',
        'rgba(16, 163, 127, 0.10)'
      );
    }
    if (highlightState.isReview) {
      return injectColoredHighlightCss(
        activeSnapshot.html,
        highlightState.selectors,
        '#f59e0b',
        'rgba(245, 158, 11, 0.10)'
      );
    }
    return injectHighlightCss(activeSnapshot.html, highlightState.selectors);
  }, [activeSnapshot.html, highlightState, injectHighlightCss]);

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
    <div className="figma-workspace fixed inset-0 !m-0 z-50 bg-[#1e1e1e] text-[#ececec] flex flex-col select-none [color-scheme:dark]">
      {/* Transparent drag shield while panning/sliding/resizing so iframes cannot capture pointer events */}
      {(isPanning || isSliding || isResizing) && (
        <div
          className={`fixed inset-0 z-[100] ${isPanning ? 'cursor-grabbing' : isSliding ? 'cursor-ew-resize' : 'cursor-nwse-resize'
            }`}
        />
      )}

      {/* Top Figma-style Toolbar */}
      <header className="figma-toolbar h-14 px-3.5 bg-[#2c2c2c] border-b border-white/[0.1] flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onBackToInput}
            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-[#1e1e1e] border border-white/[0.08] text-[11px] text-[#d4d4d4] hover:text-white hover:bg-[#383838] transition-colors shrink-0"
            title="Back to Input & Batch Overview"
          >
            <ArrowLeft className="w-3 h-3" />
            <span>Input</span>
          </button>
          <span className="text-[11px] font-mono text-[#b4b4b4] truncate max-w-[160px]" title={selectedPage}>
            {selectedPage}
          </span>
        </div>

        {/* Center Controls: Desktop / Tablet / Mobile Pill + Compare (always visible on Canvas) */}
        <div className="flex items-center gap-2 overflow-x-auto">
            <div className="inline-flex items-center rounded-full bg-[#1e1e1e] p-0.5 border border-white/[0.08] gap-0.5">
              <button
                type="button"
                onClick={() => selectViewportPreset('desktop')}
                title={PRESET_DIMENSIONS.desktop.label}
                aria-label="Desktop viewport"
                className={`inline-flex items-center justify-center h-6 px-2 rounded-full transition-colors ${viewportPreset === 'desktop'
                  ? 'bg-[#3f3f3f] text-white shadow-sm'
                  : 'text-[#8e8e8e] hover:text-white'
                  }`}
              >
                <Monitor className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => selectViewportPreset('tablet')}
                title={PRESET_DIMENSIONS.tablet.label}
                aria-label="Tablet viewport"
                className={`inline-flex items-center justify-center h-6 px-2 rounded-full transition-colors ${viewportPreset === 'tablet'
                  ? 'bg-[#3f3f3f] text-white shadow-sm'
                  : 'text-[#8e8e8e] hover:text-white'
                  }`}
              >
                <Tablet className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => selectViewportPreset('mobile')}
                title={PRESET_DIMENSIONS.mobile.label}
                aria-label="Mobile viewport"
                className={`inline-flex items-center justify-center h-6 px-2 rounded-full transition-colors ${viewportPreset === 'mobile'
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
                  className={`inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-[11px] leading-none transition-colors ${compareMode === 'split' ? 'bg-[#3f3f3f] text-white shadow-sm' : 'text-[#9b9b9b] hover:text-white'
                    }`}
                >
                  <Columns2 className="w-3 h-3" />
                  Split
                </button>
                <button
                  type="button"
                  onClick={() => setCompareMode('slider')}
                  className={`inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-[11px] leading-none transition-colors ${compareMode === 'slider' ? 'bg-[#3f3f3f] text-white shadow-sm' : 'text-[#9b9b9b] hover:text-white'
                    }`}
                >
                  <SlidersHorizontal className="w-3 h-3" />
                  Slider
                </button>
                <button
                  type="button"
                  onClick={() => setCompareMode('after')}
                  className={`inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-[11px] leading-none transition-colors ${compareMode === 'after' ? 'bg-[#3f3f3f] text-white shadow-sm' : 'text-[#9b9b9b] hover:text-white'
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
              className={`h-5 px-2 inline-flex items-center rounded-full text-[10px] leading-none ${Math.abs(zoom - 1) < 0.02
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
            className={`inline-flex items-center gap-1 h-7 px-3 rounded-full text-[11px] font-medium transition-colors ${approvedIter === activeSnapshot.iteration
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

          {onDownloadHtml && (
            <button
              type="button"
              onClick={onDownloadHtml}
              className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-[#383838] text-[#ececec] font-medium text-[11px] hover:bg-[#444] transition-colors"
              title="Download HTML file"
            >
              <Download className="w-3 h-3" />
              <span className="hidden md:inline">Download</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Infinite Canvas Area (always visible; Right Drawer switches between Inspector & half-screen Checklist) */}
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
            className={`absolute top-0 left-0 flex items-start gap-10 ${
              isPanning || isSliding || isResizing
                ? 'transition-none'
                : 'transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]'
            }`}
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
                    srcDoc={beforeHtml}
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
                        srcDoc={beforeHtml}
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
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setLeftOpen(true)}
            className={`absolute top-3 left-3 z-20 p-2 rounded-lg bg-[#2c2c2c]/95 border border-white/[0.1] shadow-lg text-[#ececec] hover:bg-[#383838] transition-all duration-200 ${
              leftOpen ? 'opacity-0 pointer-events-none scale-95' : 'opacity-100 scale-100'
            }`}
            title="Show Iterations"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
          <aside
            onPointerDown={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
            className={`absolute top-3 left-3 bottom-3 w-[240px] z-30 rounded-xl bg-[#2c2c2c]/95 backdrop-blur border border-white/[0.1] shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              leftOpen
                ? 'translate-x-0 opacity-100'
                : '-translate-x-[260px] opacity-0 pointer-events-none'
            }`}
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
                  const isRecommended = result.bestIteration === it.iteration;
                  return (
                    <button
                      key={it.iteration}
                      type="button"
                      onClick={() => onSelectIter(it.iteration)}
                      className={`w-full text-left p-2.5 rounded-lg border text-xs transition-colors ${isSelected
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
                          {isRecommended && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#10a37f]/20 text-[#10a37f]">
                              Recommended
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <span className="font-mono text-sm text-[#ececec]">
                          {it.summary.totalPassed}/{it.summary.totalMetrics}
                        </span>
                        <span
                          className={`text-[11px] font-mono font-medium px-1.5 py-0.5 rounded ${it.summary.passRate >= 80
                            ? 'text-[#10a37f] bg-[#10a37f]/15'
                            : it.summary.passRate >= 60
                              ? 'text-amber-300 bg-amber-500/15'
                              : 'text-rose-300 bg-rose-500/15'
                            }`}
                        >
                          {it.summary.passRate}%
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="p-2.5 border-t border-white/[0.08] space-y-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const nextMode: RightPanelMode =
                      rightPanelMode === 'priorities' && rightOpen ? 'inspector' : 'priorities';
                    setRightPanelMode(nextMode);
                    setActiveTab('canvas');
                    setRightOpen(true);
                  }}
                  className={`w-full py-1.5 px-2.5 rounded-lg text-[11px] font-medium border transition-colors flex items-center justify-between ${
                    rightPanelMode === 'priorities' && rightOpen
                      ? 'bg-[#3f3f3f] text-white border-[#0d99ff]'
                      : 'bg-[#212121] text-[#d4d4d4] border-white/[0.08] hover:bg-[#2a2a2a]'
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <ListChecks className="w-3.5 h-3.5 text-[#10a37f]" />
                    Choose Metrics
                  </span>
                  <span className="font-mono text-[10px] text-[#9b9b9b]">
                    {selectedReadyCount}/{orderedPriorityItems.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const nextIsChecklist = !(isChecklistDrawerOpen && rightOpen);
                    setRightPanelMode(
                      nextIsChecklist
                        ? 'checklist'
                        : result.iterations.length === 1
                          ? 'priorities'
                          : 'inspector'
                    );
                    setActiveTab(nextIsChecklist ? 'checklist' : 'canvas');
                    setRightOpen(true);
                    if (nextIsChecklist) onOpenChecklistTab?.();
                  }}
                  className={`w-full py-1.5 px-2.5 rounded-lg text-[11px] font-medium border transition-colors ${
                    isChecklistDrawerOpen && rightOpen
                      ? 'bg-[#3f3f3f] text-white border-[#0d99ff]'
                      : 'bg-[#212121] text-[#d4d4d4] border-white/[0.08] hover:bg-[#2a2a2a]'
                  }`}
                >
                  {isChecklistDrawerOpen && rightOpen
                    ? 'Close Checklist Drawer'
                    : `Checklist (${activeSnapshot.summary.totalPassed}/${activeSnapshot.summary.totalMetrics})`}
                </button>
              </div>
            </aside>

          {/* One-time dismissible onboarding tip */}
          {showOnboardingTip && (
            <div
              onPointerDown={(e) => e.stopPropagation()}
              onWheel={(e) => e.stopPropagation()}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-[#2c2c2c]/95 backdrop-blur border border-white/[0.12] shadow-xl text-[11px] text-[#d4d4d4]"
            >
              <span>Drag outside frame to pan &middot; Ctrl+Scroll to zoom &middot; Drag edge to resize</span>
              <button
                type="button"
                onClick={dismissOnboardingTip}
                className="px-2 py-0.5 rounded-full bg-[#3f3f3f] hover:bg-[#4a4a4a] text-[10px] font-medium text-white"
              >
                Got it
              </button>
            </div>
          )}

          {/* Floating Right Panel: Designer-Friendly Inspector / Half-Screen Checklist */}
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setRightOpen(true)}
            className={`absolute top-3 right-3 z-20 p-2 rounded-lg bg-[#2c2c2c]/95 border border-white/[0.1] shadow-lg text-[#ececec] hover:bg-[#383838] transition-all duration-200 ${
              rightOpen ? 'opacity-0 pointer-events-none scale-95' : 'opacity-100 scale-100'
            }`}
            title="Show Inspector"
          >
            <PanelRightOpen className="w-4 h-4" />
          </button>
          <aside
            onPointerDown={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
            style={{
              width:
                rightPanelMode === 'checklist'
                  ? 'clamp(420px, 50vw, 720px)'
                  : rightPanelMode === 'priorities'
                    ? '310px'
                    : '280px',
            }}
            className={`absolute top-3 right-3 bottom-3 z-30 rounded-xl bg-[#2c2c2c]/95 backdrop-blur border border-white/[0.1] shadow-2xl flex flex-col overflow-hidden transition-[width,transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              rightOpen
                ? 'translate-x-0 opacity-100'
                : 'translate-x-full opacity-0 pointer-events-none'
            }`}
          >
              <div className="px-3 py-2 border-b border-white/[0.08] flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-white">
                  {rightPanelMode === 'checklist'
                    ? `Checklist (${activeSnapshot.summary.totalPassed}/${activeSnapshot.summary.totalMetrics})`
                    : rightPanelMode === 'priorities'
                      ? `Choose Metrics (${orderedPriorityItems.length})`
                      : 'Design Inspector'}
                </span>
                <button
                  type="button"
                  onClick={() => setRightOpen(false)}
                  className="p-1 rounded hover:bg-[#383838] text-[#9b9b9b]"
                  title="Collapse panel"
                >
                  <PanelRightClose className="w-3.5 h-3.5" />
                </button>
              </div>
              {rightPanelMode === 'priorities' ? (
                <div className="flex flex-col flex-1 min-h-0 text-xs select-text">
                  <div className="p-3 border-b border-white/[0.08] space-y-2.5 bg-[#262626]/60">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-[11px] text-[#9b9b9b] flex items-center gap-1.5">
                        <span>Max rounds</span>
                        <select
                          value={maxIterations}
                          onChange={(e) => onMaxIterationsChange(Number(e.target.value))}
                          disabled={isOptimizing}
                          className="h-6 px-2 rounded bg-[#1e1e1e] border border-white/[0.1] text-[#ececec] text-[11px]"
                        >
                          <option value={1}>1</option>
                          <option value={2}>2</option>
                          <option value={3}>3</option>
                          <option value={5}>5</option>
                        </select>
                      </label>
                      <span className="text-[10px] font-mono text-[#9b9b9b]">
                        {selectedReadyCount} selected
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={onRunOptimization}
                      disabled={isOptimizing || selectedReadyCount === 0}
                      className="w-full h-8 px-3 rounded-lg bg-[#10a37f] hover:bg-[#0d8c6d] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-[11px] flex items-center justify-center gap-1.5 transition-colors"
                    >
                      {isOptimizing ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Optimizing...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          Run Optimization ({selectedReadyCount})
                        </>
                      )}
                    </button>
                    {selectedReviewCount > 0 && (
                      <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[10px] text-amber-300 leading-snug">
                        {selectedReviewCount} review item(s) require confirmation before fixing.
                      </div>
                    )}
                  </div>
                  <div className="p-2.5 space-y-1.5 overflow-y-auto flex-1">
                    {orderedPriorityItems.length === 0 ? (
                      <div className="p-4 rounded-lg bg-[#212121] border border-white/[0.06] text-center text-[#9b9b9b] text-[11px]">
                        All metrics passed on baseline.
                      </div>
                    ) : (
                      orderedPriorityItems.map((item, idx) => {
                        const isNeedsReview = item.status === 'needsReview';
                        const isReviewed = reviewedMetricIds.has(item.id);
                        const isSelected = selectedMetricIds.has(item.id);
                        const isHighlighted = highlightedMetricId === item.id;
                        const canSelect = !isNeedsReview || isReviewed;
                        return (
                          <div
                            key={item.id}
                            className={`p-2 rounded-lg border transition-colors ${
                              isHighlighted
                                ? 'bg-[#383838] border-[#0d99ff]'
                                : isSelected
                                  ? 'bg-[#212121] border-white/[0.12]'
                                  : 'bg-[#1c1c1c] border-white/[0.06] opacity-75'
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                disabled={!canSelect || isOptimizing}
                                onChange={() => onToggleMetric(item.id)}
                                className="mt-0.5 rounded border-white/20 bg-[#1e1e1e] accent-[#10a37f] cursor-pointer disabled:opacity-40"
                                title={
                                  canSelect
                                    ? 'Include in auto-fix'
                                    : 'Confirm needsReview item before selecting'
                                }
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setHighlightedMetricId((prev) => (prev === item.id ? null : item.id))
                                }
                                className="flex-1 min-w-0 text-left"
                                title="Click to highlight on artboard"
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <span className="font-medium text-[11px] text-[#ececec] truncate">
                                    #{idx + 1} {item.title}
                                  </span>
                                  <span className="text-[10px] font-mono text-[#9b9b9b] shrink-0">
                                    {item.priority}
                                  </span>
                                </div>
                                <div className="text-[10px] text-[#9b9b9b] mt-0.5 line-clamp-2">
                                  {item.measuredSummary}
                                </div>
                              </button>
                              <div className="flex flex-col gap-0.5 shrink-0">
                                <button
                                  type="button"
                                  disabled={idx === 0 || isOptimizing}
                                  onClick={() => onMovePriority(item.id, -1)}
                                  className="p-0.5 rounded hover:bg-[#383838] text-[#9b9b9b] hover:text-white disabled:opacity-30"
                                  title="Move up"
                                >
                                  <ArrowUp className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  disabled={idx === orderedPriorityItems.length - 1 || isOptimizing}
                                  onClick={() => onMovePriority(item.id, 1)}
                                  className="p-0.5 rounded hover:bg-[#383838] text-[#9b9b9b] hover:text-white disabled:opacity-30"
                                  title="Move down"
                                >
                                  <ArrowDown className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                            {isNeedsReview && (
                              <div className="mt-1.5 pl-5 flex items-center justify-between gap-2">
                                {isReviewed ? (
                                  <span className="text-[10px] text-[#10a37f]">Confirmed for fix</span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => onConfirmNeedsReview(item.id)}
                                    className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-[10px] font-medium"
                                  >
                                    Confirm for fix
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : isChecklistDrawerOpen ? (
                <div className="p-3.5 space-y-4 overflow-y-auto flex-1 text-xs select-text">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="p-2.5 rounded-lg bg-[#212121] border border-white/[0.06]">
                      <div className="text-[10px] text-[#9b9b9b]">Passed</div>
                      <div className="text-lg font-semibold text-[#10a37f]">
                        {activeSnapshot.summary.totalPassed}/{activeSnapshot.summary.totalMetrics}
                      </div>
                      <div className="text-[10px] text-[#9b9b9b]">{activeSnapshot.summary.passRate}%</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#212121] border border-white/[0.06]">
                      <div className="text-[10px] text-[#9b9b9b]">Needs Fix</div>
                      <div className="text-lg font-semibold text-rose-400">
                        {activeSnapshot.summary.totalFailed}
                      </div>
                      <div className="text-[10px] text-[#9b9b9b]">Click to highlight</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#212121] border border-white/[0.06]">
                      <div className="text-[10px] text-[#9b9b9b]">Needs Review</div>
                      <div className="text-lg font-semibold text-amber-400">
                        {activeSnapshot.summary.totalNeedsReview}
                      </div>
                      <div className="text-[10px] text-[#9b9b9b]">Manual check</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(['ux', 'ui'] as const).map((group) => {
                      const groupSummary = group === 'ux' ? activeSnapshot.summary.ux : activeSnapshot.summary.ui;
                      const pillars = activeSnapshot.summary.pillars.filter((p) => p.group === group);
                      return (
                        <div key={group} className="space-y-2.5">
                          <h3 className="text-xs font-semibold text-white px-0.5">
                            {group === 'ux' ? 'UX' : 'UI'} ({groupSummary.passed}/{groupSummary.total})
                          </h3>
                          {pillars.map((pillar: ChecklistPillarSummary) => {
                            const pct = pillar.total > 0 ? Math.round((pillar.passed / pillar.total) * 100) : 0;
                            return (
                              <div key={pillar.id} className="rounded-lg bg-[#212121] border border-white/[0.06] p-2.5 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="font-medium text-white text-[11px]">{pillar.label}</span>
                                  <span className="text-[10px] font-mono text-[#10a37f]">
                                    {pillar.passed}/{pillar.total}
                                  </span>
                                </div>
                                <div className="h-1 w-full rounded-full bg-[#383838] overflow-hidden">
                                  <div className="h-full bg-[#10a37f]" style={{ width: `${pct}%` }} />
                                </div>
                                <div className="space-y-1">
                                  {pillar.items.map((item) => {
                                    const isHighlighted = highlightedMetricId === item.id;
                                    const isClickable = item.status !== 'notApplicable';
                                    return (
                                      <button
                                        key={item.id}
                                        type="button"
                                        disabled={!isClickable}
                                        onClick={() => {
                                          setHighlightedMetricId((prev) => (prev === item.id ? null : item.id));
                                          if (item.id === 'reflow') selectViewportPreset('mobile');
                                        }}
                                        className={`w-full text-left flex items-start gap-2 p-1.5 rounded border text-[11px] transition-colors ${
                                          isHighlighted
                                            ? 'bg-[#383838] border-[#0d99ff]'
                                            : item.status === 'notApplicable'
                                              ? 'bg-[#1a1a1a] border-transparent opacity-55 cursor-default'
                                              : 'bg-[#1a1a1a] border-white/[0.04] hover:bg-[#2a2a2a]'
                                        }`}
                                      >
                                        <ChecklistStatusIcon status={item.status} />
                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center justify-between gap-1">
                                            <span className="font-medium text-[#ececec] truncate">{item.title}</span>
                                            <span className="text-[9px] font-mono text-[#9b9b9b] shrink-0">
                                              {item.status === 'notApplicable' ? 'N/A' : item.priority}
                                            </span>
                                          </div>
                                          <div className="text-[10px] text-[#9b9b9b] line-clamp-2">
                                            {item.measuredSummary}
                                          </div>
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
              <div className="p-3 space-y-3 overflow-y-auto flex-1 text-xs">
                {/* Decision-First Summary */}
                <div className="p-2.5 rounded-lg bg-[#212121] border border-white/[0.08] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white">{activeSnapshot.label}</span>
                    <span className="font-mono text-[#10a37f]">
                      {activeSnapshot.summary.totalPassed}/{activeSnapshot.summary.totalMetrics} passed
                    </span>
                  </div>

                  {/* Clickable resolved checks styled consistently with Needs Fix / Needs Review */}
                  {activeSnapshot.resolvedIds.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-medium text-[#10a37f] flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#10a37f]" />
                        Fixed ({activeSnapshot.resolvedIds.length})
                      </div>
                      <div className="space-y-1">
                        {activeSnapshot.resolvedIds.map((id) => {
                          const item = activeSnapshot.summary.items.find((i) => i.id === id);
                          const cleanTitle = (item?.title || metricTitleMap.get(id) || id).replace(/\s*\(320px\)$/i, '');
                          const isHighlighted = highlightedMetricId === id;
                          return (
                            <button
                              key={id}
                              type="button"
                              onClick={() => {
                                setHighlightedMetricId((prev) => (prev === id ? null : id));
                                if (id === 'reflow') {
                                  selectViewportPreset('mobile');
                                }
                              }}
                              className={`w-full text-left p-2 rounded-lg border text-[11px] transition-colors ${
                                isHighlighted
                                  ? 'bg-[#383838] border-[#10a37f]'
                                  : 'bg-[#171717]/80 border-white/[0.06] hover:bg-[#2a2a2a]'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1.5">
                                <span className="font-medium text-[#ececec] truncate">{cleanTitle}</span>
                                {item?.priority && (
                                  <span className="text-[10px] font-mono text-[#9b9b9b] shrink-0">
                                    {item.priority}
                                  </span>
                                )}
                              </div>
                              {item?.measuredSummary && (
                                <div className="text-[10px] text-[#9b9b9b] mt-0.5 line-clamp-2">
                                  {item.measuredSummary}
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {activeSnapshot.vlmReview && (() => {
                    const vr = activeSnapshot.vlmReview;
                    const sentences = vr.critique.match(/[^.!?]+[.!?]+/g) || [vr.critique];
                    let shortTakeaway = sentences[0].trim();
                    if (sentences[1] && shortTakeaway.length + sentences[1].trim().length + 1 <= 150) {
                      shortTakeaway = `${shortTakeaway} ${sentences[1].trim()}`;
                    }
                    return (
                      <div
                        className={`p-2 rounded border text-[11px] space-y-1 ${
                          vr.verdict === 'approve'
                            ? 'bg-[#10a37f]/10 border-[#10a37f]/30 text-[#d4d4d4]'
                            : vr.verdict === 'warn'
                              ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                              : vr.verdict === 'reject'
                                ? 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                                : 'bg-[#2a2a2a] border-white/[0.1] text-[#d4d4d4]'
                        }`}
                      >
                        <div className="font-medium text-white">
                          {vr.verdict === 'approve'
                            ? 'Visual review passed'
                            : vr.verdict === 'warn'
                              ? 'Visual review: Needs review'
                              : vr.verdict === 'reject'
                                ? 'Visual review failed'
                                : 'Visual review unavailable'}
                        </div>
                        <div className="text-[11px] opacity-90 leading-snug select-text">
                          {shortTakeaway}
                        </div>
                        <details className="pt-0.5">
                          <summary className="cursor-pointer text-[10px] text-[#9b9b9b] hover:text-white">
                            Review details
                          </summary>
                          <div className="mt-1.5 space-y-1 text-[10px] text-[#b4b4b4] border-t border-white/[0.08] pt-1.5 select-text">
                            <div className="font-mono">
                              {vr.visualScore !== undefined
                                ? `Visual ${vr.visualScore}/5 · ${vr.semanticPass ? 'Semantic OK' : 'Semantic Issue'}`
                                : 'No VLM score'}
                              {' · '}
                              {vr.guardPassed !== false ? 'Guard passed' : 'Guard failed'}
                              {vr.viewportEvaluated ? ` · ${vr.viewportEvaluated}` : ''}
                            </div>
                            <p className="leading-relaxed">{vr.critique}</p>
                            {activeSnapshot.notes && (
                              <p className="leading-relaxed text-[#9b9b9b]">Patch note: {activeSnapshot.notes}</p>
                            )}
                          </div>
                        </details>
                      </div>
                    );
                  })()}

                  {savedApprovalInfo && (
                    <div className="text-[11px] text-[#10a37f] pt-0.5">
                      Saved: {savedApprovalInfo.label} ({savedApprovalInfo.score})
                    </div>
                  )}
                </div>

                {/* Split Remaining Issues: Must Fix (Fail) vs Needs Review */}
                {remainingIssues.length === 0 ? (
                  <div className="text-[11px] text-[#10a37f]">All applicable metrics passed!</div>
                ) : (
                  <div className="space-y-3">
                    {failIssues.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="text-[11px] font-medium text-rose-300 flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5 text-rose-400" />
                          Needs Fix ({failIssues.length})
                        </div>
                        <div className="space-y-1">
                          {failIssues.map((item) => {
                            const isActive = highlightedMetricId === item.id;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => setHighlightedMetricId((prev) => (prev === item.id ? null : item.id))}
                                className={`w-full text-left p-2 rounded-lg border text-[11px] transition-colors ${isActive
                                  ? 'bg-[#383838] border-[#0d99ff]'
                                  : 'bg-[#212121] border-white/[0.06] hover:bg-[#2a2a2a]'
                                  }`}
                              >
                                <div className="flex items-center justify-between gap-1.5">
                                  <span className="font-medium text-[#ececec] truncate">{item.title}</span>
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
                      </div>
                    )}

                    {reviewIssues.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="text-[11px] font-medium text-amber-300 flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                          Needs Review ({reviewIssues.length})
                        </div>
                        <div className="space-y-1">
                          {reviewIssues.map((item) => {
                            const isActive = highlightedMetricId === item.id;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => setHighlightedMetricId((prev) => (prev === item.id ? null : item.id))}
                                className={`w-full text-left p-2 rounded-lg border text-[11px] transition-colors ${isActive
                                  ? 'bg-[#383838] border-[#0d99ff]'
                                  : 'bg-[#212121] border-white/[0.06] hover:bg-[#2a2a2a]'
                                  }`}
                              >
                                <div className="flex items-center justify-between gap-1.5">
                                  <span className="font-medium text-[#ececec] truncate">{item.title}</span>
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
                      </div>
                    )}
                  </div>
                )}

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
              )}
            </aside>
        </div>
    </div>
  );
}
