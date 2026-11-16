'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { AuditRun, GroupedUXIssue, Viewport, DesignerDecision } from '@/lib/schema/ux-issue';
import { createSandboxSnippetFromIssue } from '@/lib/sandbox/snippet-builder';
import { calculateContrastRatioRaw, parseColor } from '@/lib/audit/color-math';
import { Icon } from './Icon';

interface VisualCanvasOverlayProps {
  currentRun: AuditRun;
  activeFingerprint: string | null;
  onSelectIssue: (fingerprint: string) => void;
  onDecisionSaved?: (updated: GroupedUXIssue) => void;
}

interface IssuePinData {
  index: number;
  fingerprint: string;
  groupedIssue: GroupedUXIssue;
  title: string;
  status: 'pass' | 'candidateFail' | 'needsReview';
  priority: string;
  ruleId: string;
  wcagCriterion: string;
  boundingBox: { x: number; y: number; width: number; height: number };
  selector: string;
  measured: Record<string, unknown>;
  expected: Record<string, unknown>;
  // Left gutter placement & leader line coordinates
  pinX: number;
  pinY: number;
  pinCenterX: number;
  pinCenterY: number;
  targetX: number;
  targetY: number;
}

const LEFT_GUTTER = 44; // Dedicated left rail width outside the UI page for pins

export function VisualCanvasOverlay({
  currentRun,
  activeFingerprint,
  onSelectIssue,
  onDecisionSaved,
}: VisualCanvasOverlayProps) {
  // 1. Available viewports (prioritizing 1440px Desktop, 375px Mobile, 320px Reflow)
  const viewports: Viewport[] = useMemo(() => {
    const list: Viewport[] = currentRun.viewports && currentRun.viewports.length > 0
      ? [...currentRun.viewports]
      : [];
    const standard = [
      { width: 1440, height: 900 },
      { width: 375, height: 667 },
      { width: 320, height: 667 },
    ];
    for (const sv of standard) {
      if (!list.some((v) => v.width === sv.width)) {
        list.push(sv);
      }
    }
    return list.sort((a, b) => b.width - a.width);
  }, [currentRun.viewports]);

  // Default to Desktop frame (1440px or widest)
  const [selectedViewport, setSelectedViewport] = useState<Viewport>(() => {
    return viewports.find((v) => v.width >= 1024) || viewports[0];
  });

  useEffect(() => {
    if (!viewports.some((v) => v.width === selectedViewport.width)) {
      const desktopVp = viewports.find((v) => v.width >= 1024) || viewports[0];
      if (desktopVp) {
        setSelectedViewport(desktopVp);
      }
    }
  }, [viewports, selectedViewport.width]);

  const [zoomScale, setZoomScale] = useState<number | 'fit'>('fit');
  const [showOverlays, setShowOverlays] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'issues' | 'candidateFail' | 'needsReview' | 'all'>('issues');
  const [boxDisplayMode, setBoxDisplayMode] = useState<'hover_focus' | 'all'>('hover_focus');
  const [hoveredFingerprint, setHoveredFingerprint] = useState<string | null>(null);
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null);
  const [isSavingDecision, setIsSavingDecision] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // View Options Menu state
  const [isViewMenuOpen, setIsViewMenuOpen] = useState(false);
  const viewMenuRef = useRef<HTMLDivElement>(null);

  // Side-by-Side 2-Column Inspector Drawer states (360-420px resizable)
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(true);
  const [panelWidth, setPanelWidth] = useState(380);
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartXRef = useRef(0);
  const resizeStartWidthRef = useRef(380);

  // Backward-compatible alias for existing tests
  const isPopupOpen = isSidePanelOpen;
  const setIsPopupOpen = setIsSidePanelOpen;

  // Page-Wide Auto-Optimization & Metric Impact states
  const [optimizationMode, setOptimizationMode] = useState<'baseline' | 'optimized'>('baseline');
  const [showImpactDrawer, setShowImpactDrawer] = useState(false);
  const [activeMetrics, setActiveMetrics] = useState({
    targetSize: true,
    contrast: true,
    textSpacing: true,
  });

  const stageRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [fitScale, setFitScale] = useState(1);

  // Target URL or fixture path
  const iframeSrc = currentRun.fixtureId
    ? `/fixtures/${currentRun.fixtureId}`
    : currentRun.targetUrl;

  // Calculate pins: Placed in the LEFT GUTTER outside the UI, with leader lines pointing to the element
  const { pins, pageLevelIssues, targetSelectors, contrastSelectors, spacingSelectors } = useMemo(() => {
    const calculatedPins: IssuePinData[] = [];
    const nonGeometricIssues: GroupedUXIssue[] = [];
    const tSels: string[] = [];
    const cSels: string[] = [];
    const sSels: string[] = [];

    // Sort issues by priority/severity: candidateFail first, then needsReview, then pass
    const severityOrder = { candidateFail: 0, needsReview: 1, pass: 2 };
    const sortedGroups = [...currentRun.groupedIssues].sort(
      (a, b) => severityOrder[a.status] - severityOrder[b.status]
    );

    // Collect selectors ONLY from actual failures for candidate optimization
    for (const group of sortedGroups) {
      const rep = group.representative;
      if (!rep) continue;
      const ruleId = rep.ruleId || group.occurrences?.[0]?.ruleId || '';
      const selector = rep.selector || '';
      if (group.status === 'candidateFail') {
        if (ruleId === 'target-size' && selector) tSels.push(selector);
        if (ruleId.includes('contrast') && selector) cSels.push(selector);
        if (ruleId.includes('spacing') && selector) sSels.push(selector);
      }
    }

    // Filter actionable issues
    const targetGroups = statusFilter === 'all'
      ? sortedGroups
      : sortedGroups.filter((g) => g.status === 'candidateFail' || g.status === 'needsReview');

    // Extract items with geometric occurrences for this viewport and sort vertically by Y
    const geometricItems: Array<{
      group: GroupedUXIssue;
      rep: any;
      ruleId: string;
      occ: any;
    }> = [];

    for (const group of targetGroups) {
      const rep = group.representative;
      if (!rep) continue;
      const ruleId = rep.ruleId || group.occurrences?.[0]?.ruleId || '';
      const matchingOcc =
        group.occurrences?.find((occ) => occ.viewport?.width === selectedViewport.width) ||
        (rep.viewport?.width === selectedViewport.width ? rep : null) ||
        rep;

      if (matchingOcc && matchingOcc.boundingBox && matchingOcc.boundingBox.width > 0 && matchingOcc.boundingBox.height > 0) {
        geometricItems.push({ group, rep, ruleId, occ: matchingOcc });
      } else {
        nonGeometricIssues.push(group);
      }
    }

    // Sort by vertical position on page so gutter pins descend in natural reading order
    geometricItems.sort((a, b) => a.occ.boundingBox.y - b.occ.boundingBox.y);

    let pinCounter = 1;
    let lastPinY = -100;

    for (const item of geometricItems) {
      const box = item.occ.boundingBox;

      // Pin is placed in the left margin gutter (x = 11, width = 22, centered in 44px gutter)
      const pinX = 11;
      const idealY = Math.max(8, box.y + Math.min(box.height / 2 - 11, 8));

      // Resolve vertical overlap along the gutter rail
      let pinY = idealY;
      if (pinY - lastPinY < 28) {
        pinY = lastPinY + 28;
      }
      lastPinY = pinY;

      const pinCenterX = pinX + 11;
      const pinCenterY = pinY + 11;

      // Target point on the element boundary inside the UI page (offset by LEFT_GUTTER)
      const targetX = LEFT_GUTTER + box.x;
      const targetY = Math.max(box.y + 4, Math.min(pinCenterY, box.y + box.height - 4));

      calculatedPins.push({
        index: pinCounter++,
        fingerprint: item.group.fingerprint,
        groupedIssue: item.group,
        title: item.rep.title,
        status: item.group.status,
        priority: item.group.currentPriority,
        ruleId: item.ruleId,
        wcagCriterion: item.rep.wcagCriterion,
        boundingBox: box,
        selector: item.occ.selector || item.rep.selector || '',
        measured: item.occ.measured || {},
        expected: item.occ.expected || {},
        pinX,
        pinY,
        pinCenterX,
        pinCenterY,
        targetX,
        targetY,
      });
    }

    return {
      pins: calculatedPins,
      pageLevelIssues: nonGeometricIssues,
      targetSelectors: Array.from(new Set(tSels)),
      contrastSelectors: Array.from(new Set(cSels)),
      spacingSelectors: Array.from(new Set(sSels)),
    };
  }, [currentRun.groupedIssues, selectedViewport.width, statusFilter, selectedViewport]);

  // Inject candidate CSS into iframe when optimizationMode is 'optimized'
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const applyOptimizationCss = () => {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!doc || !doc.head) return;

        let styleEl = doc.getElementById('proofui-auto-optimize-styles') as HTMLStyleElement | null;
        if (!styleEl) {
          styleEl = doc.createElement('style');
          styleEl.id = 'proofui-auto-optimize-styles';
          doc.head.appendChild(styleEl);
        }

        if (optimizationMode === 'baseline') {
          styleEl.textContent = '';
          return;
        }

        let css = '';

        if (activeMetrics.targetSize && targetSelectors.length > 0) {
          const tSel = targetSelectors.join(', ');
          css += `
            /* Target Size Optimization: WCAG 2.2 AA 24px */
            ${tSel} {
              min-width: 24px !important;
              min-height: 24px !important;
              box-sizing: border-box !important;
              transition: all 150ms ease !important;
            }
          `;
        }

        if (activeMetrics.contrast && contrastSelectors.length > 0) {
          const cSel = contrastSelectors.join(', ');
          css += `
            /* Color Contrast Optimization: Minimum 4.5:1 Accessible Text */
            ${cSel} {
              color: #0f172a !important;
              transition: color 150ms ease !important;
            }
          `;
        }

        if (activeMetrics.textSpacing && spacingSelectors.length > 0) {
          const sSel = spacingSelectors.join(', ');
          css += `
            /* Text Spacing Optimization: Fluid Responsive Container */
            ${sSel} {
              height: auto !important;
              min-height: fit-content !important;
              overflow: visible !important;
              max-width: 100% !important;
            }
          `;
        }

        styleEl.textContent = css;
      } catch {
        // Cross-origin fallback
      }
    };

    applyOptimizationCss();
    iframe.addEventListener('load', applyOptimizationCss);
    return () => iframe.removeEventListener('load', applyOptimizationCss);
  }, [optimizationMode, activeMetrics, iframeSrc, targetSelectors, contrastSelectors, spacingSelectors]);

  // Filtered pins
  const visiblePins = useMemo(() => {
    if (statusFilter === 'issues') {
      return pins.filter((p) => p.status === 'candidateFail' || p.status === 'needsReview');
    }
    if (statusFilter === 'candidateFail') {
      return pins.filter((p) => p.status === 'candidateFail');
    }
    if (statusFilter === 'needsReview') {
      return pins.filter((p) => p.status === 'needsReview');
    }
    return pins;
  }, [pins, statusFilter]);

  // Active pin or fallback to first candidateFail / visible pin
  const activePin = useMemo(() => {
    if (activeFingerprint) {
      const match = pins.find((p) => p.fingerprint === activeFingerprint);
      if (match) return match;
    }
    const firstFail = visiblePins.find((p) => p.status === 'candidateFail');
    if (firstFail) return firstFail;
    const firstReview = visiblePins.find((p) => p.status === 'needsReview');
    if (firstReview) return firstReview;
    return visiblePins[0] || pins[0] || null;
  }, [activeFingerprint, pins, visiblePins]);

  // Calculate Fit scale dynamically via ResizeObserver
  useEffect(() => {
    const updateFitScale = () => {
      if (!stageRef.current) return;
      const totalWidth = selectedViewport.width + LEFT_GUTTER;
      const containerWidth = stageRef.current.clientWidth - 48;
      if (containerWidth > 0 && totalWidth > 0) {
        const calculated = Math.min(1, containerWidth / totalWidth);
        setFitScale(calculated);
      }
    };

    updateFitScale();

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && stageRef.current) {
      ro = new ResizeObserver(() => {
        updateFitScale();
      });
      ro.observe(stageRef.current);
    }

    window.addEventListener('resize', updateFitScale);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', updateFitScale);
    };
  }, [selectedViewport.width, isFullScreen, panelWidth, isSidePanelOpen]);

  // Keyboard shortcut listener for Esc and outside click listener for View menu
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isViewMenuOpen) {
          setIsViewMenuOpen(false);
        } else if (isSidePanelOpen) {
          setIsSidePanelOpen(false);
        } else if (showImpactDrawer) {
          setShowImpactDrawer(false);
        } else if (isFullScreen) {
          setIsFullScreen(false);
        }
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (viewMenuRef.current && !viewMenuRef.current.contains(e.target as Node)) {
        setIsViewMenuOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isViewMenuOpen, isSidePanelOpen, showImpactDrawer, isFullScreen]);

  // Resizable drawer drag handlers
  const handleStartResize = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeStartXRef.current = e.clientX;
    resizeStartWidthRef.current = panelWidth;
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = resizeStartXRef.current - e.clientX;
      const nextWidth = Math.max(260, Math.min(560, resizeStartWidthRef.current + delta));
      setPanelWidth(nextWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const effectiveScale = zoomScale === 'fit' ? fitScale : zoomScale;

  // Zoom into active issue bounding box without changing audited viewport (1.5x for clear legibility)
  const handleZoomToIssue = useCallback((pinToZoom?: IssuePinData) => {
    const pin = pinToZoom || activePin;
    if (!pin || !scrollContainerRef.current) return;

    const targetScale = 1.5;
    setZoomScale(targetScale);

    setTimeout(() => {
      if (!scrollContainerRef.current) return;
      const container = scrollContainerRef.current;
      const targetElementCenterX = (LEFT_GUTTER + pin.boundingBox.x + pin.boundingBox.width / 2) * targetScale;
      const targetElementCenterY = (pin.boundingBox.y + pin.boundingBox.height / 2) * targetScale;

      const targetScrollLeft = Math.max(0, targetElementCenterX - container.clientWidth / 2);
      const targetScrollTop = Math.max(0, targetElementCenterY - container.clientHeight / 2);

      container.scrollTo({
        left: targetScrollLeft,
        top: targetScrollTop,
        behavior: 'smooth',
      });
    }, 50);
  }, [activePin]);

  const handleResetToFit = useCallback(() => {
    setZoomScale('fit');
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        left: 0,
        top: 0,
        behavior: 'smooth',
      });
    }
  }, []);

  // Handle Pin Selection and Opening Side Panel
  const handlePinClick = (pin: IssuePinData) => {
    onSelectIssue(pin.fingerprint);
    setIsSidePanelOpen(true);
  };

  // 3-Way Issue Disposition: Confirm, Dismiss, or Leave for Review
  const handleDispositionChange = async (disposition: 'confirmed_issue' | 'false_positive' | 'needs_review') => {
    if (!activePin || isSavingDecision) return;
    setIsSavingDecision(true);
    setActionFeedback(null);

    const reasons: Record<typeof disposition, string> = {
      confirmed_issue: 'Confirmed as verified issue for backlog remediation',
      false_positive: 'Dismissed as acceptable design intent or false positive in context',
      needs_review: 'Flagged for team review and verification',
    };

    const feedbackMessages: Record<typeof disposition, string> = {
      confirmed_issue: 'Confirmed as verified issue (queued for backlog)',
      false_positive: 'Dismissed as false positive / design intent',
      needs_review: 'Marked for team review (pending triage)',
    };

    try {
      const res = await fetch('/api/decisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          runId: currentRun.id,
          fingerprint: activePin.fingerprint,
          disposition,
          reason: reasons[disposition],
          reviewer: 'Visual Canvas',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to update review status');

      setActionFeedback(feedbackMessages[disposition]);
      if (onDecisionSaved) onDecisionSaved(data.updatedGroup);
      setTimeout(() => setActionFeedback(null), 3500);
    } catch (err: unknown) {
      setActionFeedback(err instanceof Error ? err.message : 'Failed to update review status');
    } finally {
      setIsSavingDecision(false);
    }
  };

  // Step 1: Confirm Issue into Backlog (Legacy/Direct wrapper)
  const handleConfirmIssue = () => handleDispositionChange('confirmed_issue');

  // Accept Fix into Spec: Records token into spec, explicitly unverified until Sandbox re-audit
  const handleAcceptFixIntoSpec = async () => {
    if (!activePin || isSavingDecision) return;
    setIsSavingDecision(true);
    setActionFeedback(null);

    try {
      const res = await fetch('/api/decisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          runId: currentRun.id,
          fingerprint: activePin.fingerprint,
          decision: 'accept',
          reason: 'Accepted proposed remediation fix into design token spec (automated verification pending in Sandbox)',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Could not accept fix into spec.');
      }

      setActionFeedback('Accepted into spec · Status unverified until Sandbox re-audit');
      if (onDecisionSaved) {
        onDecisionSaved(data.updatedGroup);
      }
      setTimeout(() => setActionFeedback(null), 4000);
    } catch (err: unknown) {
      setActionFeedback(err instanceof Error ? err.message : 'Could not accept fix');
    } finally {
      setIsSavingDecision(false);
    }
  };

  // Step 2: Accept Fix or Dismiss
  const handleQuickDecision = async (decision: DesignerDecision) => {
    if (decision === 'accept') {
      return handleAcceptFixIntoSpec();
    }
    if (decision === 'reject') {
      return handleDispositionChange('false_positive');
    }
    if (!activePin || isSavingDecision) return;
    setIsSavingDecision(true);
    setActionFeedback(null);

    try {
      const res = await fetch('/api/decisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          runId: currentRun.id,
          fingerprint: activePin.fingerprint,
          decision,
          reason: 'Reprioritized via Visual Canvas',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Could not save decision.');
      }

      setActionFeedback('Reprioritized issue');
      if (onDecisionSaved) {
        onDecisionSaved(data.updatedGroup);
      }
      setTimeout(() => setActionFeedback(null), 3500);
    } catch (err: unknown) {
      setActionFeedback(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSavingDecision(false);
    }
  };

  const handleOpenInSandbox = (pin: IssuePinData) => {
    try {
      const code = createSandboxSnippetFromIssue({
        selector: pin.selector,
        element: pin.selector.split(/[.#:[ ]/)[0] || 'button',
        title: pin.title,
        accessibleName: (pin.measured?.accessibleName as string) || pin.title,
        ruleId: pin.ruleId,
        wcagCriterion: pin.wcagCriterion,
        measured: pin.measured,
        expected: pin.expected,
      });
      sessionStorage.setItem(
        'proofui_sandbox_init',
        JSON.stringify({ code, source: 'canvas', title: pin.title, ruleId: pin.ruleId })
      );
    } catch {
      // Fallback
    }
    window.location.href = '/sandbox?from=canvas';
  };

  // Deterministic single source of truth for contrast candidate calculations & consistency
  const getContrastRemediation = (pin: IssuePinData) => {
    const textColor = (pin.measured?.color as string) || (pin.measured?.textColor as string) || (pin.measured?.indicatorColor as string) || '#737373';
    const rawBgColor = (pin.measured?.backgroundColor as string) || (pin.measured?.adjacentColor as string) || '#ffffff';
    const isTransparent = rawBgColor === 'transparent' || rawBgColor.startsWith('rgba(0, 0, 0, 0)') || rawBgColor.startsWith('rgba(0,0,0,0)');
    const effectiveBg = isTransparent ? '#ffffff' : rawBgColor;

    const bgRgba = parseColor(effectiveBg) || { r: 255, g: 255, b: 255, a: 1 };
    const isDarkBg = (bgRgba.r * 299 + bgRgba.g * 587 + bgRgba.b * 114) / 1000 < 128;
    const candidateColor = isDarkBg ? '#ffffff' : '#0f172a';

    let candidateRatio = 4.5;
    try {
      candidateRatio = calculateContrastRatioRaw(candidateColor, effectiveBg);
    } catch {
      candidateRatio = isDarkBg ? 16.5 : 17.85;
    }

    const hasComplexBg = Boolean(pin.measured?.hasComplexBackground);
    const hasTransparency = Boolean(pin.measured?.hasUnresolvedTransparency) || isTransparent;

    return {
      textColor,
      rawBgColor,
      effectiveBg,
      isTransparent,
      hasComplexBg,
      hasTransparency,
      isCompositeOrComplex: hasComplexBg || hasTransparency,
      candidateColor,
      candidateRatio,
    };
  };

  const getCssFixSnippet = (pin: IssuePinData): string => {
    if (pin.ruleId === 'target-size') {
      return `/* WCAG 2.2 SC 2.5.8 Target Size (44px HIG / 24px WCAG AA) */\n${pin.selector} {\n  min-width: 44px;\n  min-height: 44px;\n  padding: 10px 14px;\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n}`;
    }
    if (pin.ruleId.includes('contrast')) {
      const { candidateColor, candidateRatio } = getContrastRemediation(pin);
      return `/* WCAG 2.2 SC 1.4.3 Minimum Contrast (Projected: ${candidateRatio.toFixed(2)}:1) */\n${pin.selector} {\n  color: ${candidateColor} !important;\n}`;
    }
    if (pin.ruleId.includes('text-spacing')) {
      return `/* WCAG 2.2 SC 1.4.12 Text Spacing (Fluid Container) */\n${pin.selector} {\n  height: auto !important;\n  min-height: fit-content !important;\n  overflow: visible !important;\n}`;
    }
    return `/* WCAG Responsive Remediation */\n${pin.selector} {\n  max-width: 100% !important;\n}`;
  };

  const getSpecNoteSnippet = (pin: IssuePinData): string => {
    if (pin.ruleId.includes('contrast')) {
      const { candidateColor, candidateRatio, effectiveBg } = getContrastRemediation(pin);
      return `[ProofUI Handoff]\nIssue: ${pin.title}\nElement: ${pin.selector}\nMeasured Ratio: ${(Number(pin.measured?.contrastRatio) || 2.32).toFixed(2)}:1\nProposed Color: ${candidateColor}\nBackground: ${effectiveBg}\nProjected Ratio: ${candidateRatio.toFixed(2)}:1\nWCAG: ${pin.wcagCriterion}`;
    }
    return `[ProofUI Handoff]\nIssue: ${pin.title}\nElement: ${pin.selector}\nMeasured: ${Math.round(pin.boundingBox.width)}x${Math.round(pin.boundingBox.height)}px\nTarget Spec: min-width: 44px, min-height: 44px, touch-padding: 12px\nWCAG: ${pin.wcagCriterion}`;
  };

  // Extract authentic element text and typography from deterministic measurements
  const getElementTextAndTypography = (pin: IssuePinData) => {
    // Prioritize authentic rendered text snippet/content over screen-reader-only labels
    const rawText =
      (pin.measured?.textSnippet as string) ||
      (pin.measured?.textContent as string) ||
      (pin.measured?.accessibleName as string) ||
      (pin.groupedIssue?.representative?.accessibleName as string) ||
      '';

    const cleanText = rawText.trim();
    const fallbackText = pin.selector ? pin.selector.replace(/^[.#]/, '').replace(/[_-]/g, ' ') : 'Sample Text';
    const text = cleanText.length > 0 ? cleanText : fallbackText;

    const rawFontSize = pin.measured?.fontSizePx;
    const hasMeasuredFont = rawFontSize !== undefined && rawFontSize !== null && !isNaN(Number(rawFontSize)) && Number(rawFontSize) > 0;
    const fontSize = hasMeasuredFont
      ? `${Math.min(20, Math.max(12, Math.round(Number(rawFontSize))))}px`
      : '14px';

    const fontWeight = pin.measured?.fontWeight
      ? String(pin.measured.fontWeight)
      : '500';

    return { text, fontSize, fontWeight, isSimulatedFont: !hasMeasuredFont };
  };

  const getCleanRuleTitle = (pin: IssuePinData): string => {
    if (pin.ruleId.includes('contrast')) {
      return 'Text contrast below threshold';
    }
    if (pin.ruleId === 'target-size') {
      return 'Interactive target below 24×24px threshold';
    }
    if (pin.ruleId.includes('text-spacing')) {
      return 'Text spacing overflow detected';
    }
    if (pin.ruleId.includes('reflow')) {
      return 'Reflow horizontal overflow';
    }
    return pin.title.replace(/\s*\([^)]*\)$/, '');
  };

  // 3-Column Deterministic Metric Cards: Measured | Required | Estimated (Short names, zero truncation)
  const renderMetricThreeColumns = (pin: IssuePinData) => {
    if (pin.ruleId.includes('contrast')) {
      const measuredRatio = Number(pin.measured?.contrastRatio) || 2.32;
      const targetRatio = Number(pin.expected?.minRatio) || 4.5;
      const { candidateRatio } = getContrastRemediation(pin);

      return (
        <div className="metric-three-columns">
          <div className="metric-cell cell-measured">
            <span className="metric-cell-label">Measured</span>
            <span className="metric-cell-value">{measuredRatio.toFixed(2)}:1</span>
            <span className="metric-cell-meta">Below threshold</span>
          </div>
          <div className="metric-cell cell-threshold">
            <span className="metric-cell-label">Required</span>
            <span className="metric-cell-value">≥ {targetRatio.toFixed(1)}:1</span>
            <span className="metric-cell-meta">WCAG AA spec</span>
          </div>
          <div className="metric-cell cell-projected">
            <span className="metric-cell-label">Estimated</span>
            <span className="metric-cell-value">~{candidateRatio.toFixed(2)}:1</span>
            <span className="metric-cell-meta">Draft simulation</span>
          </div>
        </div>
      );
    }

    if (pin.ruleId === 'target-size') {
      const measuredW = Math.round(Number(pin.measured?.width) || pin.boundingBox.width || 18);
      const measuredH = Math.round(Number(pin.measured?.height) || pin.boundingBox.height || 18);

      return (
        <div className="metric-three-columns">
          <div className="metric-cell cell-measured">
            <span className="metric-cell-label">Measured</span>
            <span className="metric-cell-value">{measuredW}×{measuredH}px</span>
            <span className="metric-cell-meta">Below minimum</span>
          </div>
          <div className="metric-cell cell-threshold">
            <span className="metric-cell-label">Required</span>
            <span className="metric-cell-value">≥ 24×24px</span>
            <span className="metric-cell-meta">WCAG 2.5.8 spec</span>
          </div>
          <div className="metric-cell cell-projected">
            <span className="metric-cell-label">Estimated</span>
            <span className="metric-cell-value">44×44px</span>
            <span className="metric-cell-meta">Draft simulation</span>
          </div>
        </div>
      );
    }

    // Default (Text-spacing, Reflow, etc.)
    return (
      <div className="metric-three-columns">
        <div className="metric-cell cell-measured">
          <span className="metric-cell-label">Measured</span>
          <span className="metric-cell-value">Fixed layout</span>
          <span className="metric-cell-meta">Clipping/overflow</span>
        </div>
        <div className="metric-cell cell-threshold">
          <span className="metric-cell-label">Required</span>
          <span className="metric-cell-value">0px overflow</span>
          <span className="metric-cell-meta">Fluid reflow spec</span>
        </div>
        <div className="metric-cell cell-projected">
          <span className="metric-cell-label">Estimated</span>
          <span className="metric-cell-value">Fluid auto</span>
          <span className="metric-cell-meta">Draft simulation</span>
        </div>
      </div>
    );
  };

  // Stacked Before / After comparison with authentic element text, line wrapping, and dynamic background handling
  const renderVisualComparison = (pin: IssuePinData) => {
    const { text: actualText, fontSize, fontWeight, isSimulatedFont } = getElementTextAndTypography(pin);
    const elementBg = (pin.measured?.backgroundColor as string) || (pin.measured?.adjacentColor as string) || '#ffffff';

    if (pin.ruleId.includes('contrast')) {
      const {
        textColor,
        effectiveBg,
        candidateColor,
        candidateRatio,
        isTransparent,
        isCompositeOrComplex,
      } = getContrastRemediation(pin);

      return (
        <div className="comparison-stack">
          {/* Before (Current baseline) */}
          <div className="comparison-card card-before">
            <div className="flex items-center justify-between">
              <div className="card-badge badge-before">Baseline (Current)</div>
              {isSimulatedFont && (
                <span className="simulated-font-badge" title="Rendered text is authentic; font size is simulated">
                  [Simulated typography]
                </span>
              )}
            </div>
            {/* Swatch box strictly preserves authentic element background without card tint bleeding */}
            <div
              className={`spec-visual-box box-before ${isTransparent ? 'is-transparent-bg' : ''}`}
              style={{ backgroundColor: isTransparent ? undefined : effectiveBg }}
            >
              <div
                className="contrast-text-sample"
                style={{
                  color: textColor,
                  backgroundColor: isTransparent ? 'transparent' : effectiveBg,
                  fontSize,
                  fontWeight,
                }}
                title={actualText}
              >
                {actualText}
              </div>
            </div>
            {isCompositeOrComplex && (
              <div className="bg-limitation-pill" title="Element has non-solid or transparent background context. Preview swatch shows solid fallback.">
                <Icon name="Info" size={11} />
                <span>Composite/Transparent BG · Refer to live Canvas</span>
              </div>
            )}
            <div className="spec-details">
              <div className="spec-metric tone-danger">
                <strong>Measured:</strong> Below WCAG AA contrast threshold
              </div>
            </div>
          </div>

          {/* After (Suggested preview - Neutral slate styling, NOT green) */}
          <div className="comparison-card card-after card-suggested">
            <div className="flex items-center justify-between">
              <div className="card-badge badge-after">Suggested Fix (Preview)</div>
              <span className="unverified-pill">Not re-audited</span>
            </div>
            {/* Swatch box strictly preserves authentic element background without card tint bleeding */}
            <div
              className={`spec-visual-box box-after ${isTransparent ? 'is-transparent-bg' : ''}`}
              style={{ backgroundColor: isTransparent ? undefined : effectiveBg }}
            >
              <div
                className="contrast-text-sample"
                style={{
                  color: candidateColor,
                  backgroundColor: isTransparent ? 'transparent' : effectiveBg,
                  fontSize,
                  fontWeight,
                }}
                title={actualText}
              >
                {actualText}
              </div>
            </div>
            <div className="spec-details">
              <div className="spec-metric tone-success">
                <strong>Recommended:</strong> Projected contrast satisfies WCAG AA (~{candidateRatio.toFixed(2)}:1)
              </div>
            </div>

            {/* Compact copy actions right inside the suggested fix card */}
            <div className="card-copy-actions">
              <button
                type="button"
                className="action-btn btn-copy"
                onClick={() => copyToClipboard(getCssFixSnippet(pin), 'CSS Fix')}
              >
                <Icon name={copiedLabel === 'CSS Fix' ? 'Check' : 'FileText'} size={12} />
                <span>{copiedLabel === 'CSS Fix' ? 'CSS Copied!' : 'Copy CSS Fix'}</span>
              </button>
              <button
                type="button"
                className="action-btn btn-copy"
                onClick={() => copyToClipboard(getSpecNoteSnippet(pin), 'Design Token')}
              >
                <Icon name={copiedLabel === 'Design Token' ? 'Check' : 'Download'} size={12} />
                <span>{copiedLabel === 'Design Token' ? 'Token Copied!' : 'Copy Spec Note'}</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (pin.ruleId === 'target-size') {
      const measuredWidth = Math.round(Number(pin.measured?.width) || pin.boundingBox.width || 18);
      const measuredHeight = Math.round(Number(pin.measured?.height) || pin.boundingBox.height || 18);

      return (
        <div className="comparison-stack">
          {/* Before (Current baseline) */}
          <div className="comparison-card card-before">
            <div className="flex items-center justify-between">
              <div className="card-badge badge-before">Baseline (Current)</div>
              {isSimulatedFont && (
                <span className="simulated-font-badge" title="Rendered text is authentic; font size is simulated">
                  [Simulated typography]
                </span>
              )}
            </div>
            <div className="spec-visual-box box-before" style={{ backgroundColor: elementBg }}>
              <div
                className="measured-box-mock"
                style={{
                  width: `${Math.min(measuredWidth, 72)}px`,
                  height: `${Math.min(measuredHeight, 44)}px`,
                }}
                title={actualText}
              >
                {actualText.length <= 12 ? actualText : `${measuredWidth}×${measuredHeight}`}
              </div>
            </div>
            <div className="spec-details">
              <div className="spec-metric tone-danger">
                <strong>Measured:</strong> Below 24×24px minimum touch target
              </div>
            </div>
          </div>

          {/* After (Suggested preview - Neutral styling) */}
          <div className="comparison-card card-after card-suggested">
            <div className="flex items-center justify-between">
              <div className="card-badge badge-after">Suggested Fix (Preview)</div>
              <span className="unverified-pill">Not re-audited</span>
            </div>
            <div className="spec-visual-box box-after" style={{ backgroundColor: elementBg }}>
              <div
                className="candidate-box-mock"
                style={{
                  minWidth: '44px',
                  height: '44px',
                  padding: '0 12px',
                }}
                title={actualText}
              >
                <span>{actualText.length <= 16 ? actualText : '44×44px Target Spec'}</span>
                <span className="candidate-padding-guide">Touch Target Spec</span>
              </div>
            </div>
            <div className="spec-details">
              <div className="spec-metric tone-success">
                <strong>Recommended:</strong> 44×44px Target Spec
              </div>
            </div>

            {/* Compact copy actions right inside the suggested fix card */}
            <div className="card-copy-actions">
              <button
                type="button"
                className="action-btn btn-copy"
                onClick={() => copyToClipboard(getCssFixSnippet(pin), 'CSS Fix')}
              >
                <Icon name={copiedLabel === 'CSS Fix' ? 'Check' : 'FileText'} size={12} />
                <span>{copiedLabel === 'CSS Fix' ? 'CSS Copied!' : 'Copy CSS Fix'}</span>
              </button>
              <button
                type="button"
                className="action-btn btn-copy"
                onClick={() => copyToClipboard(getSpecNoteSnippet(pin), 'Design Token')}
              >
                <Icon name={copiedLabel === 'Design Token' ? 'Check' : 'Download'} size={12} />
                <span>{copiedLabel === 'Design Token' ? 'Token Copied!' : 'Copy Spec Note'}</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Default / Text spacing / Reflow
    return (
      <div className="comparison-stack">
        <div className="comparison-card card-before">
          <div className="flex items-center justify-between">
            <div className="card-badge badge-before">Baseline (Current)</div>
            {isSimulatedFont && (
              <span className="simulated-font-badge" title="Rendered text is authentic; font size is simulated">
                [Simulated typography]
              </span>
            )}
          </div>
          <div className="spec-visual-box box-before" style={{ backgroundColor: elementBg }}>
            <div
              style={{
                fontSize: '11px',
                color: '#b42318',
                fontWeight: 600,
                padding: '0 10px',
                wordBreak: 'break-word',
                whiteSpace: 'pre-wrap',
                lineHeight: 1.4,
              }}
              title={actualText}
            >
              {actualText.length > 0 ? actualText : 'Fixed Height Overflow'}
            </div>
          </div>
          <div className="spec-details">
            <div className="spec-metric tone-danger">
              <strong>Measured:</strong> Fixed container height clipping text
            </div>
          </div>
        </div>

        <div className="comparison-card card-after card-suggested">
          <div className="flex items-center justify-between">
            <div className="card-badge badge-after">Suggested Fix (Preview)</div>
            <span className="unverified-pill">Not re-audited</span>
          </div>
          <div className="spec-visual-box box-after" style={{ backgroundColor: elementBg }}>
            <div
              style={{
                fontSize: '11px',
                color: '#334155',
                fontWeight: 600,
                padding: '0 10px',
                wordBreak: 'break-word',
                whiteSpace: 'pre-wrap',
                lineHeight: 1.4,
              }}
              title={actualText}
            >
              {actualText.length > 0 ? actualText : 'Fluid Height Container'}
            </div>
          </div>
          <div className="spec-details">
            <div className="spec-metric tone-success">
              <strong>Recommended:</strong> <code>height: auto</code> fluid flow
            </div>
          </div>

          {/* Compact copy actions right inside the suggested fix card */}
          <div className="card-copy-actions">
            <button
              type="button"
              className="action-btn btn-copy"
              onClick={() => copyToClipboard(getCssFixSnippet(pin), 'CSS Fix')}
            >
              <Icon name={copiedLabel === 'CSS Fix' ? 'Check' : 'FileText'} size={12} />
              <span>{copiedLabel === 'CSS Fix' ? 'CSS Copied!' : 'Copy CSS Fix'}</span>
            </button>
            <button
              type="button"
              className="action-btn btn-copy"
              onClick={() => copyToClipboard(getSpecNoteSnippet(pin), 'Design Token')}
            >
              <Icon name={copiedLabel === 'Design Token' ? 'Check' : 'Download'} size={12} />
              <span>{copiedLabel === 'Design Token' ? 'Token Copied!' : 'Copy Spec Note'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLabel(label);
    setTimeout(() => setCopiedLabel(null), 2000);
  };

  // Stepper navigation
  const currentIndex = activePin ? visiblePins.findIndex((p) => p.fingerprint === activePin.fingerprint) : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < visiblePins.length - 1;

  const navigatePin = (direction: 'prev' | 'next') => {
    if (direction === 'prev' && hasPrev) {
      const targetPin = visiblePins[currentIndex - 1];
      onSelectIssue(targetPin.fingerprint);
      setIsSidePanelOpen(true);
    } else if (direction === 'next' && hasNext) {
      const targetPin = visiblePins[currentIndex + 1];
      onSelectIssue(targetPin.fingerprint);
      setIsSidePanelOpen(true);
    }
  };

  const getStatusColor = (status: 'pass' | 'candidateFail' | 'needsReview') => {
    switch (status) {
      case 'candidateFail':
        return { bg: '#b42318', border: '#d92d20', label: 'Candidate Issue', tone: 'danger' };
      case 'needsReview':
        return { bg: '#b54708', border: '#f79009', label: 'Requires Review', tone: 'warning' };
      case 'pass':
        return { bg: '#067647', border: '#12b76a', label: 'Threshold Passed', tone: 'success' };
    }
  };

  const failCount = currentRun.summary.candidateFailCount;
  const reviewCount = currentRun.summary.needsReviewCount;

  return (
    <div
      className={`visual-canvas-component ${isFullScreen ? 'is-fullpage' : ''}`}
      id="visual-canvas-section"
      aria-label="Visual Canvas Review"
    >
      {/* Compact 2-Row Toolbar */}
      <div className="visual-canvas-toolbar">
        {/* Row 1: Primary Title + Viewport Selector + Full Page */}
        <div className="toolbar-row">
          <div className="toolbar-cluster">
            <span className="canvas-badge">
              <Icon name="Target" size={14} />
              Visual Canvas Overlay
            </span>
            <span className="canvas-pins-counter">
              <strong>{pins.length}</strong> {pins.length === 1 ? 'pin placed' : 'pins placed'}
            </span>

            {/* Viewport Selector */}
            <div className="canvas-viewport-group" role="group" aria-label="Select viewport width">
              {viewports.map((vp) => (
                <button
                  key={vp.width}
                  type="button"
                  className={`viewport-pill ${selectedViewport.width === vp.width ? 'is-active' : ''}`}
                  onClick={() => setSelectedViewport(vp)}
                  aria-pressed={selectedViewport.width === vp.width}
                >
                  <Icon name="Maximize2" size={12} />
                  <span>
                    {vp.width === 1440
                      ? '1440px Desktop'
                      : vp.width === 375
                      ? '375px Mobile'
                      : vp.width === 320
                      ? '320px Reflow'
                      : `${vp.width}px`}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="toolbar-cluster">
            {/* Toggle Panel Button (Allows collapsing panel to expand Canvas) */}
            <button
              type="button"
              className={`canvas-toggle-btn btn-toggle-panel ${isSidePanelOpen ? 'is-active' : ''}`}
              onClick={() => setIsSidePanelOpen(!isSidePanelOpen)}
              aria-pressed={isSidePanelOpen}
              title={isSidePanelOpen ? 'Collapse Inspector (More room for Canvas)' : 'Open Details Inspector'}
            >
              <Icon name="Columns" size={14} />
              <span>{isSidePanelOpen ? 'Hide Panel' : 'Show Panel'}</span>
            </button>

            {/* Full Page Button */}
            <button
              type="button"
              className={`canvas-toggle-btn btn-fullpage ${isFullScreen ? 'is-active' : ''}`}
              onClick={() => setIsFullScreen(!isFullScreen)}
              aria-pressed={isFullScreen}
              title={isFullScreen ? 'Exit Full Page (Esc)' : 'Expand to Full Page Canvas'}
            >
              <Icon name={isFullScreen ? 'Minimize2' : 'Maximize2'} size={14} />
              <span>{isFullScreen ? 'Exit Full Page' : 'Full Page'}</span>
            </button>
          </div>
        </div>

        {/* Row 2: Status Filters + Baseline/Suggested Preview + Zoom + View Menu */}
        <div className="toolbar-row">
          <div className="toolbar-cluster">
            {/* Issue Filter Pills */}
            <div className="canvas-filter-group" role="group" aria-label="Filter pins">
              <button
                type="button"
                className={`filter-pill ${statusFilter === 'issues' ? 'is-active' : ''}`}
                onClick={() => setStatusFilter('issues')}
                title="Show all actionable issues (Failures + Review)"
              >
                <span>Issues ({failCount + reviewCount})</span>
              </button>
              <button
                type="button"
                className={`filter-pill ${statusFilter === 'candidateFail' ? 'is-active' : ''}`}
                onClick={() => setStatusFilter('candidateFail')}
                title="Show failures only"
              >
                <span>Failures ({failCount})</span>
              </button>
              {reviewCount > 0 && (
                <button
                  type="button"
                  className={`filter-pill ${statusFilter === 'needsReview' ? 'is-active' : ''}`}
                  onClick={() => setStatusFilter('needsReview')}
                  title="Show review items only"
                >
                  <span>Review ({reviewCount})</span>
                </button>
              )}
            </div>

            {/* Baseline vs Suggested Preview Switcher (Single place on Toolbar) */}
            <div className="canvas-optimization-control" role="group" aria-label="Design iteration comparison">
              <button
                type="button"
                className={`mode-btn ${optimizationMode === 'baseline' ? 'is-active' : ''}`}
                onClick={() => setOptimizationMode('baseline')}
                aria-pressed={optimizationMode === 'baseline'}
              >
                Baseline
              </button>
              <button
                type="button"
                className={`mode-btn ${optimizationMode === 'optimized' ? 'is-active' : ''}`}
                onClick={() => setOptimizationMode('optimized')}
                aria-pressed={optimizationMode === 'optimized'}
                title="Suggested preview of proposed fixes (Unverified · Not re-audited)"
              >
                <Icon name="Sparkles" size={13} />
                <span>Suggested Preview</span>
                <span className="mode-sub-badge">Not re-audited</span>
              </button>
            </div>
          </div>

          <div className="toolbar-cluster">
            {/* Zoom Controls + Zoom to Issue */}
            <div className="canvas-control-pill">
              <span className="pill-label">Scale:</span>
              <button
                type="button"
                className={zoomScale === 'fit' ? 'is-selected' : ''}
                onClick={handleResetToFit}
                title="Fit to Screen (Reset View)"
              >
                Fit ({Math.round(fitScale * 100)}%)
              </button>
              <button
                type="button"
                className={zoomScale === 1 ? 'is-selected' : ''}
                onClick={() => setZoomScale(1)}
                title="100% Actual Scale"
              >
                100%
              </button>
              <button
                type="button"
                className="btn-zoom-to-issue"
                onClick={() => handleZoomToIssue()}
                title="Zoom into the active issue bounding box without changing audited viewport"
              >
                <Icon name="Target" size={13} />
                <span>Zoom to Issue</span>
              </button>
            </div>

            {/* View Options Dropdown Menu */}
            <div className="view-menu-wrapper" ref={viewMenuRef}>
              <button
                type="button"
                className={`canvas-toggle-btn ${isViewMenuOpen ? 'is-active' : ''}`}
                onClick={() => setIsViewMenuOpen(!isViewMenuOpen)}
                aria-haspopup="true"
                aria-expanded={isViewMenuOpen}
                title="View options and overlay display toggles"
              >
                <Icon name="Sliders" size={14} />
                <span>View Options</span>
                <Icon name="ChevronDown" size={12} className={isViewMenuOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
              </button>

              {isViewMenuOpen && (
                <div className="view-menu-dropdown" role="menu">
                  <label className="view-menu-item">
                    <input
                      type="checkbox"
                      checked={showOverlays}
                      onChange={(e) => setShowOverlays(e.target.checked)}
                    />
                    <span>Show Visual Pins</span>
                  </label>
                  <label className="view-menu-item">
                    <input
                      type="checkbox"
                      checked={boxDisplayMode === 'all'}
                      onChange={(e) => setBoxDisplayMode(e.target.checked ? 'all' : 'hover_focus')}
                    />
                    <span>Outline All Boxes</span>
                  </label>
                  <label className="view-menu-item">
                    <input
                      type="checkbox"
                      checked={isSidePanelOpen}
                      onChange={(e) => setIsSidePanelOpen(e.target.checked)}
                    />
                    <span>Details Inspector Panel</span>
                  </label>
                  <label className="view-menu-item">
                    <input
                      type="checkbox"
                      checked={showImpactDrawer}
                      onChange={(e) => setShowImpactDrawer(e.target.checked)}
                    />
                    <span>Research Metric Impact</span>
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Metric Impact & Research Control Strip (Collapsible via View Menu) */}
      {showImpactDrawer && (
        <div className="metric-impact-strip" role="region" aria-label="Metric Impact Controls">
          <div className="impact-strip-header">
            <div className="impact-title-group">
              <span className="impact-badge">Research Control</span>
              <h4>Metric Impact on Final Design</h4>
              <p>Toggle individual metrics to preview which research threshold impacts layout.</p>
            </div>
            <button
              type="button"
              className="stepper-btn close-btn"
              onClick={() => setShowImpactDrawer(false)}
              aria-label="Close metric impact bar"
            >
              <Icon name="X" size={14} />
            </button>
          </div>

          <div className="metric-toggle-pills">
            <label className={`metric-toggle-label ${activeMetrics.targetSize ? 'is-checked' : ''}`}>
              <input
                type="checkbox"
                checked={activeMetrics.targetSize}
                onChange={(e) => {
                  setActiveMetrics({ ...activeMetrics, targetSize: e.target.checked });
                  if (optimizationMode === 'baseline') setOptimizationMode('optimized');
                }}
              />
              <span className="toggle-dot" />
              <span>Target Size: 44px (HIG) / 24px (WCAG)</span>
            </label>

            <label className={`metric-toggle-label ${activeMetrics.contrast ? 'is-checked' : ''}`}>
              <input
                type="checkbox"
                checked={activeMetrics.contrast}
                onChange={(e) => {
                  setActiveMetrics({ ...activeMetrics, contrast: e.target.checked });
                  if (optimizationMode === 'baseline') setOptimizationMode('optimized');
                }}
              />
              <span className="toggle-dot" />
              <span>Color Contrast: 4.5:1 Accessible Tokens</span>
            </label>

            <label className={`metric-toggle-label ${activeMetrics.textSpacing ? 'is-checked' : ''}`}>
              <input
                type="checkbox"
                checked={activeMetrics.textSpacing}
                onChange={(e) => {
                  setActiveMetrics({ ...activeMetrics, textSpacing: e.target.checked });
                  if (optimizationMode === 'baseline') setOptimizationMode('optimized');
                }}
              />
              <span className="toggle-dot" />
              <span>Fluid Containers: Text Spacing Adaptation</span>
            </label>
          </div>
        </div>
      )}

      {/* Main 2-Column Split Workspace (Both Normal & Full Page modes) */}
      <div className="visual-canvas-workspace">
        {/* Left Column: Canvas Stage */}
        <div className="canvas-stage-wrapper" ref={stageRef}>
          {/* Mock Browser Shell Bar */}
          <div className="mock-browser-bar">
            <div className="browser-traffic-dots">
              <span className="dot dot-red" />
              <span className="dot dot-yellow" />
              <span className="dot dot-green" />
            </div>
            <div className="browser-url-display">
              <Icon name="ShieldAlert" size={13} color="var(--foreground-muted)" />
              <span className="browser-url-text">
                {currentRun.fixtureId ? `fixture://${currentRun.fixtureId}` : currentRun.targetUrl}
              </span>
            </div>
            <div className="browser-viewport-tag">
              {optimizationMode === 'optimized' && (
                <span className="optimized-live-badge">Suggested Preview (Not re-audited)</span>
              )}
              {selectedViewport.width} × {selectedViewport.height} px · {Math.round(effectiveScale * 100)}%
            </div>
          </div>

          {/* Viewport Frame with Outside Left Gutter for Pins */}
          <div className="canvas-scroll-container" ref={scrollContainerRef}>
            <div
              className="canvas-scaled-frame"
              style={{
                width: `${(selectedViewport.width + LEFT_GUTTER) * effectiveScale}px`,
                height: `${Math.max(selectedViewport.height, 620) * effectiveScale}px`,
              }}
            >
              <div
                className="canvas-viewport-inner"
                style={{
                  width: `${selectedViewport.width + LEFT_GUTTER}px`,
                  height: `${Math.max(selectedViewport.height, 620)}px`,
                  transform: `scale(${effectiveScale})`,
                  transformOrigin: 'top left',
                }}
              >
                {/* Left Gutter Rail: Keeps pins completely outside page content */}
                <div className="canvas-left-gutter" aria-hidden="true" />

                {/* Page Iframe */}
                <iframe
                  ref={iframeRef}
                  title="Audit Page Live Render"
                  src={iframeSrc}
                  className="canvas-iframe"
                  style={{
                    position: 'absolute',
                    left: `${LEFT_GUTTER}px`,
                    top: 0,
                    width: `${selectedViewport.width}px`,
                    height: '100%',
                    border: 'none',
                  }}
                  tabIndex={-1}
                  aria-hidden="true"
                />

                {/* Overlay with Leader Lines and Bounding Boxes */}
                {showOverlays && (
                  <div className="canvas-interactive-overlay" aria-label="Visual Issue Overlay">
                    {/* SVG Connector Lines from Gutter Pins across to Elements */}
                    <svg
                      className="canvas-pin-connectors"
                      style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        pointerEvents: 'none',
                        zIndex: 10,
                        overflow: 'visible',
                      }}
                    >
                      <defs>
                        <filter id="pin-line-shadow" x="-30%" y="-30%" width="160%" height="160%">
                          <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#000000" floodOpacity="0.22" />
                        </filter>
                      </defs>
                      {visiblePins.map((pin) => {
                        const isSelected = activePin?.fingerprint === pin.fingerprint;
                        const isHovered = hoveredFingerprint === pin.fingerprint;
                        const isHighlighted = isSelected || isHovered;
                        const colors = getStatusColor(pin.status);
                        const strokeColor = isHighlighted ? '#2563eb' : colors.bg;

                        return (
                          <g key={`connector-${pin.fingerprint}`}>
                            <line
                              x1={pin.pinCenterX}
                              y1={pin.pinCenterY}
                              x2={pin.targetX}
                              y2={pin.targetY}
                              stroke={strokeColor}
                              strokeWidth={isHighlighted ? 2.25 : 1.5}
                              strokeDasharray={isHighlighted ? undefined : '3 2'}
                              filter="url(#pin-line-shadow)"
                            />
                            <circle
                              cx={pin.targetX}
                              cy={pin.targetY}
                              r={isHighlighted ? 3.5 : 2.5}
                              fill={strokeColor}
                              stroke="#ffffff"
                              strokeWidth={1}
                            />
                          </g>
                        );
                      })}
                    </svg>

                    {visiblePins.map((pin) => {
                      const isSelected = activePin?.fingerprint === pin.fingerprint;
                      const isHovered = hoveredFingerprint === pin.fingerprint;
                      const isBoxVisible = boxDisplayMode === 'all' || isSelected || isHovered;
                      const colors = getStatusColor(pin.status);
                      const box = pin.boundingBox;

                      return (
                        <React.Fragment key={pin.fingerprint}>
                          {/* Bounding Box Highlight - Transparent background, offset by LEFT_GUTTER */}
                          {isBoxVisible && (
                            <div
                              className={`canvas-bounding-box ${isSelected ? 'is-selected' : ''} ${isHovered ? 'is-hovered' : ''} tone-${colors.tone}`}
                              style={{
                                left: `${LEFT_GUTTER + box.x}px`,
                                top: `${box.y}px`,
                                width: `${box.width}px`,
                                height: `${box.height}px`,
                                borderColor: isSelected || isHovered ? undefined : colors.border,
                                background: 'transparent',
                              }}
                              onClick={() => handlePinClick(pin)}
                              onMouseEnter={() => setHoveredFingerprint(pin.fingerprint)}
                              onMouseLeave={() => setHoveredFingerprint(null)}
                              title={`Pin ${pin.index}: ${pin.title} (${Math.round(box.width)}×${Math.round(box.height)}px)`}
                            >
                              {/* Dimension Badge: ONLY shown on hover to prevent permanently obscuring headers */}
                              {isHovered && (
                                <div
                                  className="bounding-box-badge"
                                  style={{
                                    position: 'absolute',
                                    bottom: 'calc(100% + 4px)',
                                    left: 0,
                                    background: colors.bg,
                                  }}
                                >
                                  <span>#{pin.index}: {Math.round(box.width)}×{Math.round(box.height)}px</span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Pin Button in the Left Gutter */}
                          <button
                            type="button"
                            className={`canvas-pin-marker ${isSelected ? 'is-selected' : ''} ${isHovered ? 'is-hovered' : ''} tone-${colors.tone}`}
                            style={{
                              left: `${pin.pinX}px`,
                              top: `${pin.pinY}px`,
                              backgroundColor: colors.bg,
                            }}
                            onClick={() => handlePinClick(pin)}
                            onMouseEnter={() => setHoveredFingerprint(pin.fingerprint)}
                            onMouseLeave={() => setHoveredFingerprint(null)}
                            aria-label={`Pin ${pin.index}: ${pin.title}`}
                          >
                            <span className="pin-number">{pin.index}</span>
                          </button>
                        </React.Fragment>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Page-level issues notice */}
          {pageLevelIssues.length > 0 && (
            <div className="canvas-global-notice">
              <span className="notice-icon">
                <Icon name="Info" size={14} />
              </span>
              <div className="notice-text">
                <strong>{pageLevelIssues.length} page-level finding{pageLevelIssues.length > 1 ? 's' : ''}</strong>
                <span>(Overflow or layout issues without a single bounding box):</span>
                <div className="notice-chips">
                  {pageLevelIssues.map((issue) => (
                    <button
                      key={issue.fingerprint}
                      type="button"
                      className="page-issue-chip"
                      onClick={() => {
                        onSelectIssue(issue.fingerprint);
                        setIsSidePanelOpen(true);
                      }}
                    >
                      {issue.representative.title}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Real 2-Column Details Inspector Drawer (360-420px Resizable) */}
        {isSidePanelOpen && activePin && (
          <aside
            className="canvas-inspector-drawer"
            style={{ width: `${panelWidth}px` }}
            aria-label="Issue Inspector"
          >
            {/* Drag Resize Handle on left border */}
            <div
              className={`inspector-resize-handle ${isResizing ? 'is-resizing' : ''}`}
              onMouseDown={handleStartResize}
              title="Drag to resize details panel"
            />

            {/* 1. Header: Fixed non-scrollable top bar */}
            <header className="inspector-header">
              <div className="stepper-title">
                <span className={`inspector-pin-badge tone-${getStatusColor(activePin.status).tone}`}>
                  Pin #{activePin.index}
                </span>
                <span className="stepper-counter">
                  Issue {currentIndex >= 0 ? currentIndex + 1 : 1} of {visiblePins.length}
                </span>
              </div>
              <div className="stepper-nav">
                <button
                  type="button"
                  className="stepper-btn"
                  onClick={() => handleZoomToIssue(activePin)}
                  title="Zoom into this issue"
                  aria-label="Zoom into issue"
                >
                  <Icon name="Target" size={14} />
                </button>
                <button
                  type="button"
                  className="stepper-btn"
                  disabled={!hasPrev}
                  onClick={() => navigatePin('prev')}
                  aria-label="Previous issue"
                  title="Previous issue (←)"
                >
                  <Icon name="ChevronDown" size={16} style={{ transform: 'rotate(90deg)' }} />
                </button>
                <button
                  type="button"
                  className="stepper-btn"
                  disabled={!hasNext}
                  onClick={() => navigatePin('next')}
                  aria-label="Next issue"
                  title="Next issue (→)"
                >
                  <Icon name="ChevronDown" size={16} style={{ transform: 'rotate(-90deg)' }} />
                </button>
                <button
                  type="button"
                  className="stepper-btn close-btn"
                  onClick={() => setIsSidePanelOpen(false)}
                  aria-label="Close inspector"
                  title="Close (Esc)"
                >
                  <Icon name="X" size={16} />
                </button>
              </div>
            </header>

            {/* 2. Scrollable Body: Content scrolls freely without being blocked by footer */}
            <div className="inspector-body-scroll">
              {/* Short Baseline Notice (Condensed) */}
              {optimizationMode === 'optimized' && (
                <div className="preview-baseline-notice">
                  <Icon name="Info" size={12} />
                  <span>Measured values reflect Baseline.</span>
                </div>
              )}

              {/* Title & Key Facts */}
              <div className="summary-headline-row">
                <h3 id="popup-issue-title" className="summary-rule-title">
                  {getCleanRuleTitle(activePin)}
                </h3>
              </div>

              <div className="inspector-meta-row">
                <span className={`inspector-status-tag tone-${getStatusColor(activePin.status).tone}`}>
                  {getStatusColor(activePin.status).label}
                </span>
                <span className="inspector-priority-tag">
                  {activePin.priority} Priority
                </span>
                <span className="inspector-wcag-tag">
                  {activePin.wcagCriterion}
                </span>
              </div>

              {/* 3-Column Metric Display: Measured | Required | Estimated */}
              {renderMetricThreeColumns(activePin)}

              {/* EVIDENCE FIRST: Visual Before vs After Simulation Cards */}
              <div className="inspector-visual-comparison">
                <div className="comparison-header">
                  <span className="comparison-eyebrow">Visual Spec Comparison</span>
                </div>

                {renderVisualComparison(activePin)}

                {/* AI / Remediator recommendation */}
                {(activePin.groupedIssue.editedRecommendation || activePin.groupedIssue.aiRecommendation) && (
                  <div className="inspector-ai-rec-box">
                    <div className="ai-rec-badge">
                      <Icon name="Sparkles" size={13} />
                      <span>Remediation Guidance</span>
                    </div>
                    <p className="ai-rec-text">
                      {activePin.groupedIssue.editedRecommendation || activePin.groupedIssue.aiRecommendation}
                    </p>
                  </div>
                )}
              </div>

              {/* TRIAGE AFTER EVIDENCE: Confirm | Dismiss | Leave for Review */}
              {(() => {
                const effectiveDisposition =
                  activePin.groupedIssue.reviewDisposition ||
                  (activePin.groupedIssue.designerDecision === 'accept'
                    ? 'confirmed_issue'
                    : activePin.groupedIssue.designerDecision === 'reject'
                    ? 'false_positive'
                    : 'needs_review');

                return (
                  <div className="inspector-triage-section">
                    <span className="triage-section-label">Issue Triage Decision</span>
                    <div className="inspector-disposition-row">
                      <button
                        type="button"
                        className={`disposition-btn btn-confirm ${effectiveDisposition === 'confirmed_issue' ? 'is-selected' : ''}`}
                        disabled={isSavingDecision}
                        onClick={() => handleDispositionChange('confirmed_issue')}
                        title="Confirm this finding as a valid UX issue for backlog"
                      >
                        <Icon name="CheckCircle2" size={12} />
                        <span>Confirm Issue</span>
                      </button>
                      <button
                        type="button"
                        className={`disposition-btn btn-reject ${effectiveDisposition === 'false_positive' ? 'is-selected' : ''}`}
                        disabled={isSavingDecision}
                        onClick={() => handleDispositionChange('false_positive')}
                        title="Dismiss as acceptable design intent or false positive"
                      >
                        <Icon name="X" size={12} />
                        <span>Dismiss</span>
                      </button>
                      <button
                        type="button"
                        className={`disposition-btn btn-review ${effectiveDisposition === 'needs_review' ? 'is-selected' : ''}`}
                        disabled={isSavingDecision}
                        onClick={() => handleDispositionChange('needs_review')}
                        title="Leave for team review without forcing immediate triage"
                      >
                        <Icon name="HelpCircle" size={12} />
                        <span>Leave for Review</span>
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Collapsible Selector, RGB Colors & Technical Details */}
              <details className="inspector-collapsible-meta">
                <summary>Technical Details & Element Selector</summary>
                <div className="collapsible-content">
                  <div className="tech-meta-item">
                    <span className="tech-meta-label">Selector:</span>
                    <code>{activePin.selector}</code>
                  </div>
                  {activePin.ruleId.includes('contrast') && (
                    <div className="tech-meta-item">
                      <span className="tech-meta-label">Colors:</span>
                      <span>
                        Text: <code>{(activePin.measured?.color as string) || (activePin.measured?.textColor as string) || '#737373'}</code>
                        {' · '}
                        Background: <code>{(activePin.measured?.backgroundColor as string) || (activePin.measured?.adjacentColor as string) || '#ffffff'}</code>
                      </span>
                    </div>
                  )}
                  <div className="tech-meta-item">
                    <span className="tech-meta-label">Typography:</span>
                    <span>
                      {Boolean(activePin.measured?.fontSizePx) ? (
                        `${Number(activePin.measured?.fontSizePx)}px (weight: ${String(activePin.measured?.fontWeight || 'normal')})`
                      ) : (
                        <>
                          <span>14px (weight: 500)</span>
                          <span className="simulated-font-badge" title="Font size was not deterministically measured in DOM; rendered at standard 14px size">
                            [Simulated typography]
                          </span>
                        </>
                      )}
                    </span>
                  </div>
                </div>
              </details>

              {/* Action feedback message */}
              {actionFeedback && (
                <div className="inspector-feedback-banner">
                  <Icon name="CheckCircle2" size={16} />
                  <span>{actionFeedback}</span>
                </div>
              )}
            </div>

            {/* 3. Footer: Fixed solid block outside the scroll area, NEVER overlaying content */}
            <footer className="inspector-actions-footer">
              <button
                type="button"
                className="action-btn btn-accept"
                disabled={isSavingDecision}
                onClick={handleAcceptFixIntoSpec}
                title="Accept proposed remediation fix into design spec. Status remains unverified until re-audited in Sandbox."
              >
                <Icon name="Check" size={14} />
                <span>Accept Fix into Spec</span>
              </button>
              <button
                type="button"
                className="action-btn btn-sandbox-fix"
                onClick={() => handleOpenInSandbox(activePin)}
                title="Open in Sandbox editor to experiment and run automated re-audit verification"
              >
                <Icon name="Sparkles" size={14} />
                <span>Sandbox & Re-audit →</span>
              </button>
            </footer>
          </aside>
        )}
      </div>
    </div>
  );
}
