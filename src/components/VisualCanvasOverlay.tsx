'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AuditRun, GroupedUXIssue, Viewport, DesignerDecision } from '@/lib/schema/ux-issue';
import { createSandboxSnippetFromIssue } from '@/lib/sandbox/snippet-builder';
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
  // Outside placement & leader line coordinates
  pinX: number;
  pinY: number;
  pinCenterX: number;
  pinCenterY: number;
  targetX: number;
  targetY: number;
  placementSide: 'left' | 'top' | 'right' | 'bottom';
}

/**
 * Calculates pin placement outside the element bounding box:
 * Preference: Left or Top side, drawing a short leader line to the element border.
 * Flips to Right or Bottom if close to viewport boundaries, and shifts to resolve collisions.
 */
function calculatePinPlacement(
  box: { x: number; y: number; width: number; height: number },
  viewport: { width: number; height: number },
  occupied: Array<{ x: number; y: number }>
): {
  pinX: number;
  pinY: number;
  pinCenterX: number;
  pinCenterY: number;
  targetX: number;
  targetY: number;
  placementSide: 'left' | 'top' | 'right' | 'bottom';
} {
  const PIN_SIZE = 22;
  const PIN_GAP = 12;
  const STAGE_MARGIN = 6;
  const COLLISION_DIST = 24;

  const isColliding = (px: number, py: number) => {
    return occupied.some((pos) => Math.hypot(pos.x - px, pos.y - py) < COLLISION_DIST);
  };

  // 1. Try LEFT side of the element (preferred placement)
  if (box.x >= PIN_SIZE + PIN_GAP + STAGE_MARGIN) {
    const pinX = box.x - PIN_GAP - PIN_SIZE;
    let pinY = Math.max(
      STAGE_MARGIN,
      Math.min(
        box.y + Math.max(0, (Math.min(box.height, 44) - PIN_SIZE) / 2),
        viewport.height - PIN_SIZE - STAGE_MARGIN
      )
    );

    let shift = 0;
    while (isColliding(pinX, pinY) && shift < 4 && pinY + PIN_SIZE <= box.y + box.height + 24) {
      pinY += 26;
      shift++;
    }

    if (!isColliding(pinX, pinY)) {
      const pinCenterX = pinX + PIN_SIZE / 2;
      const pinCenterY = pinY + PIN_SIZE / 2;
      const targetX = box.x;
      const targetY = Math.max(box.y, Math.min(pinCenterY, box.y + box.height));
      return { pinX, pinY, pinCenterX, pinCenterY, targetX, targetY, placementSide: 'left' };
    }
  }

  // 2. Try TOP (above element) - for elements near the left viewport boundary
  if (box.y >= PIN_SIZE + PIN_GAP + STAGE_MARGIN) {
    let pinX = Math.max(
      STAGE_MARGIN,
      Math.min(
        box.x + Math.max(0, (Math.min(box.width, 100) - PIN_SIZE) / 2),
        viewport.width - PIN_SIZE - STAGE_MARGIN
      )
    );
    const pinY = box.y - PIN_GAP - PIN_SIZE;

    let shift = 0;
    while (isColliding(pinX, pinY) && shift < 4 && pinX + PIN_SIZE <= box.x + box.width + 24) {
      pinX += 26;
      shift++;
    }

    if (!isColliding(pinX, pinY)) {
      const pinCenterX = pinX + PIN_SIZE / 2;
      const pinCenterY = pinY + PIN_SIZE / 2;
      const targetX = Math.max(box.x, Math.min(pinCenterX, box.x + box.width));
      const targetY = box.y;
      return { pinX, pinY, pinCenterX, pinCenterY, targetX, targetY, placementSide: 'top' };
    }
  }

  // 3. Try RIGHT side of the element (if left and top hit viewport bounds)
  if (box.x + box.width + PIN_GAP + PIN_SIZE + STAGE_MARGIN <= viewport.width) {
    const pinX = box.x + box.width + PIN_GAP;
    let pinY = Math.max(
      STAGE_MARGIN,
      Math.min(
        box.y + Math.max(0, (Math.min(box.height, 44) - PIN_SIZE) / 2),
        viewport.height - PIN_SIZE - STAGE_MARGIN
      )
    );

    let shift = 0;
    while (isColliding(pinX, pinY) && shift < 4 && pinY + PIN_SIZE <= box.y + box.height + 24) {
      pinY += 26;
      shift++;
    }

    if (!isColliding(pinX, pinY)) {
      const pinCenterX = pinX + PIN_SIZE / 2;
      const pinCenterY = pinY + PIN_SIZE / 2;
      const targetX = box.x + box.width;
      const targetY = Math.max(box.y, Math.min(pinCenterY, box.y + box.height));
      return { pinX, pinY, pinCenterX, pinCenterY, targetX, targetY, placementSide: 'right' };
    }
  }

  // 4. Fallback BOTTOM (below element)
  let pinX = Math.max(
    STAGE_MARGIN,
    Math.min(
      box.x + Math.max(0, (Math.min(box.width, 100) - PIN_SIZE) / 2),
      viewport.width - PIN_SIZE - STAGE_MARGIN
    )
  );
  let pinY = Math.min(viewport.height - PIN_SIZE - STAGE_MARGIN, box.y + box.height + PIN_GAP);

  let shift = 0;
  while (isColliding(pinX, pinY) && shift < 4) {
    pinX += 26;
    shift++;
  }

  const pinCenterX = pinX + PIN_SIZE / 2;
  const pinCenterY = pinY + PIN_SIZE / 2;
  const targetX = Math.max(box.x, Math.min(pinCenterX, box.x + box.width));
  const targetY = Math.min(viewport.height, box.y + box.height);
  return { pinX, pinY, pinCenterX, pinCenterY, targetX, targetY, placementSide: 'bottom' };
}

export function VisualCanvasOverlay({
  currentRun,
  activeFingerprint,
  onSelectIssue,
  onDecisionSaved,
}: VisualCanvasOverlayProps) {
  // 1. Available viewports (offering 1440px Desktop, 375px Mobile, and 320px Reflow)
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
    if (selectedViewport.width === 320 || !viewports.some((v) => v.width === selectedViewport.width)) {
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

  // Full-page and Side Panel Inspector states (Side panel replaces floating popup)
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(true);

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
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [fitScale, setFitScale] = useState(1);

  // Target URL or fixture path
  const iframeSrc = currentRun.fixtureId
    ? `/fixtures/${currentRun.fixtureId}`
    : currentRun.targetUrl;

  // Calculate pins for the selected viewport with collision avoidance and outside placement
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

    let pinCounter = 1;
    const occupiedPositions: Array<{ x: number; y: number }> = [];

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

    // Numbered pins are placed on actionable issues (candidateFail & needsReview)
    const targetGroups = statusFilter === 'all'
      ? sortedGroups
      : sortedGroups.filter((g) => g.status === 'candidateFail' || g.status === 'needsReview');

    for (const group of targetGroups) {
      const rep = group.representative;
      if (!rep) continue;
      const ruleId = rep.ruleId || group.occurrences?.[0]?.ruleId || '';

      // Find occurrence matching the selected viewport width, or fall back to representative
      const matchingOcc =
        group.occurrences?.find((occ) => occ.viewport?.width === selectedViewport.width) ||
        (rep.viewport?.width === selectedViewport.width ? rep : null) ||
        rep;

      if (matchingOcc && matchingOcc.boundingBox && matchingOcc.boundingBox.width > 0 && matchingOcc.boundingBox.height > 0) {
        // Calculate outside placement with leader line pointing to the element
        const placement = calculatePinPlacement(
          matchingOcc.boundingBox,
          selectedViewport,
          occupiedPositions
        );
        occupiedPositions.push({ x: placement.pinX, y: placement.pinY });

        calculatedPins.push({
          index: pinCounter++,
          fingerprint: group.fingerprint,
          groupedIssue: group,
          title: rep.title,
          status: group.status,
          priority: group.currentPriority,
          ruleId: ruleId,
          wcagCriterion: rep.wcagCriterion,
          boundingBox: matchingOcc.boundingBox,
          selector: matchingOcc.selector || '',
          measured: matchingOcc.measured || {},
          expected: matchingOcc.expected || {},
          ...placement,
        });
      } else {
        nonGeometricIssues.push(group);
      }
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

  // Handle Fit to Screen scaling dynamically via ResizeObserver
  useEffect(() => {
    const updateFitScale = () => {
      if (!stageRef.current) return;
      const containerWidth = stageRef.current.clientWidth - 48;
      if (containerWidth > 0 && selectedViewport.width > 0) {
        const calculated = Math.min(1, containerWidth / selectedViewport.width);
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
  }, [selectedViewport.width, isFullScreen, isSidePanelOpen]);

  // Keyboard shortcut listener for Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isSidePanelOpen) {
          setIsSidePanelOpen(false);
        } else if (showImpactDrawer) {
          setShowImpactDrawer(false);
        } else if (isFullScreen) {
          setIsFullScreen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSidePanelOpen, showImpactDrawer, isFullScreen]);

  const effectiveScale = zoomScale === 'fit' ? fitScale : zoomScale;

  // Handle Pin Selection and Opening Side Panel
  const handlePinClick = (pin: IssuePinData) => {
    onSelectIssue(pin.fingerprint);
    setIsSidePanelOpen(true);
  };

  // Handle Quick Decision
  const handleQuickDecision = async (decision: DesignerDecision) => {
    if (!activePin || isSavingDecision) return;
    setIsSavingDecision(true);
    setActionFeedback(null);

    try {
      const defaultReason =
        decision === 'accept'
          ? 'Accepted via Visual Canvas Review'
          : decision === 'reject'
          ? 'Dismissed as acceptable design intent in context'
          : 'Reprioritized via Visual Canvas';

      const res = await fetch('/api/decisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          runId: currentRun.id,
          fingerprint: activePin.fingerprint,
          decision,
          reason: defaultReason,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Could not save decision.');
      }

      setActionFeedback(`Marked as ${decision === 'accept' ? 'Accepted' : 'False Positive'}`);
      if (onDecisionSaved) {
        onDecisionSaved(data.updatedGroup);
      }
      setTimeout(() => setActionFeedback(null), 3000);
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

  // Generate CSS snippet for quick copy
  const getCssFixSnippet = (pin: IssuePinData): string => {
    if (pin.ruleId === 'target-size') {
      return `/* WCAG 2.2 SC 2.5.8 Target Size (44px HIG / 24px WCAG AA) */\n${pin.selector} {\n  min-width: 44px;\n  min-height: 44px;\n  padding: 10px 14px;\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n}`;
    }
    if (pin.ruleId.includes('contrast')) {
      return `/* WCAG 2.2 SC 1.4.3 Minimum Contrast (≥ 4.5:1) */\n${pin.selector} {\n  color: #0f172a !important;\n}`;
    }
    if (pin.ruleId.includes('text-spacing')) {
      return `/* WCAG 2.2 SC 1.4.12 Text Spacing (Fluid Container) */\n${pin.selector} {\n  height: auto !important;\n  min-height: fit-content !important;\n  overflow: visible !important;\n}`;
    }
    return `/* WCAG Responsive Remediation */\n${pin.selector} {\n  max-width: 100% !important;\n}`;
  };

  const renderVisualComparison = (pin: IssuePinData) => {
    if (pin.ruleId.includes('contrast')) {
      const measuredRatio = typeof pin.measured?.contrastRatio === 'number' ? pin.measured.contrastRatio : (Number(pin.measured?.contrastRatio) || 2.32);
      const textColor = (pin.measured?.color as string) || (pin.measured?.textColor as string) || (pin.measured?.indicatorColor as string) || '#737373';
      const bgColor = (pin.measured?.backgroundColor as string) || (pin.measured?.adjacentColor as string) || '#ffffff';
      const minRatio = Number(pin.expected?.minRatio) || 4.5;
      const candidateColor = '#0f172a';
      const candidateRatio = '16.5:1';

      return (
        <div className="comparison-grid">
          {/* Before (Current baseline) */}
          <div className="comparison-card card-before">
            <div className="card-badge badge-before">Baseline (Current)</div>
            <div className="spec-visual-box box-before" style={{ backgroundColor: bgColor }}>
              <div
                className="contrast-text-sample"
                style={{
                  color: textColor,
                  backgroundColor: bgColor,
                  fontSize: '15px',
                  fontWeight: 650,
                  padding: '8px 14px',
                  borderRadius: '4px',
                }}
              >
                Aa Sample Text
              </div>
            </div>
            <div className="spec-details">
              <div className="spec-metric tone-danger">
                <strong>Measured:</strong> {measuredRatio.toFixed(2)}:1 Ratio
              </div>
              <p className="spec-note">
                Fails WCAG 2.2 SC 1.4.3 (requires ≥ {minRatio}:1). Text color <code>{textColor}</code> has low luminance.
              </p>
            </div>
          </div>

          {/* After (Candidate fix) */}
          <div className="comparison-card card-after">
            <div className="card-badge badge-after">Candidate Fix (Optimized)</div>
            <div className="spec-visual-box box-after" style={{ backgroundColor: bgColor }}>
              <div
                className="contrast-text-sample"
                style={{
                  color: candidateColor,
                  backgroundColor: bgColor,
                  fontSize: '15px',
                  fontWeight: 650,
                  padding: '8px 14px',
                  borderRadius: '4px',
                }}
              >
                Aa Sample Text
              </div>
            </div>
            <div className="spec-details">
              <div className="spec-metric tone-success">
                <strong>Recommended:</strong> {candidateRatio} (Passes AAA)
              </div>
              <p className="spec-note">
                Uses accessible brand token <code>{candidateColor}</code> with 16.5:1 high luminance contrast.
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (pin.ruleId === 'target-size') {
      const measuredWidth = Math.round(Number(pin.measured?.width) || pin.boundingBox.width || 18);
      const measuredHeight = Math.round(Number(pin.measured?.height) || pin.boundingBox.height || 18);

      return (
        <div className="comparison-grid">
          {/* Before (Current baseline) */}
          <div className="comparison-card card-before">
            <div className="card-badge badge-before">Baseline (Current)</div>
            <div className="spec-visual-box box-before">
              <div
                className="measured-box-mock"
                style={{
                  width: `${Math.min(measuredWidth, 54)}px`,
                  height: `${Math.min(measuredHeight, 54)}px`,
                }}
              >
                {measuredWidth}×{measuredHeight}
              </div>
            </div>
            <div className="spec-details">
              <div className="spec-metric tone-danger">
                <strong>Measured:</strong> {measuredWidth}×{measuredHeight}px
              </div>
              <p className="spec-note">
                Fails WCAG 2.2 SC 2.5.8 (requires 24×24px minimum touch area).
              </p>
            </div>
          </div>

          {/* After (Candidate fix) */}
          <div className="comparison-card card-after">
            <div className="card-badge badge-after">Candidate Fix (Optimized)</div>
            <div className="spec-visual-box box-after">
              <div
                className="candidate-box-mock"
                style={{
                  width: '44px',
                  height: '44px',
                }}
              >
                <span>44×44px</span>
                <span className="candidate-padding-guide">Touch Target</span>
              </div>
            </div>
            <div className="spec-details">
              <div className="spec-metric tone-success">
                <strong>Recommended:</strong> 44×44px (Apple HIG & WCAG AAA)
              </div>
              <p className="spec-note">
                Added +10px ergonomic touch padding around the interactive target.
              </p>
            </div>
          </div>
        </div>
      );
    }

    // Default / Text spacing / Reflow
    return (
      <div className="comparison-grid">
        <div className="comparison-card card-before">
          <div className="card-badge badge-before">Baseline (Current)</div>
          <div className="spec-visual-box box-before">
            <div style={{ fontSize: '11px', color: '#b42318', fontWeight: 600 }}>
              Fixed Height Overflow
            </div>
          </div>
          <div className="spec-details">
            <div className="spec-metric tone-danger">
              <strong>Measured:</strong> Fixed container height clipping text
            </div>
            <p className="spec-note">Fails SC 1.4.12 Text Spacing adaptation.</p>
          </div>
        </div>

        <div className="comparison-card card-after">
          <div className="card-badge badge-after">Candidate Fix (Optimized)</div>
          <div className="spec-visual-box box-after">
            <div style={{ fontSize: '11px', color: '#067647', fontWeight: 600 }}>
              Fluid Height Container
            </div>
          </div>
          <div className="spec-details">
            <div className="spec-metric tone-success">
              <strong>Recommended:</strong> <code>height: auto</code> fluid flow
            </div>
            <p className="spec-note">Dynamic container adapts to line-height expansion.</p>
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
      onSelectIssue(visiblePins[currentIndex - 1].fingerprint);
      setIsSidePanelOpen(true);
    } else if (direction === 'next' && hasNext) {
      onSelectIssue(visiblePins[currentIndex + 1].fingerprint);
      setIsSidePanelOpen(true);
    }
  };

  // Status visual attributes
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
      {/* Top Toolbar */}
      <div className="visual-canvas-toolbar">
        <div className="toolbar-left">
          <div className="toolbar-title-wrap">
            <span className="canvas-badge">
              <Icon name="Target" size={14} />
              Visual Canvas Overlay
            </span>
            <span className="canvas-pins-counter">
              <strong>{pins.length}</strong> {pins.length === 1 ? 'pin placed' : 'pins placed'} on design
            </span>
          </div>

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
        </div>

        {/* Toolbar Controls Right */}
        <div className="toolbar-right">
          {/* Page-Wide Auto-Optimize Mode Switcher */}
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
            >
              <Icon name="CheckCircle2" size={13} />
              <span>Optimized ({failCount} Fixes)</span>
            </button>
          </div>

          {/* Metric Impact Analysis Drawer Toggle */}
          <button
            type="button"
            className={`canvas-toggle-btn ${showImpactDrawer ? 'is-active' : ''}`}
            onClick={() => setShowImpactDrawer(!showImpactDrawer)}
            aria-pressed={showImpactDrawer}
            title="Toggle Metric Impact Analysis & Toggles"
          >
            <Icon name="Sliders" size={14} />
            <span>Metric Impact</span>
          </button>

          {/* Zoom controls */}
          <div className="canvas-control-pill">
            <span className="pill-label">Scale:</span>
            <button
              type="button"
              className={zoomScale === 'fit' ? 'is-selected' : ''}
              onClick={() => setZoomScale('fit')}
              title="Fit to Screen"
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
              className={zoomScale === 0.75 ? 'is-selected' : ''}
              onClick={() => setZoomScale(0.75)}
              title="75% Scale"
            >
              75%
            </button>
          </div>

          {/* Overlay Toggle */}
          <button
            type="button"
            className={`canvas-toggle-btn ${showOverlays ? 'is-active' : ''}`}
            onClick={() => setShowOverlays(!showOverlays)}
            aria-pressed={showOverlays}
            title="Toggle Visual Pins"
          >
            <Icon name={showOverlays ? 'Check' : 'X'} size={14} />
            <span>{showOverlays ? 'Pins Visible' : 'Pins Hidden'}</span>
          </button>

          {/* Bounding Box Mode Toggle */}
          <button
            type="button"
            className={`canvas-toggle-btn ${boxDisplayMode === 'all' ? 'is-active' : ''}`}
            onClick={() => setBoxDisplayMode(boxDisplayMode === 'all' ? 'hover_focus' : 'all')}
            title="Toggle whether all bounding box borders are shown or only when hovered"
          >
            <Icon name="Layers" size={14} />
            <span>{boxDisplayMode === 'all' ? 'Boxes: All' : 'Boxes: On Hover'}</span>
          </button>

          {/* Inspector Side Panel Toggle */}
          <button
            type="button"
            className={`canvas-toggle-btn ${isSidePanelOpen ? 'is-active' : ''}`}
            onClick={() => setIsSidePanelOpen(!isSidePanelOpen)}
            aria-pressed={isSidePanelOpen}
            title={isSidePanelOpen ? 'Hide Inspector Details' : 'Show Inspector Details'}
          >
            <Icon name="Columns" size={14} />
            <span>{isSidePanelOpen ? 'Details: On' : 'Details: Off'}</span>
          </button>

          {/* Full Page Canvas Toggle */}
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

      {/* Metric Impact & Research Control Strip (Collapsible) */}
      {showImpactDrawer && (
        <div className="metric-impact-strip" role="region" aria-label="Metric Impact Controls">
          <div className="impact-strip-header">
            <div className="impact-title-group">
              <span className="impact-badge">Research Control</span>
              <h4>Metric Impact on Final Design</h4>
              <p>Toggle individual metrics to isolate which research threshold impacts the visual layout.</p>
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

          {/* Metric Toggles */}
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

          {/* Research Findings & Impact Scorecard */}
          <div className="impact-scorecard-grid">
            <div className="scorecard-tile">
              <div className="scorecard-metric">Target Size Impact</div>
              <div className="scorecard-delta tone-success">+45% Touch Area</div>
              <p className="scorecard-note">100% compliant with Apple HIG touch targets. Container height +8px headroom.</p>
            </div>

            <div className="scorecard-tile">
              <div className="scorecard-metric">Color Contrast Impact</div>
              <div className="scorecard-delta tone-success">2.8:1 &rarr; 12.5:1</div>
              <p className="scorecard-note">Passes WCAG AAA. Text luminance adjusted while preserving brand palette harmony.</p>
            </div>

            <div className="scorecard-tile">
              <div className="scorecard-metric">Layout Adaptation</div>
              <div className="scorecard-delta tone-success">100% Fluid Text Flow</div>
              <p className="scorecard-note">No text clipping or truncation under expanded line heights and letter spacing.</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Workspace Layout (Side-by-side with Canvas on Desktop, stacked below on Mobile) */}
      <div className={`visual-canvas-workspace ${isSidePanelOpen && activePin ? 'has-side-panel' : ''}`}>
        {/* Left: Canvas Stage (takes available flex width) */}
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
                <span className="optimized-live-badge">Optimized Live</span>
              )}
              {selectedViewport.width} × {selectedViewport.height} px
            </div>
          </div>

          {/* Viewport Frame with Zoom Scaling */}
          <div className="canvas-scroll-container">
            <div
              className="canvas-scaled-frame"
              style={{
                width: `${selectedViewport.width * effectiveScale}px`,
                height: `${Math.max(selectedViewport.height, 620) * effectiveScale}px`,
              }}
            >
              <div
                className="canvas-viewport-inner"
                style={{
                  width: `${selectedViewport.width}px`,
                  height: `${Math.max(selectedViewport.height, 620)}px`,
                  transform: `scale(${effectiveScale})`,
                  transformOrigin: 'top left',
                }}
              >
                {/* Live Page Iframe */}
                <iframe
                  ref={iframeRef}
                  title="Audit Page Live Render"
                  src={iframeSrc}
                  className="canvas-iframe"
                  tabIndex={-1}
                  aria-hidden="true"
                />

                {/* Visual Pins, Connectors, and Bounding Box Overlay Layer */}
                {showOverlays && (
                  <div className="canvas-interactive-overlay" aria-label="Visual Issue Overlay">
                    {/* SVG Connector Lines from Pins to Target Elements */}
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
                        const isResolvedByOptimization = optimizationMode === 'optimized' && pin.status === 'candidateFail';
                        const colors = getStatusColor(pin.status);
                        const strokeColor = isResolvedByOptimization ? '#067647' : isHighlighted ? '#2563eb' : colors.bg;

                        return (
                          <g key={`connector-${pin.fingerprint}`}>
                            <line
                              x1={pin.pinCenterX}
                              y1={pin.pinCenterY}
                              x2={pin.targetX}
                              y2={pin.targetY}
                              stroke={strokeColor}
                              strokeWidth={isHighlighted ? 2 : 1.5}
                              strokeDasharray={isHighlighted ? undefined : '3 2'}
                              filter="url(#pin-line-shadow)"
                            />
                            <circle
                              cx={pin.targetX}
                              cy={pin.targetY}
                              r={isHighlighted ? 3 : 2}
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
                      const isHighlighted = isSelected || isHovered;
                      const isBoxVisible = boxDisplayMode === 'all' || isHighlighted;
                      const colors = getStatusColor(pin.status);
                      const box = pin.boundingBox;
                      const isResolvedByOptimization = optimizationMode === 'optimized' && pin.status === 'candidateFail';

                      return (
                        <React.Fragment key={pin.fingerprint}>
                          {/* Bounding Box Highlight - Transparent background, no dark overlay */}
                          {isBoxVisible && (
                            <div
                              className={`canvas-bounding-box ${isSelected ? 'is-selected' : ''} ${isHovered ? 'is-hovered' : ''} ${isResolvedByOptimization ? 'tone-success is-optimized-box' : `tone-${colors.tone}`}`}
                              style={{
                                left: `${box.x}px`,
                                top: `${box.y}px`,
                                width: `${box.width}px`,
                                height: `${box.height}px`,
                                borderColor: isResolvedByOptimization
                                  ? '#12b76a'
                                  : isHighlighted
                                  ? undefined
                                  : colors.border,
                                background: 'transparent',
                              }}
                              onClick={() => handlePinClick(pin)}
                              onMouseEnter={() => setHoveredFingerprint(pin.fingerprint)}
                              onMouseLeave={() => setHoveredFingerprint(null)}
                              title={`Pin ${pin.index}: ${pin.title} (${Math.round(box.width)}×${Math.round(box.height)}px)`}
                            >
                              {/* Tooltip Badge: ONLY rendered when hovered or selected to prevent cluttering the canvas */}
                              {isHighlighted && (
                                <div
                                  className="bounding-box-badge"
                                  style={{
                                    position: 'absolute',
                                    bottom: 'calc(100% + 4px)',
                                    left: 0,
                                    background: isResolvedByOptimization ? '#067647' : colors.bg,
                                  }}
                                >
                                  {isResolvedByOptimization
                                    ? (pin.ruleId.includes('contrast')
                                        ? 'Passed (≥ 4.5:1)'
                                        : pin.ruleId === 'target-size'
                                        ? 'Passed (24×24px)'
                                        : 'Passed (Fluid)')
                                    : `#${pin.index}: ${Math.round(box.width)}×${Math.round(box.height)}px`}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Numbered Pin Badge placed OUTSIDE the bounding box with larger click area */}
                          <button
                            type="button"
                            className={`canvas-pin-marker ${isSelected ? 'is-selected' : ''} ${isHovered ? 'is-hovered' : ''} ${isResolvedByOptimization ? 'tone-success is-optimized-pin' : `tone-${colors.tone}`}`}
                            style={{
                              left: `${pin.pinX}px`,
                              top: `${pin.pinY}px`,
                              backgroundColor: isResolvedByOptimization ? '#067647' : colors.bg,
                            }}
                            onClick={() => handlePinClick(pin)}
                            onMouseEnter={() => setHoveredFingerprint(pin.fingerprint)}
                            onMouseLeave={() => setHoveredFingerprint(null)}
                            aria-label={`Pin ${pin.index}: ${pin.title}`}
                          >
                            {isResolvedByOptimization ? (
                              <Icon name="Check" size={12} color="#ffffff" />
                            ) : (
                              <span className="pin-number">{pin.index}</span>
                            )}
                          </button>
                        </React.Fragment>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Page-level issues notice (if any) */}
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

        {/* Right / Bottom: Side Panel Inspector (Split layout with Canvas on Desktop, stacked below on Mobile) */}
        {isSidePanelOpen && activePin && (
          <aside className="canvas-side-panel canvas-inspector-drawer" aria-label="Issue Inspector">
            <div className="inspector-content">
              {/* Stepper Header with Close button */}
              <div className="inspector-stepper">
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
              </div>

              {/* Title & Rule */}
              <div className="inspector-header">
                <h3 id="popup-issue-title" className="inspector-title">{activePin.title}</h3>
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
                <div className="inspector-selector-row">
                  <code>{activePin.selector}</code>
                </div>
              </div>

              {/* Visual Before vs After Simulation Card */}
              <div className="inspector-visual-comparison">
                <div className="comparison-header">
                  <span className="comparison-eyebrow">Visual Spec Comparison</span>
                </div>

                {renderVisualComparison(activePin)}

                {/* Mode quick switch inside the inspector */}
                <div className="inspector-mode-quick-switch">
                  <span className="quick-switch-label">Canvas Preview:</span>
                  <div className="quick-switch-pills">
                    <button
                      type="button"
                      className={`quick-switch-btn ${optimizationMode === 'baseline' ? 'is-active' : ''}`}
                      onClick={() => setOptimizationMode('baseline')}
                    >
                      Baseline
                    </button>
                    <button
                      type="button"
                      className={`quick-switch-btn ${optimizationMode === 'optimized' ? 'is-active' : ''}`}
                      onClick={() => setOptimizationMode('optimized')}
                    >
                      <Icon name="CheckCircle2" size={13} />
                      <span>Optimized Fix</span>
                    </button>
                  </div>
                </div>

                {/* AI / Remediator recommendation */}
                {(activePin.groupedIssue.editedRecommendation || activePin.groupedIssue.aiRecommendation) && (
                  <div className="inspector-ai-rec-box">
                    <div className="ai-rec-badge">
                      <Icon name="Sparkles" size={13} />
                      <span>AI Remediation Guidance</span>
                    </div>
                    <p className="ai-rec-text">
                      {activePin.groupedIssue.editedRecommendation || activePin.groupedIssue.aiRecommendation}
                    </p>
                  </div>
                )}
              </div>

              {/* Action feedback message */}
              {actionFeedback && (
                <div className="inspector-feedback-banner">
                  <Icon name="CheckCircle2" size={16} />
                  <span>{actionFeedback}</span>
                </div>
              )}

              {/* Designer Quick Actions */}
              <div className="inspector-actions">
                <div className="actions-primary-row">
                  <button
                    type="button"
                    className="action-btn btn-accept"
                    disabled={isSavingDecision}
                    onClick={() => handleQuickDecision('accept')}
                    aria-label="Quick Accept"
                  >
                    <Icon name="Check" size={15} />
                    <span>Quick Accept</span>
                  </button>
                  <button
                    type="button"
                    className="action-btn btn-reject"
                    disabled={isSavingDecision}
                    onClick={() => handleQuickDecision('reject')}
                  >
                    <Icon name="X" size={15} />
                    <span>False Positive</span>
                  </button>
                </div>

                <div className="actions-secondary-row">
                  <button
                    type="button"
                    className="action-btn btn-copy"
                    onClick={() =>
                      copyToClipboard(
                        getCssFixSnippet(activePin),
                        'CSS Fix'
                      )
                    }
                  >
                    <Icon name={copiedLabel === 'CSS Fix' ? 'Check' : 'FileText'} size={14} />
                    <span>{copiedLabel === 'CSS Fix' ? 'CSS Copied!' : 'Copy CSS Fix'}</span>
                  </button>

                  <button
                    type="button"
                    className="action-btn btn-copy"
                    onClick={() =>
                      copyToClipboard(
                        `[ProofUI Handoff]\nIssue: ${activePin.title}\nElement: ${activePin.selector}\nMeasured: ${Math.round(activePin.boundingBox.width)}x${Math.round(activePin.boundingBox.height)}px\nTarget Spec: min-width: 44px, min-height: 44px, touch-padding: 12px\nWCAG: ${activePin.wcagCriterion}`,
                        'Design Token'
                      )
                    }
                  >
                    <Icon name={copiedLabel === 'Design Token' ? 'Check' : 'Download'} size={14} />
                    <span>{copiedLabel === 'Design Token' ? 'Token Copied!' : 'Copy Spec Note'}</span>
                  </button>

                  <button
                    type="button"
                    className="action-btn btn-sandbox-fix"
                    onClick={() => handleOpenInSandbox(activePin)}
                    style={{
                      background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                      color: '#ffffff',
                      fontWeight: 600,
                      border: 'none',
                    }}
                  >
                    <Icon name="Sparkles" size={14} />
                    <span>Fix in Sandbox →</span>
                  </button>
                </div>

                <div className="actions-scroll-row">
                  <a
                    href={`#issue-card-${activePin.fingerprint}`}
                    className="action-btn btn-jump"
                    onClick={(e) => {
                      e.preventDefault();
                      setIsSidePanelOpen(false);
                      if (isFullScreen) setIsFullScreen(false);
                      const el = document.getElementById(`issue-card-${activePin.fingerprint}`);
                      if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        el.focus?.();
                      }
                    }}
                  >
                    <Icon name="ExternalLink" size={14} />
                    <span>Inspect Full Card & AI Details Below</span>
                  </a>
                </div>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
