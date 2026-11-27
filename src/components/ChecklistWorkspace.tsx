'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  CheckCircle2,
  ChevronDown,
  Code2,
  Copy,
  Download,
  Eye,
  FolderUp,
  Layers,
  Link2,
  Loader2,
  Maximize2,
  MinusCircle,
  Play,
  Sparkles,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import { buildBatchAuditReport } from '@/lib/checklist/aggregator';
import {
  FigmaReviewCanvas,
  type CanvasCompareMode,
  type CanvasViewportPreset,
} from './FigmaReviewCanvas';
import type {
  AutoIterationResult,
  BatchAuditReport,
  BatchPageAuditResult,
  ChecklistItemResult,
  ChecklistStatus,
  IterationSnapshot,
  StopReason,
} from '@/lib/checklist/types';

interface ChecklistWorkspaceProps {
  initialHtml?: string;
  baselinePages?: string[];
  baselineDir?: string;
}

function StatusIcon({ status }: { status: ChecklistStatus }) {
  if (status === 'pass') return <CheckCircle2 className="w-4 h-4 text-[#10a37f] shrink-0" />;
  if (status === 'fail') return <XCircle className="w-4 h-4 text-rose-400 shrink-0" />;
  if (status === 'needsReview') return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />;
  return <MinusCircle className="w-4 h-4 text-[#6b7280] shrink-0" />;
}

function formatStopReason(reason: StopReason): string {
  switch (reason) {
    case 'audit_only':
      return 'Baseline audit complete';
    case 'all_passed':
      return 'All checks passed';
    case 'targets_passed':
      return 'Selected targets passed';
    case 'no_improvement':
      return 'Stopped (no further improvement)';
    case 'max_iterations':
      return 'Max iterations reached';
  }
}

function injectHighlightCss(html: string, selectors: string[]): string {
  const valid = selectors
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('missing '));
  if (valid.length === 0) return html;
  const css = `${valid.join(', ')} { outline: 3px solid #f43f5e !important; outline-offset: 2px !important; background-color: rgba(244, 63, 94, 0.08) !important; }`;
  const tag = `<style data-proofui-highlight="true">${css}</style>`;
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${tag}\n</head>`);
  return `${tag}\n${html}`;
}

function ScaledIframePreview({
  title,
  html,
  viewport,
  zoom = 'fit',
  heightPx = 540,
  iframeRef,
}: {
  title: string;
  html: string;
  viewport: 'desktop' | 'tablet' | 'mobile375' | 'mobile320';
  zoom?: 'fit' | 'actual';
  heightPx?: number;
  iframeRef?: React.RefObject<HTMLIFrameElement | null>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(720);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      if (el.clientWidth > 0) setContainerWidth(el.clientWidth);
    };
    update();
    const obs = new ResizeObserver(update);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  if (viewport === 'mobile320' || viewport === 'mobile375') {
    const mobileWidth = viewport === 'mobile320' ? 320 : 375;
    return (
      <div ref={containerRef} className="w-full flex justify-center bg-[#212121] overflow-auto">
        <iframe
          ref={iframeRef}
          title={title}
          srcDoc={html}
          sandbox="allow-same-origin"
          style={{ width: mobileWidth, height: heightPx }}
          className="bg-white border-0 shrink-0"
        />
      </div>
    );
  }

  const targetWidth = viewport === 'tablet' ? 768 : 1280;
  if (zoom === 'actual') {
    return (
      <div ref={containerRef} style={{ height: heightPx }} className="w-full overflow-auto bg-white">
        <iframe
          ref={iframeRef}
          title={title}
          srcDoc={html}
          sandbox="allow-same-origin"
          style={{ width: targetWidth, height: heightPx }}
          className="bg-white border-0 block"
        />
      </div>
    );
  }

  const scale = Math.min(1, containerWidth / targetWidth);
  const innerHeight = Math.round(heightPx / scale);

  return (
    <div
      ref={containerRef}
      style={{ height: heightPx }}
      className="w-full overflow-hidden bg-white relative"
    >
      <iframe
        ref={iframeRef}
        title={title}
        srcDoc={html}
        sandbox="allow-same-origin"
        style={{
          width: targetWidth,
          height: innerHeight,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
        className="bg-white border-0 block"
      />
    </div>
  );
}

export function ChecklistWorkspace({
  initialHtml = '',
  baselinePages = [],
  baselineDir = '',
}: ChecklistWorkspaceProps) {
  const [selectedPage, setSelectedPage] = useState<string>('untitled.html');
  const [htmlInput, setHtmlInput] = useState<string>('');
  const [usingExample, setUsingExample] = useState<boolean>(false);
  const [isDetectingContext, setIsDetectingContext] = useState<boolean>(false);
  const [uploadedProject, setUploadedProject] = useState<{
    name: string;
    files: Record<string, string>;
    htmlPages: string[];
  } | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [pageMenuOpen, setPageMenuOpen] = useState<boolean>(false);
  const pageMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!pageMenuOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (pageMenuRef.current && !pageMenuRef.current.contains(e.target as Node)) {
        setPageMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    return () => window.removeEventListener('mousedown', onPointerDown);
  }, [pageMenuOpen]);
  const [baselineViewMode, setBaselineViewMode] = useState<'preview' | 'code'>('preview');
  const [auditScope, setAuditScope] = useState<'current' | 'all'>('current');
  const [activeStage, setActiveStage] = useState<'input' | 'audit' | 'optimize'>('input');
  const [auditTab, setAuditTab] = useState<'priority' | 'checklist'>('priority');
  const [optimizeTab, setOptimizeTab] = useState<'compare' | 'checklist'>('compare');
  const [canvasViewport, setCanvasViewport] = useState<CanvasViewportPreset>('desktop');
  const [canvasCompareMode, setCanvasCompareMode] = useState<CanvasCompareMode>('split');

  // Step 1: Context & Requirements
  const [productGoal, setProductGoal] = useState<string>('');
  const [brandKeywords, setBrandKeywords] = useState<string>('');
  const [themeColors, setThemeColors] = useState<Array<{ hex: string; role: string }>>([]);
  const [targetAudience, setTargetAudience] = useState<string>('');
  const [additionalContext, setAdditionalContext] = useState<string>('');

  const buildAuditContext = () => {
    const paletteStr = themeColors
      .filter((c) => c.hex.trim())
      .map((c) => `${c.role} ${c.hex.trim()}`)
      .join(', ');
    const composedTheme = [paletteStr, brandKeywords.trim()].filter(Boolean).join(' · ');
    return {
      productGoal: productGoal.trim() || undefined,
      targetAudience: targetAudience.trim() || undefined,
      theme: composedTheme || undefined,
      customPrompt: additionalContext.trim() || undefined,
    };
  };

  // Step 3: Designer Prioritization & Evidence Inspection
  const [priorityOrder, setPriorityOrder] = useState<string[]>([]);
  const [selectedMetricIds, setSelectedMetricIds] = useState<Set<string>>(new Set());
  const [reviewedMetricIds, setReviewedMetricIds] = useState<Set<string>>(new Set());
  const [inspectedMetricId, setInspectedMetricId] = useState<string | null>(null);

  // Step 5 & 6: Loop & Approval
  const [maxIterations, setMaxIterations] = useState<number>(3);
  const [loadingPhase, setLoadingPhase] = useState<'idle' | 'audit' | 'batch' | 'iterate'>('idle');
  const [error, setError] = useState<string>('');
  const [result, setResult] = useState<AutoIterationResult | null>(null);
  const [batchReport, setBatchReport] = useState<BatchAuditReport | null>(null);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; currentPage: string } | null>(null);
  const [selectedIter, setSelectedIter] = useState<number>(0);
  const [previewCompare, setPreviewCompare] = useState<'active' | 'split'>('split');
  const [previewViewport, setPreviewViewport] = useState<'desktop' | 'tablet' | 'mobile375' | 'mobile320'>('desktop');
  const [previewZoom, setPreviewZoom] = useState<'fit' | 'actual'>('fit');
  const [previewHeight, setPreviewHeight] = useState<520 | 720 | 960>(520);
  const [syncScroll, setSyncScroll] = useState<boolean>(true);
  const [fullScreenPreview, setFullScreenPreview] = useState<boolean>(false);
  const [approvedIter, setApprovedIter] = useState<number | null>(null);
  const [savedApprovalInfo, setSavedApprovalInfo] = useState<{ label: string; score: string; approvedAt: string } | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const leftFrameRef = useRef<HTMLIFrameElement>(null);
  const rightFrameRef = useRef<HTMLIFrameElement>(null);
  const modalLeftRef = useRef<HTMLIFrameElement>(null);
  const modalRightRef = useRef<HTMLIFrameElement>(null);
  const syncingRef = useRef<boolean>(false);

  useEffect(() => {
    fetch(`/api/checklist?page=${encodeURIComponent(selectedPage)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.savedApproval) {
          setSavedApprovalInfo({
            label: d.savedApproval.label,
            score: d.savedApproval.score,
            approvedAt: d.savedApproval.approvedAt,
          });
        } else {
          setSavedApprovalInfo(null);
        }
      })
      .catch(() => { });
  }, [selectedPage]);

  const attachSyncListeners = (
    leftEl: HTMLIFrameElement | null,
    rightEl: HTMLIFrameElement | null
  ) => {
    if (!syncScroll || !leftEl || !rightEl) return () => { };
    const leftWin = leftEl.contentWindow;
    const rightWin = rightEl.contentWindow;
    if (!leftWin || !rightWin) return () => { };

    const syncTo = (source: Window, target: Window) => {
      if (syncingRef.current) return;
      syncingRef.current = true;
      target.scrollTo(source.scrollX, source.scrollY);
      requestAnimationFrame(() => {
        syncingRef.current = false;
      });
    };

    const onLeftScroll = () => syncTo(leftWin, rightWin);
    const onRightScroll = () => syncTo(rightWin, leftWin);

    leftWin.addEventListener('scroll', onLeftScroll, { passive: true });
    rightWin.addEventListener('scroll', onRightScroll, { passive: true });

    return () => {
      leftWin.removeEventListener('scroll', onLeftScroll);
      rightWin.removeEventListener('scroll', onRightScroll);
    };
  };

  useEffect(() => {
    if (!fullScreenPreview) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullScreenPreview(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullScreenPreview]);

  useEffect(() => {
    return attachSyncListeners(leftFrameRef.current, rightFrameRef.current);
  });

  useEffect(() => {
    if (!fullScreenPreview) return;
    return attachSyncListeners(modalLeftRef.current, modalRightRef.current);
  });

  const runPipeline = async (mode: 'audit' | 'iterate') => {
    setLoadingPhase(mode);
    setError('');
    setApprovedIter(null);
    if (mode === 'audit') {
      setBatchReport(null);
    }
    try {
      const orderedSelected = priorityOrder.filter((id) => selectedMetricIds.has(id));

      if (mode === 'iterate') {
        const focusMetrics = orderedSelected
          .map((id) => priorityItemMap.get(id))
          .filter((item): item is ChecklistItemResult => Boolean(item))
          .map((item) => ({
            id: item.id,
            title: item.title,
            priority: item.priority,
            measuredSummary: item.measuredSummary,
            recommendation: item.recommendation,
            samples: item.samples,
          }));

        const res = await fetch('/api/ai-redesign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            html: htmlInput,
            context: buildAuditContext(),
            focusMetrics,
            maxIterations,
            startIterationNumber: 1,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success || !Array.isArray(data.iterations)) {
          throw new Error(data.error || 'Optimization failed');
        }

        const baseSnapshot: IterationSnapshot = result?.iterations[0] || {
          iteration: 0,
          label: 'Baseline',
          summary: data.baselineSummary,
          html: htmlInput,
          deltaFromBase: 0,
          deltaFromBaseline: 0,
          resolvedIds: [],
          regressedIds: [],
          fixerMode: 'baseline',
          notes: 'Initial audited snapshot',
        };
        const generated: IterationSnapshot[] = data.iterations;
        const bestIdx = 1 + (typeof data.bestIterationIndex === 'number' ? data.bestIterationIndex : 0);
        const bestSnap = generated[bestIdx - 1] || generated[generated.length - 1];
        const nextResult: AutoIterationResult = {
          bestIteration: bestIdx,
          stopReason:
            data.stopReason ||
            (bestSnap?.summary.totalFailed === 0 ? 'all_passed' : 'max_iterations'),
          iterations: [baseSnapshot, ...generated],
          feedback: result?.feedback,
        };
        setResult(nextResult);
        setSelectedIter(bestIdx);
        setActiveStage('optimize');
        setOptimizeTab('compare');
        return;
      }

      const res = await fetch('/api/checklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          html: htmlInput,
          mode: 'audit',
          maxIterations,
          context: buildAuditContext(),
          pageHint: selectedPage,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Audit failed');
      }
      const nextResult: AutoIterationResult = data.result;
      setResult(nextResult);
      setSelectedIter(nextResult.bestIteration ?? 0);

      const baselinePriority = nextResult.iterations[0]?.summary.priorityList || [];
      const ids = baselinePriority.map((i) => i.id);
      setPriorityOrder(ids);
      setReviewedMetricIds(new Set());
      // Auto-select only fail items by default; needsReview requires human evidence review first
      setSelectedMetricIds(new Set(baselinePriority.filter((i) => i.status === 'fail').map((i) => i.id)));
      const firstFail = baselinePriority[0];
      if (firstFail) {
        setInspectedMetricId(firstFail.id);
        setPreviewViewport(firstFail.id === 'reflow' ? 'mobile320' : 'desktop');
      }
      setActiveStage('optimize');
      setOptimizeTab('compare');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoadingPhase('idle');
    }
  };

  const downloadJsonFile = (filename: string, data: unknown) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const loadPageHtml = async (page: string): Promise<string> => {
    if (uploadedProject) {
      return bundleUploadedHtml(page, uploadedProject.files);
    }
    const res = await fetch(`/api/checklist?page=${encodeURIComponent(page)}`);
    const data = await res.json();
    if (!res.ok || !data.success || typeof data.html !== 'string') {
      throw new Error(data.error || `Failed to load ${page}`);
    }
    return data.html;
  };

  const applyAuditResultToWorkspace = (
    page: string,
    pageHtml: string,
    nextResult: AutoIterationResult,
    openStudio = true
  ) => {
    setSelectedPage(page);
    setHtmlInput(pageHtml);
    setResult(nextResult);
    setSelectedIter(nextResult.bestIteration ?? 0);
    setApprovedIter(null);
    const baselinePriority = nextResult.iterations[0]?.summary.priorityList || [];
    setPriorityOrder(baselinePriority.map((i) => i.id));
    setReviewedMetricIds(new Set());
    setSelectedMetricIds(new Set(baselinePriority.filter((i) => i.status === 'fail').map((i) => i.id)));
    const firstFail = baselinePriority[0];
    if (firstFail) {
      setInspectedMetricId(firstFail.id);
      setPreviewViewport(firstFail.id === 'reflow' ? 'mobile320' : 'desktop');
    }
    if (openStudio) {
      setActiveStage('optimize');
      setOptimizeTab('compare');
    }
  };

  const runBatchAudit = async () => {
    if (activePages.length === 0) return;
    setLoadingPhase('batch');
    setError('');
    setApprovedIter(null);
    setBatchReport(null);
    const pageResults: BatchPageAuditResult[] = [];

    try {
      for (let i = 0; i < activePages.length; i++) {
        const page = activePages[i];
        setBatchProgress({ current: i + 1, total: activePages.length, currentPage: page });
        const startedAt = performance.now();
        try {
          const pageHtml = await loadPageHtml(page);
          const res = await fetch('/api/checklist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              html: pageHtml,
              mode: 'audit',
              maxIterations: 1,
              context: buildAuditContext(),
              pageHint: page,
            }),
          });
          const data = await res.json();
          if (!res.ok || !data.success) {
            throw new Error(data.error || `Audit failed for ${page}`);
          }
          const pageAudit: AutoIterationResult = data.result;
          const baseline = pageAudit.iterations[0];
          pageResults.push({
            page,
            result: pageAudit,
            summary: baseline.summary,
            feedback: pageAudit.feedback || { summary: { totalFailing: 0 }, issues: [] },
            durationMs: Math.round(performance.now() - startedAt),
          });
        } catch (err) {
          const emptySummary = {
            totalPassed: 0,
            totalFailed: 0,
            totalNeedsReview: 0,
            totalNotApplicable: 0,
            totalMetrics: 0,
            passRate: 0,
            ux: { passed: 0, total: 0 },
            ui: { passed: 0, total: 0 },
            pillars: [],
            items: [],
            priorityList: [],
          };
          pageResults.push({
            page,
            result: { bestIteration: 0, stopReason: 'audit_only', iterations: [] },
            summary: emptySummary,
            feedback: { summary: { totalFailing: 0 }, issues: [] },
            durationMs: Math.round(performance.now() - startedAt),
            error: err instanceof Error ? err.message : 'Batch page audit failed',
          });
        }
      }

      const report = buildBatchAuditReport(
        uploadedProject ? uploadedProject.name : baselineDir || 'Baseline Site',
        pageResults,
        buildAuditContext()
      );
      setBatchReport(report);

      const focusPageName = report.aggregate.worstPage || pageResults.find((p) => !p.error)?.page;
      const focusResult = pageResults.find((p) => p.page === focusPageName && !p.error);
      if (focusResult) {
        const focusHtml = focusResult.result.iterations[0]?.html || (await loadPageHtml(focusResult.page));
        applyAuditResultToWorkspace(focusResult.page, focusHtml, focusResult.result, false);
      } else {
        setError('All pages in batch audit failed.');
      }
    } finally {
      setBatchProgress(null);
      setLoadingPhase('idle');
    }
  };

  const selectBatchPageForOptimize = async (pageEntry: BatchPageAuditResult) => {
    if (pageEntry.error) return;
    setError('');
    try {
      const pageHtml = pageEntry.result.iterations[0]?.html || (await loadPageHtml(pageEntry.page));
      applyAuditResultToWorkspace(pageEntry.page, pageHtml, pageEntry.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to load ${pageEntry.page}`);
    }
  };

  const baselineSnapshot = result?.iterations[0] || null;
  const activeSnapshot = result?.iterations[selectedIter] || baselineSnapshot;
  const hasOptimizationRuns = Boolean(result && result.iterations.length > 1);

  const priorityItemMap = useMemo(() => {
    const map = new Map<string, ChecklistItemResult>();
    for (const item of baselineSnapshot?.summary.priorityList || []) {
      map.set(item.id, item);
    }
    return map;
  }, [baselineSnapshot]);

  const inspectedItem = inspectedMetricId ? priorityItemMap.get(inspectedMetricId) || null : null;

  const selectedReadyCount = useMemo(() => {
    return priorityOrder.filter((id) => {
      if (!selectedMetricIds.has(id)) return false;
      const item = priorityItemMap.get(id);
      if (!item) return false;
      return item.status === 'fail' || reviewedMetricIds.has(id);
    }).length;
  }, [priorityOrder, selectedMetricIds, priorityItemMap, reviewedMetricIds]);

  const bundleUploadedHtml = (pageName: string, files: Record<string, string>): string => {
    let html = files[pageName] || '';
    const findAsset = (ref: string) => {
      const clean = ref.replace(/^\.\//, '').split('?')[0].split('#')[0];
      if (files[clean] !== undefined) return files[clean];
      const base = clean.split('/').pop() || clean;
      const matchKey = Object.keys(files).find((k) => k === base || k.endsWith(`/${base}`));
      return matchKey ? files[matchKey] : undefined;
    };

    html = html.replace(
      /<link\s+[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*\/?>/gi,
      (full, href) => {
        const css = findAsset(href);
        return css !== undefined ? `<style data-source="${href}">\n${css}\n</style>` : full;
      }
    );

    html = html.replace(
      /<script\s+[^>]*src=["']([^"']+)["'][^>]*>\s*<\/script>/gi,
      (full, src) => {
        const js = findAsset(src);
        if (js === undefined) return full;
        const safeJs = js.replace(/<\/script>/gi, '<\\/script>');
        return `<script data-source="${src}">\n${safeJs}\n</script>`;
      }
    );

    return html;
  };

  const handleUploadedFileList = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files: Record<string, string> = {};
    let rootFolderName = 'Uploaded Source';

    for (const file of Array.from(fileList)) {
      const lower = file.name.toLowerCase();
      if (!/\.(html?|css|js)$/i.test(lower)) continue;
      const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
      const parts = rel.split('/');
      if (parts.length > 1 && rootFolderName === 'Uploaded Source') {
        rootFolderName = parts[0];
      }
      const key = parts.length > 1 ? parts.slice(1).join('/') : rel;
      files[key] = await file.text();
    }

    const htmlPages = Object.keys(files)
      .filter((k) => /\.html?$/i.test(k))
      .sort((a, b) => (a === 'index.html' ? -1 : b === 'index.html' ? 1 : a.localeCompare(b)));

    if (htmlPages.length === 0) {
      setError('No .html file found in the uploaded selection.');
      return;
    }

    const firstPage = htmlPages[0];
    const bundled = bundleUploadedHtml(firstPage, files);
    setUsingExample(false);
    setUploadedProject({ name: rootFolderName, files, htmlPages });
    setSelectedPage(firstPage);
    setHtmlInput(bundled);
    setResult(null);
    setPriorityOrder([]);
    setReviewedMetricIds(new Set());
    setError('');
    if (!productGoal.trim()) {
      void handleAutoGenerateContext(bundled);
    }
  };

  const loadBookingExample = async () => {
    setUploadedProject(null);
    setUsingExample(true);
    const defaultPage = baselinePages[0] || 'index.html';
    setSelectedPage(defaultPage);
    setResult(null);
    setBatchReport(null);
    setPriorityOrder([]);
    setReviewedMetricIds(new Set());
    setError('');
    setProductGoal('Hotel search & booking conversion');
    setBrandKeywords('Trustworthy, clear, conversion-focused');
    setThemeColors([
      { hex: '#003580', role: 'Primary' },
      { hex: '#FFB700', role: 'Accent' },
    ]);
    setTargetAudience('Travelers on desktop & mobile');
    setAdditionalContext('Booking.com blue (#003580) & yellow (#ffb700); preserve search bar & card hierarchy');
    if (initialHtml && defaultPage === (baselinePages[0] || 'index.html')) {
      setHtmlInput(initialHtml);
      return;
    }
    try {
      const res = await fetch(`/api/checklist?page=${encodeURIComponent(defaultPage)}`);
      const data = await res.json();
      if (res.ok && data.success) setHtmlInput(data.html);
    } catch {
      setHtmlInput(initialHtml);
    }
  };

  const clearWorkspaceInput = () => {
    setUploadedProject(null);
    setUsingExample(false);
    setSelectedPage('untitled.html');
    setHtmlInput('');
    setResult(null);
    setBatchReport(null);
    setPriorityOrder([]);
    setReviewedMetricIds(new Set());
    setProductGoal('');
    setBrandKeywords('');
    setThemeColors([]);
    setTargetAudience('');
    setAdditionalContext('');
    setError('');
  };

  const handleAutoGenerateContext = async (overrideHtml?: string) => {
    const sourceHtml = (overrideHtml ?? htmlInput).trim();
    if (!sourceHtml || isDetectingContext) return;
    setIsDetectingContext(true);
    setError('');
    try {
      const res = await fetch('/api/context/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: sourceHtml }),
      });
      const data = await res.json();
      if (!res.ok || !data.success || !data.context) {
        throw new Error(data.error || 'Failed to detect context');
      }
      const ctx = data.context;
      if (ctx.productGoal) setProductGoal(ctx.productGoal);
      if (ctx.brandKeywords) setBrandKeywords(ctx.brandKeywords);
      if (Array.isArray(ctx.themeColors) && ctx.themeColors.length > 0) {
        setThemeColors(ctx.themeColors);
      } else if (ctx.themeColor) {
        setThemeColors([{ hex: ctx.themeColor, role: 'Primary' }]);
      }
      if (ctx.targetAudience) setTargetAudience(ctx.targetAudience);
      if (ctx.additionalContext) setAdditionalContext(ctx.additionalContext);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Context detection failed');
    } finally {
      setIsDetectingContext(false);
    }
  };

  const activePages = uploadedProject ? uploadedProject.htmlPages : usingExample ? baselinePages : [];

  const confirmNeedsReview = (id: string) => {
    setReviewedMetricIds((prev) => new Set(prev).add(id));
    setSelectedMetricIds((prev) => new Set(prev).add(id));
  };

  const selectedReviewCount = useMemo(() => {
    return priorityOrder.filter((id) => {
      if (!selectedMetricIds.has(id)) return false;
      return priorityItemMap.get(id)?.status === 'needsReview';
    }).length;
  }, [priorityOrder, selectedMetricIds, priorityItemMap]);

  const movePriority = (id: string, dir: -1 | 1) => {
    setPriorityOrder((prev) => {
      const idx = prev.indexOf(id);
      const nextIdx = idx + dir;
      if (idx === -1 || nextIdx < 0 || nextIdx >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[nextIdx]] = [copy[nextIdx], copy[idx]];
      return copy;
    });
  };

  const toggleMetric = (id: string) => {
    setSelectedMetricIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const inspectMetric = (item: ChecklistItemResult) => {
    setInspectedMetricId(item.id);
    if (item.id === 'reflow') {
      setPreviewViewport('mobile320');
    } else {
      setPreviewViewport('desktop');
    }
  };

  const handleCopyHtml = async () => {
    await navigator.clipboard.writeText(activeSnapshot?.html || htmlInput);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDownloadHtml = () => {
    const content = activeSnapshot?.html || htmlInput;
    const baseName = selectedPage.replace(/\.html?$/i, '') || 'page';
    const suffix = activeSnapshot && activeSnapshot.iteration > 0 ? `-iter-${activeSnapshot.iteration}` : '-audited';
    const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${baseName}${suffix}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleApproveSnapshot = async (snapshot: IterationSnapshot) => {
    setApprovedIter(snapshot.iteration);
    try {
      const res = await fetch('/api/checklist', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page: selectedPage,
          iteration: snapshot.iteration,
          label: snapshot.label,
          score: `${snapshot.summary.totalPassed}/${snapshot.summary.totalMetrics}`,
          html: snapshot.html,
        }),
      });
      const d = await res.json();
      if (d.success && d.approval) {
        setSavedApprovalInfo({
          label: d.approval.label,
          score: d.approval.score,
          approvedAt: d.approval.approvedAt,
        });
      }
    } catch {
      // Keep UI approval state
    }
  };

  const renderPillarCard = (pillar: NonNullable<typeof activeSnapshot>['summary']['pillars'][number]) => {
    const pct = pillar.total > 0 ? Math.round((pillar.passed / pillar.total) * 100) : 0;
    return (
      <div key={pillar.id} className="rounded-xl bg-[#171717] border border-white/[0.08] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-white">{pillar.label}</h3>
          <span className="text-xs font-mono text-[#10a37f]">
            {pillar.passed}/{pillar.total}
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-[#2f2f2f] overflow-hidden">
          <div className="h-full bg-[#10a37f] transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="space-y-2 pt-1">
          {pillar.items.map((item: ChecklistItemResult) => (
            <div
              key={item.id}
              className={`flex items-start gap-2.5 p-2 rounded-lg bg-[#212121] border border-white/[0.05] ${item.status === 'notApplicable' ? 'opacity-60' : ''
                }`}
            >
              <StatusIcon status={item.status} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-[#ececec] text-xs">{item.title}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    {activeSnapshot?.resolvedIds.includes(item.id) && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#10a37f]/20 text-[#10a37f]">
                        FIXED
                      </span>
                    )}
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#212121] border border-white/[0.08] text-[#8e8e8e]">
                      {item.viewport}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#2f2f2f] text-[#9b9b9b]">
                      {item.status === 'notApplicable' ? 'N/A' : item.priority}
                    </span>
                  </div>
                </div>
                <div className="text-[11px] text-[#9b9b9b] mt-0.5">{item.measuredSummary}</div>
                {item.status !== 'pass' && item.status !== 'notApplicable' && item.samples.length > 0 && (
                  <div className="text-[11px] font-mono text-[#8e8e8e] mt-1 truncate">
                    {item.samples.join(', ')}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#212121] text-[#ececec] text-[13px]">
      <main className="max-w-7xl mx-auto p-6 space-y-5">
        {/* 2-Zone Stepper Bar: Input & Batch Overview -> Figma Review Studio */}
        <nav className="rounded-xl bg-[#2c2c2c] border border-white/[0.1] px-3 py-2 flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex flex-wrap items-center rounded-full bg-[#1e1e1e] p-0.5 border border-white/[0.08] gap-0.5">
            <button
              type="button"
              onClick={() => setActiveStage('input')}
              className={`inline-flex items-center h-7 px-3.5 rounded-full text-xs transition-colors ${activeStage === 'input'
                ? 'bg-[#3f3f3f] text-white font-medium shadow-sm'
                : 'text-[#9b9b9b] hover:text-white'
                }`}
            >
              1. Input &amp; Batch Overview
            </button>
            <button
              type="button"
              disabled={!result}
              onClick={() => result && setActiveStage('optimize')}
              className={`inline-flex items-center h-7 px-3.5 rounded-full text-xs transition-colors disabled:text-[#737373] disabled:cursor-not-allowed ${activeStage === 'optimize'
                ? 'bg-[#3f3f3f] text-white font-medium shadow-sm'
                : 'text-[#9b9b9b] hover:text-white'
                }`}
            >
              2. Figma Review Studio
            </button>
          </div>
        </nav>

        {/* Stage 1: Input & Context */}
        {activeStage === 'input' && (
          <section className="rounded-xl bg-[#171717] border border-white/[0.08] p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-white">Input &amp; Context</span>
                {baselinePages.length > 0 && !usingExample && !uploadedProject && !htmlInput.trim() && (
                  <button
                    type="button"
                    onClick={() => void loadBookingExample()}
                    className="!min-h-0 !min-w-0 inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-[#1e1e1e] border border-white/[0.08] hover:bg-[#383838] text-[11px] text-[#b4b4b4] hover:text-white transition-colors"
                    title="Load sample Booking pages"
                  >
                    <Sparkles className="w-3 h-3 text-[#10a37f]" />
                    Example: Booking
                  </button>
                )}
                {(uploadedProject || usingExample || htmlInput.trim().length > 0) && (
                  <button
                    type="button"
                    onClick={clearWorkspaceInput}
                    className="!min-h-0 !min-w-0 inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-[#1e1e1e] border border-white/[0.08] hover:bg-[#383838] hover:text-white text-[11px] text-[#9b9b9b] transition-colors"
                    title="Clear uploaded source and start over"
                  >
                    <X className="w-3 h-3" />
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Upload Source Code Section (hidden once files/example/HTML are loaded) */}
            {!uploadedProject && !usingExample && !htmlInput.trim() && (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  void handleUploadedFileList(e.dataTransfer.files);
                }}
                className={`rounded-lg border border-dashed px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-3 transition-colors ${isDragging
                  ? 'border-[#10a37f] bg-[#10a37f]/10'
                  : 'border-white/[0.15] bg-[#212121]'
                  }`}
              >
                <div className="flex items-center gap-2.5 text-xs">
                  <Upload className="w-4 h-4 text-[#10a37f] shrink-0" />
                  <span className="text-[#9b9b9b]">
                    Drop a <strong className="text-[#ececec]">website folder</strong> or <strong className="text-[#ececec]">HTML/CSS/JS files</strong> here
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={folderInputRef}
                    type="file"
                    // @ts-expect-error webkitdirectory is standard in Chromium/Safari for folder upload
                    webkitdirectory=""
                    directory=""
                    className="hidden"
                    onChange={(e) => {
                      void handleUploadedFileList(e.target.files);
                      e.target.value = '';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => folderInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-[#383838] hover:bg-[#444] text-xs font-medium text-[#ececec] transition-colors"
                  >
                    <FolderUp className="w-3.5 h-3.5" />
                    Upload Folder
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-3 pt-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-medium text-[#ececec]">Product Context</div>
                  <p className="text-[11px] text-[#9b9b9b] mt-0.5">
                    Provide design goals, branding, or audience to guide context-aware AI critiques.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleAutoGenerateContext()}
                  disabled={!htmlInput.trim() || isDetectingContext}
                  className="!min-h-0 !min-w-0 inline-flex items-center gap-1 h-6 px-2.5 rounded-full bg-[#383838] hover:bg-[#444] disabled:opacity-40 disabled:cursor-not-allowed text-[11px] font-medium text-[#ececec] transition-colors shrink-0"
                  title="Analyze HTML with AI to detect Product Goal, Brand Keywords, Theme Colors, Target Audience, and Additional Context"
                >
                  {isDetectingContext ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Sparkles className="w-3 h-3 text-[#10a37f]" />
                  )}
                  {isDetectingContext ? 'Analyzing with AI...' : 'Auto-generate context'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="ctx-product-goal" className="block text-[11px] font-medium text-[#9b9b9b]">
                    Product Goal
                  </label>
                  <textarea
                    id="ctx-product-goal"
                    rows={2}
                    value={productGoal}
                    onChange={(e) => setProductGoal(e.target.value)}
                    placeholder="Help students find and register for courses easily."
                    className="w-full px-3 py-1.5 rounded-lg bg-[#212121] border border-white/[0.1] text-xs leading-relaxed resize-y"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="ctx-audience" className="block text-[11px] font-medium text-[#9b9b9b]">
                    Target Audience
                  </label>
                  <textarea
                    id="ctx-audience"
                    rows={2}
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value)}
                    placeholder="University students using mobile devices"
                    className="w-full px-3 py-1.5 rounded-lg bg-[#212121] border border-white/[0.1] text-xs leading-relaxed resize-y"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="ctx-brand-keywords" className="block text-[11px] font-medium text-[#9b9b9b]">
                    Brand Keywords
                  </label>
                  <input
                    id="ctx-brand-keywords"
                    value={brandKeywords}
                    onChange={(e) => setBrandKeywords(e.target.value)}
                    placeholder="Friendly, trustworthy, clear"
                    className="w-full h-8 px-3 rounded-lg bg-[#212121] border border-white/[0.1] text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <span className="block text-[11px] font-medium text-[#9b9b9b]">
                    Theme Colors
                  </span>
                  <div className="flex flex-wrap items-center justify-between gap-1.5 min-h-[32px] px-2 py-[3px] rounded-lg bg-[#212121] border border-white/[0.1]">
                    <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
                      {themeColors.length === 0 && (
                        <span className="text-xs text-[#6b7280] px-1">
                          Add brand colors (e.g. Primary, Accent)
                        </span>
                      )}
                      {themeColors.map((c, idx) => {
                        const safeHex = /^#[0-9a-f]{6}$/i.test(c.hex.trim())
                          ? c.hex.trim()
                          : '#2563EB';
                        return (
                          <div
                            key={`${c.hex}-${idx}`}
                            className="inline-flex items-center gap-1.5 h-6 pl-1.5 pr-1 rounded-full bg-[#2c2c2c] border border-white/[0.1] text-[11px]"
                          >
                            <label
                              title="Pick color"
                              style={{ backgroundColor: safeHex }}
                              className="relative w-3.5 h-3.5 rounded-full ring-1 ring-white/25 cursor-pointer shrink-0 overflow-hidden"
                            >
                              <input
                                type="color"
                                aria-label={`Color ${idx + 1}`}
                                value={safeHex}
                                onChange={(e) => {
                                  const nextHex = e.target.value.toUpperCase();
                                  setThemeColors((prev) =>
                                    prev.map((item, i) => (i === idx ? { ...item, hex: nextHex } : item))
                                  );
                                }}
                                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                              />
                            </label>
                            <input
                              value={c.hex}
                              onChange={(e) => {
                                const val = e.target.value;
                                setThemeColors((prev) =>
                                  prev.map((item, i) => (i === idx ? { ...item, hex: val } : item))
                                );
                              }}
                              className="w-[62px] bg-transparent font-mono text-[11px] uppercase text-[#ececec] focus:outline-none"
                              placeholder="#2563EB"
                            />
                            <select
                              aria-label={`Color ${idx + 1} role`}
                              value={c.role}
                              onChange={(e) => {
                                const role = e.target.value;
                                setThemeColors((prev) =>
                                  prev.map((item, i) => (i === idx ? { ...item, role } : item))
                                );
                              }}
                              className="bg-transparent text-[10px] text-[#9b9b9b] focus:outline-none cursor-pointer"
                            >
                              <option value="Primary">Primary</option>
                              <option value="Secondary">Secondary</option>
                              <option value="Accent">Accent</option>
                              <option value="Highlight">Highlight</option>
                            </select>
                            <button
                              type="button"
                              onClick={() =>
                                setThemeColors((prev) => prev.filter((_, i) => i !== idx))
                              }
                              className="!min-h-0 !min-w-0 p-0.5 rounded-full hover:bg-[#383838] text-[#9b9b9b] hover:text-white"
                              title="Remove color"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    {themeColors.length < 6 && (
                      <button
                        type="button"
                        onClick={() => {
                          const defaultRoles = ['Primary', 'Secondary', 'Accent', 'Highlight'];
                          const nextRole = defaultRoles[themeColors.length] || 'Accent';
                          setThemeColors((prev) => [...prev, { hex: '#2563EB', role: nextRole }]);
                        }}
                        className="!min-h-0 !min-w-0 inline-flex items-center gap-1 h-6 px-2.5 rounded-full bg-[#383838] hover:bg-[#444] text-[10px] font-medium text-[#ececec] transition-colors shrink-0"
                      >
                        + Add color
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="ctx-additional" className="block text-[11px] font-medium text-[#9b9b9b]">
                  Others / Additional Context
                </label>
                <textarea
                  id="ctx-additional"
                  rows={2}
                  value={additionalContext}
                  onChange={(e) => setAdditionalContext(e.target.value)}
                  placeholder="Key task, platform, language, design constraints or evaluation focus"
                  className="w-full px-3 py-1.5 rounded-lg bg-[#212121] border border-white/[0.1] text-xs resize-y"
                />
              </div>
            </div>

            {(htmlInput.trim() || baselineViewMode === 'code') ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium text-[#9b9b9b]">
                      {baselineViewMode === 'preview' ? 'Live Preview' : 'HTML Source'}
                    </span>
                    {activePages.length > 0 && (
                      <div ref={pageMenuRef} className="relative">
                        <button
                          type="button"
                          title={uploadedProject ? uploadedProject.name : baselineDir}
                          onClick={() => setPageMenuOpen((v) => !v)}
                          className="!min-h-0 !min-w-0 inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-[#1e1e1e] border border-white/[0.08] hover:bg-[#2c2c2c] hover:border-white/20 text-[11px] font-mono text-[#ececec] transition-colors"
                        >
                          <span className="truncate max-w-[180px]">{selectedPage}</span>
                          <ChevronDown
                            className={`w-3 h-3 text-[#9b9b9b] transition-transform duration-150 ${pageMenuOpen ? 'rotate-180' : ''
                              }`}
                          />
                        </button>
                        {pageMenuOpen && (
                          <div className="absolute left-0 top-full mt-1.5 z-40 min-w-[200px] max-w-[280px] max-h-[260px] overflow-y-auto rounded-xl bg-[#2c2c2c] border border-white/[0.1] shadow-2xl p-1 space-y-0.5">
                            {activePages.map((p) => {
                              const isSelected = p === selectedPage;
                              return (
                                <button
                                  key={p}
                                  type="button"
                                  onClick={async () => {
                                    setPageMenuOpen(false);
                                    setSelectedPage(p);
                                    setError('');
                                    setResult(null);
                                    setPriorityOrder([]);
                                    setReviewedMetricIds(new Set());
                                    if (uploadedProject) {
                                      setHtmlInput(bundleUploadedHtml(p, uploadedProject.files));
                                      return;
                                    }
                                    try {
                                      const res = await fetch(`/api/checklist?page=${encodeURIComponent(p)}`);
                                      const data = await res.json();
                                      if (res.ok && data.success) {
                                        setHtmlInput(data.html);
                                      } else {
                                        setError(data.error || 'Failed to load page');
                                      }
                                    } catch {
                                      setError('Failed to load baseline page');
                                    }
                                  }}
                                  className={`!min-h-0 !min-w-0 w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-left text-[11px] font-mono transition-colors ${isSelected
                                    ? 'bg-[#3f3f3f] text-white font-medium'
                                    : 'text-[#d4d4d4] hover:bg-[#383838] hover:text-white'
                                    }`}
                                >
                                  <span className="truncate">{p}</span>
                                  {isSelected && <Check className="w-3 h-3 text-[#10a37f] shrink-0" />}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {activePages.length > 1 && (
                      <div
                        className="inline-flex items-center rounded-full bg-[#1e1e1e] p-0.5 border border-white/[0.08] gap-0.5"
                        title="Choose audit scope"
                      >
                        <button
                          type="button"
                          disabled={loadingPhase !== 'idle'}
                          onClick={() => setAuditScope('current')}
                          className={`!min-h-0 !min-w-0 inline-flex items-center h-6 px-2.5 rounded-full text-[11px] transition-colors disabled:opacity-50 ${
                            auditScope === 'current'
                              ? 'bg-[#3f3f3f] text-white font-medium shadow-sm'
                              : 'text-[#9b9b9b] hover:text-white'
                          }`}
                        >
                          Current Page
                        </button>
                        <button
                          type="button"
                          disabled={loadingPhase !== 'idle'}
                          onClick={() => setAuditScope('all')}
                          className={`!min-h-0 !min-w-0 inline-flex items-center h-6 px-2.5 rounded-full text-[11px] transition-colors disabled:opacity-50 ${
                            auditScope === 'all'
                              ? 'bg-[#3f3f3f] text-white font-medium shadow-sm'
                              : 'text-[#9b9b9b] hover:text-white'
                          }`}
                        >
                          All Pages ({activePages.length})
                        </button>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        if (activePages.length > 1 && auditScope === 'all') {
                          void runBatchAudit();
                        } else {
                          void runPipeline('audit');
                        }
                      }}
                      disabled={
                        loadingPhase !== 'idle' ||
                        (!(activePages.length > 1 && auditScope === 'all') && !htmlInput.trim())
                      }
                      className="!min-h-0 !min-w-0 inline-flex items-center gap-1.5 h-7 px-3.5 rounded-full bg-[#ececec] text-[#171717] font-medium text-xs hover:bg-white transition-colors disabled:opacity-50"
                    >
                      {loadingPhase === 'audit' || loadingPhase === 'batch' ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Play className="w-3 h-3" />
                      )}
                      {batchProgress
                        ? `Auditing ${batchProgress.current}/${batchProgress.total}: ${batchProgress.currentPage}`
                        : loadingPhase === 'audit' || loadingPhase === 'batch'
                          ? 'Auditing...'
                          : 'Run Audit'}
                    </button>
                  </div>
                </div>
                {baselineViewMode === 'preview' ? (
                  <div className="rounded-lg border border-white/[0.1] bg-white overflow-hidden">
                    <iframe
                      title="Baseline Input Preview"
                      srcDoc={htmlInput}
                      sandbox="allow-same-origin"
                      className="w-full h-[460px] bg-white border-0"
                    />
                  </div>
                ) : (
                  <textarea
                    value={htmlInput}
                    onChange={(e) => setHtmlInput(e.target.value)}
                    rows={18}
                    placeholder="Paste HTML source..."
                    className="w-full p-3 rounded-lg bg-[#212121] border border-white/[0.1] font-mono text-xs text-[#ececec] focus:outline-none focus:border-white/30"
                  />
                )}
                <div className="flex justify-end">
                  <div className="inline-flex items-center rounded-full bg-[#1e1e1e] p-0.5 border border-white/[0.08] gap-0.5">
                    <button
                      type="button"
                      onClick={() => setBaselineViewMode('preview')}
                      title="Preview"
                      aria-label="Preview"
                      className={`!min-h-0 !min-w-0 inline-flex items-center justify-center h-6 px-2 rounded-full transition-colors ${
                        baselineViewMode === 'preview'
                          ? 'bg-[#3f3f3f] text-white shadow-sm'
                          : 'text-[#9b9b9b] hover:text-white'
                      }`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setBaselineViewMode('code')}
                      title="Source Code"
                      aria-label="Source Code"
                      className={`!min-h-0 !min-w-0 inline-flex items-center justify-center h-6 px-2 rounded-full transition-colors ${
                        baselineViewMode === 'code'
                          ? 'bg-[#3f3f3f] text-white shadow-sm'
                          : 'text-[#9b9b9b] hover:text-white'
                      }`}
                    >
                      <Code2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setBaselineViewMode('code')}
                  className="!min-h-0 !min-w-0 inline-flex items-center gap-1 h-6 px-2.5 rounded-full bg-[#1e1e1e] border border-white/[0.08] hover:bg-[#383838] text-[11px] text-[#9b9b9b] hover:text-white transition-colors"
                >
                  <Code2 className="w-3 h-3" />
                  Paste HTML in Source Code
                </button>
              </div>
            )}

            {error && <div className="text-xs text-rose-400">{error}</div>}
          </section>
        )}

        {/* Batch Audit Overview (shown on Input page after Batch Audit All) */}
        {activeStage === 'input' && batchReport && (
          <section className="rounded-xl bg-[#171717] border border-[#10a37f]/35 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#10a37f]" />
                  <h2 className="text-sm font-semibold text-white">
                    Site-Wide Batch Audit ({batchReport.completedPages}/{batchReport.totalPages} pages)
                  </h2>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-[#10a37f]/15 text-[#10a37f]">
                    Read-only
                  </span>
                </div>
                <p className="text-xs text-[#9b9b9b] mt-0.5">
                  Avg pass rate <strong className="text-white">{batchReport.aggregate.avgPassRate}%</strong>
                  {batchReport.aggregate.worstPage && (
                    <>
                      {' '}
                      &middot; Worst page:{' '}
                      <strong className="text-rose-300">{batchReport.aggregate.worstPage}</strong> (
                      {batchReport.aggregate.minPassRate}%)
                    </>
                  )}{' '}
                  &middot; Total issues: <strong className="text-rose-300">{batchReport.aggregate.totalFailed} failed</strong>,{' '}
                  <strong className="text-amber-300">{batchReport.aggregate.totalNeedsReview} review</strong>. Pick any page below to open in Figma Review Studio.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => downloadJsonFile('report.json', batchReport)}
                  className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-[#383838] hover:bg-[#444] text-xs font-medium text-[#ececec] transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  report.json
                </button>
                <button
                  type="button"
                  onClick={() => downloadJsonFile('feedback.json', batchReport.feedback)}
                  className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-[#383838] hover:bg-[#444] text-xs font-medium text-[#ececec] transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  feedback.json (page_hint)
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-white/[0.08]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#212121] text-[#9b9b9b]">
                  <tr>
                    <th className="px-3 py-2 font-medium">Page</th>
                    <th className="px-3 py-2 font-medium">Pass Rate</th>
                    <th className="px-3 py-2 font-medium">UX</th>
                    <th className="px-3 py-2 font-medium">UI</th>
                    <th className="px-3 py-2 font-medium">Failed</th>
                    <th className="px-3 py-2 font-medium">Review</th>
                    <th className="px-3 py-2 font-medium text-right">Figma Review Studio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {batchReport.pages.map((p) => {
                    const isCurrent = p.page === selectedPage;
                    const isWorst = p.page === batchReport.aggregate.worstPage;
                    return (
                      <tr
                        key={p.page}
                        className={isCurrent ? 'bg-[#10a37f]/10' : 'hover:bg-white/[0.02]'}
                      >
                        <td className="px-3 py-2 font-mono text-[#ececec]">
                          <span>{p.page}</span>
                          {isWorst && (
                            <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-sans">
                              Worst
                            </span>
                          )}
                          {isCurrent && (
                            <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-[#10a37f]/20 text-[#10a37f] font-sans">
                              Active
                            </span>
                          )}
                        </td>
                        {p.error ? (
                          <td colSpan={5} className="px-3 py-2 text-rose-400">
                            {p.error}
                          </td>
                        ) : (
                          <>
                            <td className="px-3 py-2 font-semibold text-white">{p.summary.passRate}%</td>
                            <td className="px-3 py-2 text-[#d4d4d4]">
                              {p.summary.ux.passed}/{p.summary.ux.total}
                            </td>
                            <td className="px-3 py-2 text-[#d4d4d4]">
                              {p.summary.ui.passed}/{p.summary.ui.total}
                            </td>
                            <td className="px-3 py-2 text-rose-400">{p.summary.totalFailed}</td>
                            <td className="px-3 py-2 text-amber-400">{p.summary.totalNeedsReview}</td>
                          </>
                        )}
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            disabled={Boolean(p.error)}
                            onClick={() => void selectBatchPageForOptimize(p)}
                            className={`inline-flex items-center h-7 px-3 rounded-full text-[11px] font-medium transition-colors disabled:opacity-40 ${isCurrent
                              ? 'bg-[#10a37f] hover:bg-[#0d8c6d] text-white'
                              : 'bg-[#383838] hover:bg-[#444] text-[#ececec]'
                              }`}
                          >
                            Open in Studio &rarr;
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Unified Full-Screen Figma Review Studio (Priorities + Canvas + Checklist + Inspector + Export) */}
        {activeStage === 'optimize' && result && (
          <FigmaReviewCanvas
            selectedPage={selectedPage}
            result={result}
            selectedIter={selectedIter}
            onSelectIter={setSelectedIter}
            activeTab={optimizeTab === 'checklist' ? 'checklist' : 'canvas'}
            onTabChange={(tab) => setOptimizeTab(tab === 'checklist' ? 'checklist' : 'compare')}
            viewportPreset={canvasViewport}
            onViewportPresetChange={setCanvasViewport}
            compareMode={canvasCompareMode}
            onCompareModeChange={setCanvasCompareMode}
            approvedIter={approvedIter}
            savedApprovalInfo={savedApprovalInfo}
            onApprove={handleApproveSnapshot}
            onCopyHtml={handleCopyHtml}
            copied={copied}
            onDownloadHtml={handleDownloadHtml}
            onBackToInput={() => setActiveStage('input')}
            onOpenChecklistTab={() => setOptimizeTab('checklist')}
            injectHighlightCss={injectHighlightCss}
            priorityOrder={priorityOrder}
            selectedMetricIds={selectedMetricIds}
            reviewedMetricIds={reviewedMetricIds}
            onToggleMetric={toggleMetric}
            onMovePriority={movePriority}
            onConfirmNeedsReview={confirmNeedsReview}
            maxIterations={maxIterations}
            onMaxIterationsChange={setMaxIterations}
            isOptimizing={loadingPhase === 'iterate'}
            onRunOptimization={() => void runPipeline('iterate')}
          />
        )}
      </main>
    </div>
  );
}
