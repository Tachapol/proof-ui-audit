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
import { FigmaReviewCanvas } from './FigmaReviewCanvas';
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
  const [selectedPage, setSelectedPage] = useState<string>(baselinePages[0] || 'index.html');
  const [htmlInput, setHtmlInput] = useState<string>(initialHtml);
  const [uploadedProject, setUploadedProject] = useState<{
    name: string;
    files: Record<string, string>;
    htmlPages: string[];
  } | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [baselineViewMode, setBaselineViewMode] = useState<'preview' | 'code'>('preview');
  const [activeStage, setActiveStage] = useState<'input' | 'audit' | 'optimize'>('input');
  const [auditTab, setAuditTab] = useState<'priority' | 'checklist'>('priority');
  const [optimizeTab, setOptimizeTab] = useState<'compare' | 'checklist'>('compare');

  // Step 1: Context & Requirements
  const [productGoal, setProductGoal] = useState<string>('Hotel search & booking conversion');
  const [targetAudience, setTargetAudience] = useState<string>('Travelers on desktop & mobile');
  const [theme, setTheme] = useState<string>('Booking.com blue (#003580) & yellow (#ffb700)');

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
      .catch(() => {});
  }, [selectedPage]);

  const attachSyncListeners = (
    leftEl: HTMLIFrameElement | null,
    rightEl: HTMLIFrameElement | null
  ) => {
    if (!syncScroll || !leftEl || !rightEl) return () => {};
    const leftWin = leftEl.contentWindow;
    const rightWin = rightEl.contentWindow;
    if (!leftWin || !rightWin) return () => {};

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
      const res = await fetch('/api/checklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          html: htmlInput,
          mode,
          maxIterations,
          context: { productGoal, targetAudience, theme },
          prioritizedMetricIds: mode === 'iterate' && orderedSelected.length > 0 ? orderedSelected : undefined,
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

      if (mode === 'audit') {
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
        setActiveStage('audit');
        setAuditTab('priority');
      } else {
        setActiveStage('optimize');
        setOptimizeTab('compare');
      }
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

  const applyAuditResultToWorkspace = (page: string, pageHtml: string, nextResult: AutoIterationResult) => {
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
    setActiveStage('audit');
    setAuditTab('priority');
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
              context: { productGoal, targetAudience, theme },
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
        { productGoal, targetAudience, theme }
      );
      setBatchReport(report);

      const focusPageName = report.aggregate.worstPage || pageResults.find((p) => !p.error)?.page;
      const focusResult = pageResults.find((p) => p.page === focusPageName && !p.error);
      if (focusResult) {
        const focusHtml = focusResult.result.iterations[0]?.html || (await loadPageHtml(focusResult.page));
        applyAuditResultToWorkspace(focusResult.page, focusHtml, focusResult.result);
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
    setUploadedProject({ name: rootFolderName, files, htmlPages });
    setSelectedPage(firstPage);
    setHtmlInput(bundleUploadedHtml(firstPage, files));
    setResult(null);
    setPriorityOrder([]);
    setReviewedMetricIds(new Set());
    setError('');
  };

  const resetToBaseline = async () => {
    setUploadedProject(null);
    const defaultPage = baselinePages[0] || 'index.html';
    setSelectedPage(defaultPage);
    setResult(null);
    setPriorityOrder([]);
    setReviewedMetricIds(new Set());
    try {
      const res = await fetch(`/api/checklist?page=${encodeURIComponent(defaultPage)}`);
      const data = await res.json();
      if (res.ok && data.success) setHtmlInput(data.html);
    } catch {
      setHtmlInput(initialHtml);
    }
  };

  const activePages = uploadedProject ? uploadedProject.htmlPages : baselinePages;

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
              className={`flex items-start gap-2.5 p-2 rounded-lg bg-[#212121] border border-white/[0.05] ${
                item.status === 'notApplicable' ? 'opacity-60' : ''
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
      <header className="px-6 py-3.5 bg-[#171717] border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-[#9b9b9b] hover:text-white">
            <ArrowLeft className="w-3.5 h-3.5" />
            Audit
          </Link>
          <span className="text-white/20">/</span>
          <h1 className="font-semibold text-white">UX/UI Optimization Pipeline (36-Metric Self-Audit)</h1>
        </div>
        <Link href="/knowledge" className="text-xs text-[#10a37f] hover:underline">
          Knowledge Wiki
        </Link>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-5">
        {/* 3-Stage Stateful Stepper Bar */}
        <nav className="rounded-xl bg-[#171717] border border-white/[0.08] px-3 py-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveStage('input')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeStage === 'input'
                  ? 'bg-[#2f2f2f] text-white border border-[#10a37f]'
                  : 'text-[#d4d4d4] hover:bg-[#262626]'
              }`}
            >
              1. Input &amp; Context
            </button>
            <span className="text-white/20 text-xs">&rarr;</span>
            <button
              type="button"
              disabled={!result}
              onClick={() => result && setActiveStage('audit')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                activeStage === 'audit'
                  ? 'bg-[#2f2f2f] text-white border border-[#10a37f]'
                  : 'text-[#d4d4d4] hover:bg-[#262626]'
              }`}
            >
              2. Audit &amp; Prioritize
            </button>
            <span className="text-white/20 text-xs">&rarr;</span>
            <button
              type="button"
              disabled={!hasOptimizationRuns}
              onClick={() => hasOptimizationRuns && setActiveStage('optimize')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                activeStage === 'optimize'
                  ? 'bg-[#2f2f2f] text-white border border-[#10a37f]'
                  : 'text-[#d4d4d4] hover:bg-[#262626]'
              }`}
            >
              3. Optimize &amp; Approve
            </button>
          </div>
          <div className="text-xs text-[#9b9b9b] px-2">
            {uploadedProject ? uploadedProject.name : 'Booking'} &middot; {selectedPage}
          </div>
        </nav>

        {/* Stage 1: Input & Context */}
        {activeStage === 'input' && (
          <section className="rounded-xl bg-[#171717] border border-white/[0.08] p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-white">1. Input &amp; Context</span>
                {activePages.length > 0 && (
                  <select
                    title={uploadedProject ? uploadedProject.name : baselineDir}
                    value={selectedPage}
                    onChange={async (e) => {
                      const page = e.target.value;
                      setSelectedPage(page);
                      setError('');
                      setResult(null);
                      setPriorityOrder([]);
                      setReviewedMetricIds(new Set());
                      if (uploadedProject) {
                        setHtmlInput(bundleUploadedHtml(page, uploadedProject.files));
                        return;
                      }
                      try {
                        const res = await fetch(`/api/checklist?page=${encodeURIComponent(page)}`);
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
                    className="px-2.5 py-1 rounded-lg bg-[#2f2f2f] border border-white/[0.12] text-xs"
                  >
                    {activePages.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="inline-flex rounded-lg border border-white/[0.1] bg-[#212121] p-0.5">
                  <button
                    type="button"
                    onClick={() => setBaselineViewMode('preview')}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs ${
                      baselineViewMode === 'preview' ? 'bg-[#2f2f2f] text-white font-medium' : 'text-[#9b9b9b]'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Preview
                  </button>
                  <button
                    type="button"
                    onClick={() => setBaselineViewMode('code')}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs ${
                      baselineViewMode === 'code' ? 'bg-[#2f2f2f] text-white font-medium' : 'text-[#9b9b9b]'
                    }`}
                  >
                    <Code2 className="w-3.5 h-3.5" />
                    Source Code
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => runPipeline('audit')}
                  disabled={loadingPhase !== 'idle' || !htmlInput.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#ececec] text-[#171717] font-medium text-xs hover:bg-white disabled:opacity-50"
                >
                  {loadingPhase === 'audit' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                  {loadingPhase === 'audit' ? 'Auditing...' : 'Run Audit'}
                </button>
                {activePages.length > 1 && (
                  <button
                    type="button"
                    onClick={() => void runBatchAudit()}
                    disabled={loadingPhase !== 'idle'}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#10a37f] text-white font-medium text-xs hover:bg-[#0d8f70] disabled:opacity-50"
                  >
                    {loadingPhase === 'batch' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Layers className="w-3.5 h-3.5" />
                    )}
                    {batchProgress
                      ? `Batch ${batchProgress.current}/${batchProgress.total}: ${batchProgress.currentPage}`
                      : `Batch Audit All (${activePages.length})`}
                  </button>
                )}
              </div>
            </div>

            {/* Upload Source Code Section */}
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
              className={`rounded-lg border border-dashed px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-3 transition-colors ${
                isDragging
                  ? 'border-[#10a37f] bg-[#10a37f]/10'
                  : 'border-white/[0.15] bg-[#212121]'
              }`}
            >
              <div className="flex items-center gap-2.5 text-xs">
                <Upload className="w-4 h-4 text-[#10a37f] shrink-0" />
                {uploadedProject ? (
                  <span>
                    Loaded <strong className="text-white">{uploadedProject.name}</strong> ({uploadedProject.htmlPages.length} HTML{' '}
                    {uploadedProject.htmlPages.length === 1 ? 'page' : 'pages'})
                  </span>
                ) : (
                  <span className="text-[#9b9b9b]">
                    Upload <strong className="text-[#ececec]">HTML/CSS/JS files</strong> or a <strong className="text-[#ececec]">website folder</strong> (or drag &amp; drop here)
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".html,.htm,.css,.js"
                  className="hidden"
                  onChange={(e) => {
                    void handleUploadedFileList(e.target.files);
                    e.target.value = '';
                  }}
                />
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
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#2f2f2f] hover:bg-[#383838] text-xs text-[#ececec]"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Upload Files
                </button>
                <button
                  type="button"
                  onClick={() => folderInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#2f2f2f] hover:bg-[#383838] text-xs text-[#ececec]"
                >
                  <FolderUp className="w-3.5 h-3.5" />
                  Upload Folder
                </button>
                {uploadedProject && (
                  <button
                    type="button"
                    onClick={() => void resetToBaseline()}
                    className="px-2.5 py-1 rounded-md border border-white/[0.12] hover:bg-[#2f2f2f] text-xs text-[#9b9b9b]"
                  >
                    Use Default Baseline
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label htmlFor="ctx-product-goal" className="block text-[11px] font-medium text-[#9b9b9b]">
                  Product Goal
                </label>
                <input
                  id="ctx-product-goal"
                  value={productGoal}
                  onChange={(e) => setProductGoal(e.target.value)}
                  placeholder="e.g. Hotel search & booking conversion"
                  className="w-full px-3 py-1.5 rounded-lg bg-[#212121] border border-white/[0.1] text-xs"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="ctx-audience" className="block text-[11px] font-medium text-[#9b9b9b]">
                  Target Audience
                </label>
                <input
                  id="ctx-audience"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  placeholder="e.g. Travelers on desktop & mobile"
                  className="w-full px-3 py-1.5 rounded-lg bg-[#212121] border border-white/[0.1] text-xs"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="ctx-theme" className="block text-[11px] font-medium text-[#9b9b9b]">
                  Theme &amp; Brand Colors
                </label>
                <input
                  id="ctx-theme"
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  placeholder="e.g. Booking.com blue (#003580) & yellow (#ffb700)"
                  className="w-full px-3 py-1.5 rounded-lg bg-[#212121] border border-white/[0.1] text-xs"
                />
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
                rows={20}
                placeholder="Paste HTML source..."
                className="w-full p-3 rounded-lg bg-[#212121] border border-white/[0.1] font-mono text-xs text-[#ececec] focus:outline-none focus:border-white/30"
              />
            )}

            {error && <div className="text-xs text-rose-400">{error}</div>}
          </section>
        )}

        {/* Stage 2 & 3 Shared Scoreboard */}
        {activeStage !== 'input' && result && activeSnapshot && (
          <>
            {/* Scoreboard */}
            <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-[#171717] border border-white/[0.08]">
                <div className="text-xs text-[#9b9b9b]">Passed (Applicable)</div>
                <div className="text-2xl font-semibold text-[#10a37f] mt-1">
                  {activeSnapshot.summary.totalPassed}{' '}
                  <span className="text-sm text-[#8e8e8e]">/ {activeSnapshot.summary.totalMetrics}</span>
                </div>
                <div className="text-[11px] text-[#9b9b9b] mt-1 space-y-0.5">
                  <div>{activeSnapshot.summary.passRate}% passed</div>
                  <div>UX {activeSnapshot.summary.ux.passed}/{activeSnapshot.summary.ux.total}</div>
                  <div>UI {activeSnapshot.summary.ui.passed}/{activeSnapshot.summary.ui.total}</div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#171717] border border-white/[0.08]">
                <div className="text-xs text-[#9b9b9b]">Failed</div>
                <div className="text-2xl font-semibold text-rose-400 mt-1">
                  {activeSnapshot.summary.totalFailed}
                </div>
                <div className="text-[11px] text-[#9b9b9b] mt-0.5">Eligible for optimization</div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#171717] border border-white/[0.08]">
                <div className="text-xs text-[#9b9b9b]">Needs review</div>
                <div className="text-2xl font-semibold text-amber-400 mt-1">
                  {activeSnapshot.summary.totalNeedsReview}
                </div>
                <div className="text-[11px] text-[#9b9b9b] mt-0.5">Manual evidence check</div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#171717] border border-white/[0.08]">
                <div className="text-xs text-[#9b9b9b]">Status</div>
                <div className="text-sm font-medium text-white mt-1.5">
                  {formatStopReason(result.stopReason)}
                </div>
                {!hasOptimizationRuns && (
                  <div className="text-[11px] text-[#9b9b9b] mt-1">Ready for prioritization</div>
                )}
              </div>
            </section>

            {/* Stage 2: Audit & Prioritize */}
            {activeStage === 'audit' && baselineSnapshot && (
              <>
                {batchReport && (
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
                          <strong className="text-amber-300">{batchReport.aggregate.totalNeedsReview} review</strong>. Pick any page below for single-page optimization.
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => downloadJsonFile('report.json', batchReport)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#2f2f2f] hover:bg-[#383838] text-xs text-[#ececec]"
                        >
                          <Download className="w-3.5 h-3.5" />
                          report.json
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadJsonFile('feedback.json', batchReport.feedback)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#2f2f2f] hover:bg-[#383838] text-xs text-[#ececec]"
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
                            <th className="px-3 py-2 font-medium text-right">Single-Page Optimize</th>
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
                                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium disabled:opacity-40 ${
                                      isCurrent
                                        ? 'bg-[#10a37f] text-white'
                                        : 'bg-[#2f2f2f] hover:bg-[#383838] text-[#ececec]'
                                    }`}
                                  >
                                    {isCurrent ? 'Selected for Optimize' : 'Optimize This Page →'}
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

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="inline-flex rounded-lg border border-white/[0.1] bg-[#171717] p-0.5">
                    <button
                      type="button"
                      onClick={() => setAuditTab('priority')}
                      className={`px-3 py-1 rounded-md text-xs font-medium ${
                        auditTab === 'priority' ? 'bg-[#2f2f2f] text-white' : 'text-[#9b9b9b] hover:text-white'
                      }`}
                    >
                      Priority &amp; Preview ({priorityOrder.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuditTab('checklist')}
                      className={`px-3 py-1 rounded-md text-xs font-medium ${
                        auditTab === 'checklist' ? 'bg-[#2f2f2f] text-white' : 'text-[#9b9b9b] hover:text-white'
                      }`}
                    >
                      Full Checklist ({baselineSnapshot.summary.totalMetrics})
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveStage('input')}
                    className="px-2.5 py-1 rounded-md bg-[#2f2f2f] hover:bg-[#383838] text-xs text-[#d4d4d4]"
                  >
                    &larr; Edit Input
                  </button>
                </div>

                {auditTab === 'priority' && priorityOrder.length > 0 && (
              <section className="rounded-xl bg-[#171717] border border-white/[0.08] p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold text-white">
                      Baseline results &amp; Priority selection
                    </h2>
                    <p className="text-xs text-[#9b9b9b]">
                      Select issues to fix, reorder priority, or click an item to inspect its preview.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={maxIterations}
                      onChange={(e) => setMaxIterations(Number(e.target.value))}
                      className="px-2.5 py-1.5 rounded-lg bg-[#2f2f2f] border border-white/[0.12] text-xs"
                    >
                      <option value={2}>Max 2 iterations</option>
                      <option value={3}>Max 3 iterations</option>
                      <option value={5}>Max 5 iterations</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => runPipeline('iterate')}
                      disabled={loadingPhase !== 'idle' || selectedReadyCount === 0}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#10a37f] text-white font-medium text-xs hover:opacity-90 disabled:opacity-50"
                    >
                      {loadingPhase === 'iterate' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      {loadingPhase === 'iterate'
                        ? 'Optimizing...'
                        : `Run optimization (${selectedReadyCount} ${selectedReadyCount === 1 ? 'issue' : 'issues'})`}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  {/* Left: Priority Issues List */}
                  <div className="lg:col-span-5 space-y-2">
                    <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
                      {priorityOrder.map((id, idx) => {
                        const item = priorityItemMap.get(id);
                        if (!item) return null;
                        const checked = selectedMetricIds.has(id);
                        const isInspected = inspectedMetricId === id;
                        const isNeedsReview = item.status === 'needsReview';
                        const isConfirmed = !isNeedsReview || reviewedMetricIds.has(id);
                        return (
                          <div
                            key={id}
                            onClick={() => inspectMetric(item)}
                            className={`p-2.5 rounded-lg border cursor-pointer transition-colors ${
                              isInspected
                                ? 'bg-[#2a2a2a] border-[#10a37f]'
                                : 'bg-[#212121] border-white/[0.06] hover:bg-[#262626]'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <label
                                className={`flex items-center gap-2 min-w-0 flex-1 ${
                                  !isConfirmed ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'
                                }`}
                                onClick={(e) => e.stopPropagation()}
                                title={!isConfirmed ? 'Click "Review evidence" and "Confirm for fix" to enable' : undefined}
                              >
                                <input
                                  type="checkbox"
                                  checked={isConfirmed && checked}
                                  disabled={!isConfirmed}
                                  onChange={() => isConfirmed && toggleMetric(id)}
                                  className="accent-[#10a37f] disabled:opacity-40"
                                />
                                <span className="text-[11px] font-mono text-[#8e8e8e]">#{idx + 1}</span>
                                <span className="text-xs font-medium text-white truncate">{item.title}</span>
                              </label>

                              <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                                <span
                                  className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                    isNeedsReview
                                      ? 'bg-amber-500/20 text-amber-300'
                                      : 'bg-rose-500/20 text-rose-300'
                                  }`}
                                >
                                  {isNeedsReview ? 'Needs review' : 'Fail'}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#2f2f2f] text-[#9b9b9b]">
                                  {item.id === 'reflow' ? '320px' : item.viewport}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => movePriority(id, -1)}
                                  disabled={idx === 0}
                                  className="p-1 rounded hover:bg-[#2f2f2f] disabled:opacity-30"
                                >
                                  <ArrowUp className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => movePriority(id, 1)}
                                  disabled={idx === priorityOrder.length - 1}
                                  className="p-1 rounded hover:bg-[#2f2f2f] disabled:opacity-30"
                                >
                                  <ArrowDown className="w-3 h-3" />
                                </button>
                              </div>
                            </div>

                            <div className="mt-1 pl-6 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#9b9b9b]">
                              <span className="truncate">
                                {isNeedsReview && !isConfirmed
                                  ? 'Review the highlighted text before optimizing.'
                                  : item.measuredSummary}
                              </span>
                              <div className="flex items-center gap-2 shrink-0">
                                {isNeedsReview && !isConfirmed && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      confirmNeedsReview(id);
                                    }}
                                    className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-[11px]"
                                  >
                                    Confirm for fix
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    inspectMetric(item);
                                  }}
                                  className="text-[11px] text-[#10a37f] hover:underline"
                                >
                                  {isNeedsReview ? 'Review evidence' : item.id === 'reflow' ? 'Preview 320px' : 'Inspect'}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right: Single Contextual Preview (before optimization) or Evidence Panel */}
                  <div className="lg:col-span-7 space-y-2">
                    {!hasOptimizationRuns ? (
                      <div className="rounded-lg border border-white/[0.1] overflow-hidden bg-[#212121] flex flex-col items-center">
                        <div className="w-full px-3 py-1.5 bg-[#212121] border-b border-white/[0.08] text-xs flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[#ececec] truncate">
                            {inspectedItem
                              ? `${inspectedItem.title} (${
                                  previewViewport === 'mobile320'
                                    ? '320px'
                                    : previewViewport === 'mobile375'
                                      ? '375px'
                                      : previewViewport === 'tablet'
                                        ? '768px'
                                        : '1280px'
                                })`
                              : 'Baseline Preview'}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <div className="inline-flex rounded border border-white/[0.1] bg-[#171717] p-0.5">
                              <button
                                type="button"
                                onClick={() => setPreviewViewport('desktop')}
                                className={`px-2 py-0.5 rounded text-[11px] ${
                                  previewViewport === 'desktop' ? 'bg-[#2f2f2f] text-white' : 'text-[#9b9b9b]'
                                }`}
                              >
                                Desktop
                              </button>
                              <button
                                type="button"
                                onClick={() => setPreviewViewport('mobile320')}
                                className={`px-2 py-0.5 rounded text-[11px] ${
                                  previewViewport === 'mobile320' ? 'bg-[#2f2f2f] text-white' : 'text-[#9b9b9b]'
                                }`}
                              >
                                320px
                              </button>
                            </div>
                            {previewViewport === 'desktop' && (
                              <div className="inline-flex rounded border border-white/[0.1] bg-[#171717] p-0.5">
                                <button
                                  type="button"
                                  onClick={() => setPreviewZoom('fit')}
                                  className={`px-2 py-0.5 rounded text-[11px] ${
                                    previewZoom === 'fit' ? 'bg-[#2f2f2f] text-white' : 'text-[#9b9b9b]'
                                  }`}
                                >
                                  Fit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPreviewZoom('actual')}
                                  className={`px-2 py-0.5 rounded text-[11px] ${
                                    previewZoom === 'actual' ? 'bg-[#2f2f2f] text-white' : 'text-[#9b9b9b]'
                                  }`}
                                >
                                  100%
                                </button>
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => setFullScreenPreview(true)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#2f2f2f] hover:bg-[#383838] text-[11px] text-[#ececec]"
                            >
                              <Maximize2 className="w-3 h-3" />
                              Full Page
                            </button>
                          </div>
                        </div>
                        <ScaledIframePreview
                          title="Contextual Baseline Preview"
                          html={injectHighlightCss(
                            baselineSnapshot.html,
                            inspectedItem?.rawSelectors || []
                          )}
                          viewport={previewViewport}
                          zoom={previewZoom}
                          heightPx={540}
                        />
                        {inspectedItem && (
                          <div className="w-full px-3 py-2 bg-[#171717] border-t border-white/[0.08] space-y-1">
                            <div className="text-xs text-[#ececec]">
                              {inspectedItem.measuredSummary}
                            </div>
                            {(inspectedItem.rawSelectors?.length || inspectedItem.samples.length) ? (
                              <details>
                                <summary className="cursor-pointer text-[11px] text-[#10a37f]">
                                  Details &amp; technical measurements ({inspectedItem.rawSelectors?.length || inspectedItem.samples.length})
                                </summary>
                                <div className="mt-1 text-[11px] font-mono text-[#9b9b9b] whitespace-pre-wrap">
                                  {inspectedItem.samples.join('\n')}
                                </div>
                              </details>
                            ) : null}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-white/[0.08] bg-[#212121] p-3.5 space-y-2 h-full">
                        <div className="text-xs font-medium text-white">
                          {inspectedItem ? `Evidence: ${inspectedItem.title}` : 'Select an issue to inspect evidence'}
                        </div>
                        {inspectedItem && (
                          <>
                            <div className="text-xs text-[#d4d4d4]">{inspectedItem.measuredSummary}</div>
                            <div className="text-xs text-[#9b9b9b]">{inspectedItem.recommendation}</div>
                            {inspectedItem.samples.length > 0 && (
                              <pre className="p-2.5 rounded bg-[#171717] border border-white/[0.08] text-[11px] text-[#b4b4b4] whitespace-pre-wrap">
                                {inspectedItem.samples.join('\n')}
                              </pre>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </section>
                )}

                {auditTab === 'checklist' && (
                  <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <h2 className="text-sm font-semibold text-white px-1">
                        UX Checklist ({baselineSnapshot.summary.ux.passed}/{baselineSnapshot.summary.ux.total})
                      </h2>
                      {baselineSnapshot.summary.pillars
                        .filter((p) => p.group === 'ux')
                        .map(renderPillarCard)}
                    </div>
                    <div className="space-y-3">
                      <h2 className="text-sm font-semibold text-white px-1">
                        UI Checklist ({baselineSnapshot.summary.ui.passed}/{baselineSnapshot.summary.ui.total})
                      </h2>
                      {baselineSnapshot.summary.pillars
                        .filter((p) => p.group === 'ui')
                        .map(renderPillarCard)}
                    </div>
                  </section>
                )}
              </>
            )}

            {/* Stage 3: Optimize & Approve */}
            {activeStage === 'optimize' && hasOptimizationRuns && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="inline-flex rounded-lg border border-white/[0.1] bg-[#171717] p-0.5">
                    <button
                      type="button"
                      onClick={() => setOptimizeTab('compare')}
                      className={`px-3 py-1 rounded-md text-xs font-medium ${
                        optimizeTab === 'compare' ? 'bg-[#2f2f2f] text-white' : 'text-[#9b9b9b] hover:text-white'
                      }`}
                    >
                      Compare &amp; Progress
                    </button>
                    <button
                      type="button"
                      onClick={() => setOptimizeTab('checklist')}
                      className={`px-3 py-1 rounded-md text-xs font-medium ${
                        optimizeTab === 'checklist' ? 'bg-[#2f2f2f] text-white' : 'text-[#9b9b9b] hover:text-white'
                      }`}
                    >
                      Updated Checklist ({activeSnapshot.summary.totalPassed}/{activeSnapshot.summary.totalMetrics})
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveStage('audit')}
                    className="px-2.5 py-1 rounded-md bg-[#2f2f2f] hover:bg-[#383838] text-xs text-[#d4d4d4]"
                  >
                    &larr; Back to Priorities
                  </button>
                </div>

                {optimizeTab === 'compare' && (
                  <FigmaReviewCanvas
                    selectedPage={selectedPage}
                    result={result}
                    selectedIter={selectedIter}
                    onSelectIter={setSelectedIter}
                    approvedIter={approvedIter}
                    savedApprovalInfo={savedApprovalInfo}
                    onApprove={handleApproveSnapshot}
                    onCopyHtml={handleCopyHtml}
                    copied={copied}
                    onBackToPriorities={() => setActiveStage('audit')}
                    onOpenChecklistTab={() => setOptimizeTab('checklist')}
                    injectHighlightCss={injectHighlightCss}
                  />
                )}

                {optimizeTab === 'checklist' && (
                  <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <h2 className="text-sm font-semibold text-white px-1">
                        UX Checklist ({activeSnapshot.summary.ux.passed}/{activeSnapshot.summary.ux.total})
                      </h2>
                      {activeSnapshot.summary.pillars
                        .filter((p) => p.group === 'ux')
                        .map(renderPillarCard)}
                    </div>
                    <div className="space-y-3">
                      <h2 className="text-sm font-semibold text-white px-1">
                        UI Checklist ({activeSnapshot.summary.ui.passed}/{activeSnapshot.summary.ui.total})
                      </h2>
                      {activeSnapshot.summary.pillars
                        .filter((p) => p.group === 'ui')
                        .map(renderPillarCard)}
                    </div>
                  </section>
                )}
              </>
            )}
          </>
        )}
      </main>

      {/* Full-Page Side-by-Side Synced Comparison Modal */}
      {fullScreenPreview && result && activeSnapshot && (
        <div className="fixed inset-0 z-50 bg-[#171717] flex flex-col">
          <div className="px-4 py-2.5 border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-2 bg-[#171717]">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white">Full-Page Comparison</span>
              <select
                value={selectedIter}
                onChange={(e) => setSelectedIter(Number(e.target.value))}
                className="px-2.5 py-1 rounded-md bg-[#2f2f2f] border border-white/[0.12] text-xs text-white"
              >
                {result.iterations.map((it) => (
                  <option key={it.iteration} value={it.iteration}>
                    {it.label} ({it.summary.totalPassed}/{it.summary.totalMetrics})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSyncScroll((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border ${
                  syncScroll
                    ? 'bg-[#2f2f2f] border-[#10a37f] text-white'
                    : 'bg-[#212121] border-white/[0.1] text-[#9b9b9b]'
                }`}
              >
                <Link2 className="w-3.5 h-3.5" />
                Sync Scroll
              </button>
              <button
                type="button"
                onClick={() => setFullScreenPreview(false)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#2f2f2f] hover:bg-[#383838] text-xs text-white"
              >
                <X className="w-3.5 h-3.5" />
                Close
              </button>
            </div>
          </div>

          <div
            className={`flex-1 min-h-0 grid ${
              baselineSnapshot && activeSnapshot.iteration !== 0
                ? 'grid-cols-1 lg:grid-cols-2'
                : 'grid-cols-1'
            }`}
          >
            {baselineSnapshot && activeSnapshot.iteration !== 0 && (
              <div className="flex flex-col border-r border-white/[0.08] bg-white min-h-0">
                <div className="px-3 py-1.5 bg-[#212121] border-b border-white/[0.08] text-xs text-[#9b9b9b] flex justify-between shrink-0">
                  <span>Baseline (Before)</span>
                  <span className="font-mono">
                    {baselineSnapshot.summary.totalPassed}/{baselineSnapshot.summary.totalMetrics}
                  </span>
                </div>
                <iframe
                  ref={modalLeftRef}
                  title="Full Page Baseline Preview"
                  srcDoc={baselineSnapshot.html}
                  sandbox="allow-same-origin"
                  className="w-full flex-1 bg-white border-0"
                />
              </div>
            )}

            <div className="flex flex-col bg-white min-h-0">
              <div className="px-3 py-1.5 bg-[#212121] border-b border-white/[0.08] text-xs text-white flex justify-between shrink-0">
                <span>{activeSnapshot.label} (After)</span>
                <span className="font-mono text-[#10a37f]">
                  {activeSnapshot.summary.totalPassed}/{activeSnapshot.summary.totalMetrics}
                </span>
              </div>
              <iframe
                ref={modalRightRef}
                title="Full Page Iteration Preview"
                srcDoc={activeSnapshot.html}
                sandbox="allow-same-origin"
                className="w-full flex-1 bg-white border-0"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
