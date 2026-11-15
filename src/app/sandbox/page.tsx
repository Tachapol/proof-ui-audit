'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Sparkles,
  Play,
  Check,
  Copy,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  Maximize2,
  Code2,
  FileCode,
  Layers,
  CheckCircle2,
  XCircle,
  Sliders,
  ExternalLink,
  Download,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { SandboxCandidate, IterationConstraint } from '@/lib/sandbox/types';
import { cherryPickTargetSizeFix, cherryPickContrastFix } from '@/lib/sandbox/cherry-pick';
import { buildSandboxedDocument } from '@/lib/sandbox/document';
import type { AuditRun, UXIssue } from '@/lib/schema/ux-issue';

function formatMeasuredValue(ruleId: string, m?: Record<string, unknown>): string {
  if (!m) return 'Unable to verify';
  if (ruleId === 'target-size' && typeof m.width === 'number' && Number.isFinite(m.width) && typeof m.height === 'number' && Number.isFinite(m.height)) {
    return `${m.width} × ${m.height} CSS px`;
  }
  if (ruleId === 'text-contrast' && typeof m.contrastRatio === 'number' && Number.isFinite(m.contrastRatio)) {
    return `${m.contrastRatio}:1`;
  }
  const keys = Object.keys(m);
  if (keys.length === 0) return 'Unable to verify';
  return JSON.stringify(m);
}

function renderCandidateStatusBadge(cand: SandboxCandidate) {
  if (cand.verificationStatus === 'verified') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full" title="Verified for selected automated checks (WCAG 2.5.8 & 1.4.3)">
        <CheckCircle2 className="size-3 text-emerald-600" />
        <span>Selected checks passed</span>
      </span>
    );
  }
  if (cand.verificationStatus === 'unable_to_verify') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full" title="Unable to verify: Re-audit failed, elements missing, or human review required">
        <AlertTriangle className="size-3 text-amber-600" />
        <span>Unable to verify</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full" title="Checks failed">
      <XCircle className="size-3 text-rose-600" />
      <span>Checks failed</span>
    </span>
  );
}

const SAMPLE_ACCESSIBLE_SNIPPET = `<div class="p-6 max-w-sm mx-auto bg-white rounded-xl shadow-md space-y-4 border border-zinc-200">
  <div class="flex items-center space-x-3">
    <div class="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
      UI
    </div>
    <div>
      <h3 id="course-title" class="text-sm font-semibold text-zinc-900">Course Registration</h3>
      <!-- Fails SC 1.4.3: Low contrast text (2.56:1 ratio) -->
      <p id="course-semester" class="text-xs text-zinc-400">Semester 1 / 2026 Academic Year</p>
    </div>
  </div>

  <!-- Fails SC 1.4.3: Muted descriptive text -->
  <p id="course-desc" class="text-xs text-zinc-400 leading-relaxed">
    Select your elective subjects before deadline. Late enrollment incurs additional penalty fees.
  </p>

  <div class="flex items-center gap-1.5 pt-2 border-t border-zinc-100">
    <!-- Fails SC 2.5.8: Target size too small (18px) with adjacent interactive button -->
    <button id="cancel-btn" class="btn text-xs text-zinc-500 font-medium" style="width:18px;height:18px;padding:0;">✕</button>
    <button id="enroll-btn" class="btn bg-blue-700 hover:bg-blue-800 text-white text-[10px]" style="width:18px;height:18px;padding:0;">✓</button>
  </div>
</div>`;

export default function SandboxPage() {
  const [code, setCode] = useState(SAMPLE_ACCESSIBLE_SNIPPET);
  const [activeTab, setActiveTab] = useState<'editor' | 'diff'>('editor');
  const [selectedViewport, setSelectedViewport] = useState<{ width: number; height: number }>({ width: 1440, height: 900 });
  const [renderId, setRenderId] = useState<string | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [isIterating, setIsIterating] = useState(false);
  const [auditRun, setAuditRun] = useState<AuditRun | null>(null);
  const [candidates, setCandidates] = useState<SandboxCandidate[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeCodePreview, setActiveCodePreview] = useState<string>(SAMPLE_ACCESSIBLE_SNIPPET);
  const [selectedConstraints, setSelectedConstraints] = useState<IterationConstraint[]>([]);
  const [customDirective, setCustomDirective] = useState('');
  const [showDirectivesPanel, setShowDirectivesPanel] = useState(false);
  const [recordingDecision, setRecordingDecision] = useState(false);
  const [decisionFeedback, setDecisionFeedback] = useState<string | null>(null);
  const [sandboxError, setSandboxError] = useState<string | null>(null);
  const [isStaleResult, setIsStaleResult] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const selectionAbortControllerRef = useRef<AbortController | null>(null);
  const selectionSeqRef = useRef<number>(0);

  // Initial audit on load: restore prior run if runId in URL, or check if sent from Visual Canvas / Studio
  useEffect(() => {
    let initialCode = code;
    try {
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const urlRunId = urlParams.get('runId');
        if (urlRunId) {
          void (async () => {
            try {
              setIsAuditing(true);
              const res = await fetch(`/api/audit?id=${encodeURIComponent(urlRunId)}`);
              const data = await res.json();
              if (data.success && data.run) {
                const run = data.run;
                setAuditRun(run);
                if (run.candidates?.length) {
                  setCandidates(run.candidates);
                  const selectedId = run.groupedIssues[0]?.iterationComparison?.candidateId;
                  const active = run.candidates.find((c: any) => c.id === selectedId) || run.candidates[0];
                  if (active) {
                    setSelectedCandidateId(active.id);
                    setActiveCodePreview(active.code);
                    setCode(active.code);
                  }
                }
                setIsAuditing(false);
                return;
              }
            } catch {
              // fallback to fresh audit
            } finally {
              setIsAuditing(false);
            }
          })();
          return;
        }
      }

      const stored = sessionStorage.getItem('proofui_sandbox_init');
      if (stored) {
        sessionStorage.removeItem('proofui_sandbox_init');
        const parsed = JSON.parse(stored);
        if (parsed.code && typeof parsed.code === 'string') {
          initialCode = parsed.code;
          setCode(parsed.code);
          setActiveCodePreview(parsed.code);
        }
      }
    } catch {
      // Fallback to default
    }

    void handleRunAudit(initialCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRunAudit = async (
    htmlToAudit: string,
    options?: { priorRunId?: string; acceptedCandidate?: SandboxCandidate }
  ) => {
    setIsAuditing(true);
    setSandboxError(null);
    try {
      const res = await fetch('/api/sandbox/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          html: htmlToAudit,
          priorRunId: options?.priorRunId,
          acceptedCandidate: options?.acceptedCandidate
            ? {
                id: options.acceptedCandidate.id,
                name: options.acceptedCandidate.name,
                code: options.acceptedCandidate.code,
              }
            : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Audit execution failed.');
      }
      setRenderId(data.snippetId);
      setAuditRun(data.run);
      setActiveCodePreview(htmlToAudit);
      setIsStaleResult(false);
      if (typeof window !== 'undefined' && data.run?.id) {
        const url = new URL(window.location.href);
        url.searchParams.set('runId', data.run.id);
        window.history.replaceState(null, '', url.toString());
      }
    } catch (err) {
      setSandboxError(err instanceof Error ? err.message : 'Audit failed.');
      setIsStaleResult(true);
    } finally {
      setIsAuditing(false);
    }
  };

  const toggleConstraint = (c: IterationConstraint) => {
    setSelectedConstraints((prev) =>
      prev.includes(c) ? prev.filter((item) => item !== c) : [...prev, c]
    );
  };

  const handleAutoIterate = async (overrideConstraints?: IterationConstraint[]) => {
    if (!auditRun) return;
    setIsIterating(true);
    setSandboxError(null);
    try {
      const res = await fetch('/api/sandbox/iterate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          html: code,
          issues: auditRun.rawIssues,
          runId: auditRun.id,
          constraints: overrideConstraints || (selectedConstraints.length ? selectedConstraints : undefined),
          customDirective: customDirective.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success || !data.candidates?.length) {
        throw new Error(data.error || 'Candidate iteration failed to generate fixes.');
      }
      setCandidates(data.candidates);
      setSelectedCandidateId(data.candidates[0].id);
      setActiveCodePreview(data.candidates[0].code);
      setIsStaleResult(false);
    } catch (err) {
      setSandboxError(err instanceof Error ? err.message : 'Iteration failed.');
      setIsStaleResult(true);
    } finally {
      setIsIterating(false);
    }
  };

  const handleDiscardCandidates = () => {
    setCandidates([]);
    setSelectedCandidateId(null);
    setActiveCodePreview(code);
    setActiveTab('editor');
  };

  const handleCherryPick = (type: 'target-size' | 'contrast', cand?: SandboxCandidate) => {
    const newCode = type === 'target-size' ? cherryPickTargetSizeFix(code) : cherryPickContrastFix(code);
    setCode(newCode);
    setActiveCodePreview(newCode);
    setActiveTab('editor');
    void handleRunAudit(newCode);
  };

  const handleRecordAcceptedRisk = async () => {
    if (!auditRun || !auditRun.groupedIssues?.length) return;
    setRecordingDecision(true);
    try {
      let count = 0;
      for (const group of auditRun.groupedIssues) {
        await fetch('/api/decisions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            runId: auditRun.id,
            fingerprint: group.fingerprint,
            disposition: 'Accepted Risk',
            reason: 'Auto-generated candidate fixes failed verification or caused visual regressions; baseline maintained under design exemption.',
            reviewer: 'Designer (Sandbox Fallback)',
          }),
        });
        count++;
      }
      setDecisionFeedback(`✓ บันทึกเป็น Accepted Risk เรียบร้อยแล้ว (${count} รายการ)`);
      setTimeout(() => setDecisionFeedback(null), 5000);
    } catch {
      setDecisionFeedback('เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setRecordingDecision(false);
    }
  };

  const handleSelectCandidate = async (candidate: SandboxCandidate) => {
    setSelectedCandidateId(candidate.id);
    setActiveCodePreview(candidate.code);
    if (auditRun) {
      if (selectionAbortControllerRef.current) {
        selectionAbortControllerRef.current.abort();
      }
      const controller = new AbortController();
      selectionAbortControllerRef.current = controller;
      const currentSeq = ++selectionSeqRef.current;
      const selectionTimestamp = Date.now();

      try {
        const res = await fetch('/api/sandbox/iterate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            action: 'selectCandidate',
            runId: auditRun.id,
            candidateId: candidate.id,
            selectionTimestamp,
          }),
        });
        const data = await res.json();
        if (currentSeq === selectionSeqRef.current && data.success && data.run && !data.stale) {
          setAuditRun(data.run);
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        // Non-fatal
      }
    }
  };

  const handleAcceptCandidate = (candidate: SandboxCandidate) => {
    setCode(candidate.code);
    setActiveCodePreview(candidate.code);
    setActiveTab('editor');
    void handleRunAudit(candidate.code, {
      priorRunId: auditRun?.id,
      acceptedCandidate: candidate,
    });
  };

  const handleCopyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const activeCandidate = candidates.find((c) => c.id === selectedCandidateId);
  const allCandidatesSuboptimal = candidates.length > 0 && candidates.every((c) => c.verificationStatus !== 'verified');
  const iframeSrc = renderId ? `/api/sandbox/render?id=${renderId}` : '';

  // Simple unified diff computation
  const computeDiffLines = (original: string, updated: string) => {
    const origLines = original.split('\n');
    const newLines = updated.split('\n');
    const lines: Array<{ type: 'same' | 'added' | 'removed'; text: string }> = [];

    const max = Math.max(origLines.length, newLines.length);
    for (let i = 0; i < max; i++) {
      const o = origLines[i];
      const n = newLines[i];
      if (o === n) {
        if (o !== undefined) lines.push({ type: 'same', text: o });
      } else {
        if (o !== undefined) lines.push({ type: 'removed', text: o });
        if (n !== undefined) lines.push({ type: 'added', text: n });
      }
    }
    return lines;
  };

  return (
    <div className="min-h-screen bg-zinc-50/50 text-zinc-900 font-sans antialiased flex flex-col">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-40 flex h-14 w-full items-center justify-between border-b border-zinc-200/80 bg-white/95 px-4 sm:px-6 backdrop-blur">
        <div className="flex items-center gap-2.5">
          <Link
            className="inline-flex items-center gap-2.5 font-semibold text-zinc-900 text-sm tracking-tight hover:opacity-85 transition min-h-0"
            href="/"
            title="ProofUI Home"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-900 text-xs font-bold text-white shadow-sm">
              P
            </span>
            <span>ProofUI</span>
          </Link>

          <div className="hidden md:flex items-center gap-1.5 text-xs text-zinc-400">
            <ChevronRight className="size-3.5 shrink-0 text-zinc-400" />
            <Link
              href="/"
              className="inline-flex items-center h-auto min-h-0 py-0.5 px-1.5 rounded text-xs text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
            >
              Audit workspace
            </Link>
            <ChevronRight className="size-3.5 shrink-0 text-zinc-400" />
            <span className="inline-flex items-center h-auto min-h-0 py-0.5 px-1.5 font-medium text-zinc-900">
              Component Sandbox
            </span>
            <Badge variant="outline" className="ml-1 text-[10px] bg-blue-50 text-blue-700 border-blue-200 py-0 px-1.5 font-normal">
              Live Iteration
            </Badge>
          </div>
        </div>

        <nav className="flex items-center gap-2 sm:gap-3">
          {auditRun && (
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 border-zinc-200 text-zinc-700 hover:bg-zinc-100"
                asChild
              >
                <a
                  href={`/api/export?runId=${auditRun.id}&format=json`}
                  download={`proofui-sandbox-${auditRun.id}.json`}
                >
                  <Download className="size-3.5" />
                  <span>JSON Report</span>
                </a>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 border-zinc-200 text-zinc-700 hover:bg-zinc-100"
                asChild
              >
                <a
                  href={`/api/export?runId=${auditRun.id}&format=markdown`}
                  download={`proofui-sandbox-${auditRun.id}.md`}
                >
                  <FileText className="size-3.5" />
                  <span>Markdown Report</span>
                </a>
              </Button>
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5 border-zinc-200 hover:bg-zinc-100 text-zinc-700"
            onClick={() => {
              setCode(SAMPLE_ACCESSIBLE_SNIPPET);
              void handleRunAudit(SAMPLE_ACCESSIBLE_SNIPPET);
            }}
          >
            <RotateCcw className="size-3.5" />
            <span>Reset Sample</span>
          </Button>

          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-zinc-200 text-zinc-700 hover:bg-zinc-100 transition" asChild>
            <Link href="/">
              <ArrowLeft className="size-3.5" />
              <span>Back to Audit</span>
            </Link>
          </Button>
        </nav>
      </header>

      {/* Error / Stale Warning Alert */}
      {sandboxError && (
        <div className="bg-rose-50 border-b border-rose-200 px-4 py-2.5 text-xs text-rose-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-rose-600 shrink-0" />
            <span>
              <strong>Error:</strong> {sandboxError}
              {isStaleResult && <span className="ml-1 text-rose-700">(ผลการวัดที่แสดงอยู่เป็นผลเดิมที่อาจล้าสมัย กรุณาลองใหม่อีกครั้ง)</span>}
            </span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-[11px] px-2 text-rose-700 hover:bg-rose-100"
            onClick={() => setSandboxError(null)}
          >
            ปิด
          </Button>
        </div>
      )}

      {/* Main Dual-Pane Sandbox Layout */}
      <div className="flex-1 flex flex-col xl:flex-row h-auto xl:h-[calc(100vh-56px)] overflow-hidden divide-y xl:divide-y-0 xl:divide-x divide-zinc-200">
        
        {/* LEFT PANE: Code Editor & Auto-Iteration Proposals */}
        <div className="w-full xl:w-[48%] flex flex-col bg-white overflow-hidden">
          {/* Subheader / Tabs */}
          <div className="flex items-center justify-between p-3.5 border-b border-zinc-200 bg-zinc-50/50">
            <div className="flex items-center gap-1.5 bg-zinc-200/60 p-0.5 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('editor')}
                className={`px-3 py-1 rounded-md font-medium transition-all ${
                  activeTab === 'editor' ? 'bg-white text-zinc-900 shadow-xs font-semibold' : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Code2 className="size-3.5" />
                  <span>Component Code</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('diff')}
                disabled={!activeCandidate}
                className={`px-3 py-1 rounded-md font-medium transition-all ${
                  activeTab === 'diff' ? 'bg-white text-zinc-900 shadow-xs font-semibold' : 'text-zinc-600 hover:text-zinc-900'
                } ${!activeCandidate ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <span className="flex items-center gap-1.5">
                  <Sliders className="size-3.5" />
                  <span>Code Diff {activeCandidate ? `(${activeCandidate.name.split(':')[0]})` : ''}</span>
                </span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 border-zinc-200"
                onClick={() => handleCopyCode(code)}
              >
                {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs gap-1.5 bg-zinc-900 text-white hover:bg-zinc-800"
                disabled={isAuditing}
                onClick={() => handleRunAudit(code)}
              >
                <Play className="size-3.5 fill-current" />
                <span>{isAuditing ? 'Auditing…' : 'Run Audit'}</span>
              </Button>
            </div>
          </div>

          {/* Code Editor Area or Diff Area */}
          <div className="flex-1 flex flex-col min-h-[300px] xl:min-h-0 overflow-hidden">
            {activeTab === 'editor' ? (
              <div className="flex-1 relative flex flex-col">
                <textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Paste your HTML + Tailwind CSS component code here..."
                  spellCheck={false}
                  className="w-full flex-1 p-4 font-mono text-xs text-zinc-800 bg-zinc-900/5 resize-none focus:outline-none focus:ring-1 focus:ring-zinc-900 border-0 leading-relaxed"
                />
              </div>
            ) : (
              <div className="flex-1 overflow-auto p-4 font-mono text-xs bg-zinc-900 text-zinc-100 leading-relaxed">
                {activeCandidate ? (
                  <div className="space-y-0.5">
                    {computeDiffLines(code, activeCandidate.code).map((line, idx) => (
                      <div
                        key={idx}
                        className={`px-2 py-0.5 rounded-xs flex gap-2 ${
                          line.type === 'added'
                            ? 'bg-emerald-950/80 text-emerald-300 font-semibold'
                            : line.type === 'removed'
                            ? 'bg-rose-950/80 text-rose-300 line-through opacity-75'
                            : 'text-zinc-400'
                        }`}
                      >
                        <span className="w-5 shrink-0 text-right opacity-40 select-none">
                          {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                        </span>
                        <span className="whitespace-pre-wrap">{line.text || ' '}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center text-zinc-500">
                    No active iteration candidate selected. Run Auto-Iterate to see code diff.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Auto-Iteration Control & Multi-Candidate Selector Drawer */}
          <div className="border-t border-zinc-200 bg-zinc-50/70 p-4 space-y-3.5 max-h-[360px] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Auto-Remediation</span>
                <h4 className="text-xs font-semibold text-zinc-900">Multi-Candidate Iteration</h4>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className={`h-8 text-xs gap-1 border-zinc-300 ${showDirectivesPanel ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-700'}`}
                  onClick={() => setShowDirectivesPanel((prev) => !prev)}
                  title="Configure constraints for candidate generation"
                >
                  <Sliders className="size-3.5 text-zinc-600" />
                  <span>Constraints</span>
                  {selectedConstraints.length > 0 && (
                    <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-blue-600 text-white font-semibold">
                      {selectedConstraints.length}
                    </span>
                  )}
                </Button>

                <Button
                  size="sm"
                  className="h-8 text-xs gap-1.5 bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                  disabled={isIterating || !auditRun}
                  onClick={() => void handleAutoIterate()}
                >
                  <Sparkles className="size-3.5" />
                  <span>{isIterating ? 'Generating 3 Candidates…' : '✨ Auto-Iterate (3 Proposals)'}</span>
                </Button>
              </div>
            </div>

            {/* Custom Directives & Constraints Configuration Panel */}
            {showDirectivesPanel && (
              <div className="p-3 rounded-lg bg-zinc-100/90 border border-zinc-200 space-y-2.5 text-xs text-zinc-800">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[11px] text-zinc-900">กำหนดเงื่อนไข / Fix Constraints:</span>
                  <span className="text-[10px] text-zinc-500">เลือกข้อจำกัดเพื่อปรับทิศทางของ Candidate</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => toggleConstraint('preserve_colors')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                      selectedConstraints.includes('preserve_colors')
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-zinc-700 border-zinc-200 hover:border-zinc-300'
                    }`}
                  >
                    🎨 คงสีเดิม (Preserve Brand Colors)
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleConstraint('target_size_only')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                      selectedConstraints.includes('target_size_only')
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-zinc-700 border-zinc-200 hover:border-zinc-300'
                    }`}
                  >
                    👆 ปรับเฉพาะขนาดปุ่ม (Target Size Only)
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleConstraint('contrast_only')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                      selectedConstraints.includes('contrast_only')
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-zinc-700 border-zinc-200 hover:border-zinc-300'
                    }`}
                  >
                    🔤 ปรับเฉพาะ Contrast (Contrast Only)
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleConstraint('minimal_invasive')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                      selectedConstraints.includes('minimal_invasive')
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-zinc-700 border-zinc-200 hover:border-zinc-300'
                    }`}
                  >
                    ⚡ ปรับให้น้อยที่สุด (Minimal Invasive)
                  </button>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={customDirective}
                    onChange={(e) => setCustomDirective(e.target.value)}
                    placeholder="คำสั่งเฉพาะเจาะจง เช่น 'ห้ามเปลี่ยนขนาดกล่อง', 'ใช้ padding ด้านข้างแทน'..."
                    className="flex-1 px-2.5 py-1 text-xs rounded border border-zinc-200 bg-white placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <Button
                    size="sm"
                    className="h-7 text-[11px] bg-zinc-900 text-white hover:bg-zinc-800"
                    disabled={isIterating || !auditRun}
                    onClick={() => void handleAutoIterate()}
                  >
                    🔄 ลองใหม่ตามเงื่อนไข
                  </Button>
                </div>
              </div>
            )}

            {/* Suboptimal Candidates Fallback Alert & Recovery Panel */}
            {allCandidatesSuboptimal && (
              <div
                data-testid="suboptimal-candidates-banner"
                className="p-3.5 rounded-lg bg-amber-50/90 border border-amber-300 text-amber-950 space-y-3 shadow-xs"
              >
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1 text-xs">
                    <strong className="font-semibold block text-amber-900 mb-0.5">
                      ทางเลือกอัตโนมัติทั้ง 3 แบบยังไม่ผ่านเกณฑ์สมบูรณ์ / All Candidates Suboptimal
                    </strong>
                    <p className="text-amber-800 leading-relaxed text-[11px]">
                      ระบบตรวจพบว่าทุกทางเลือกติดสถานะ <span className="font-semibold">Failed</span> หรือ <span className="font-semibold">Unable to verify</span> (อาจเกิดปัญหาใหม่ หรือไม่พบค่าวัดผลจริง) แนะนำให้ใช้ตัวเลือกด้านล่าง:
                    </p>
                  </div>
                </div>

                {/* Fallback Action Buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-amber-200">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px] bg-white border-amber-300 hover:bg-amber-100/70 text-amber-900 gap-1"
                    onClick={handleDiscardCandidates}
                  >
                    <RotateCcw className="size-3 text-amber-700" />
                    <span>ยกเลิกทั้งหมด & ใช้ Baseline (Discard All)</span>
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px] bg-white border-amber-300 hover:bg-amber-100/70 text-amber-900 gap-1"
                    onClick={() => {
                      setActiveTab('editor');
                      const textarea = document.querySelector('textarea');
                      textarea?.focus();
                    }}
                  >
                    <Code2 className="size-3 text-amber-700" />
                    <span>ปรับโค้ดเองใน Editor (Manual Tuning)</span>
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    disabled={recordingDecision}
                    className="h-7 text-[11px] bg-white border-amber-300 hover:bg-amber-100/70 text-amber-900 gap-1"
                    onClick={() => void handleRecordAcceptedRisk()}
                  >
                    <ShieldCheck className="size-3 text-amber-700" />
                    <span>{recordingDecision ? 'กำลังบันทึก...' : 'บันทึกเป็น Accepted Risk'}</span>
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-[11px] text-amber-900 hover:bg-amber-100/60 gap-1"
                    onClick={() => setShowDirectivesPanel((prev) => !prev)}
                  >
                    <Sliders className="size-3 text-amber-700" />
                    <span>{showDirectivesPanel ? 'ซ่อนการตั้งเงื่อนไข' : '✨ กำหนดเงื่อนไขแล้วลองใหม่'}</span>
                  </Button>
                </div>

                {decisionFeedback && (
                  <div className="p-2 rounded bg-amber-100 border border-amber-300 text-[11px] text-amber-950 font-medium">
                    {decisionFeedback}
                  </div>
                )}
              </div>
            )}

            {/* Candidates Card Grid */}
            {candidates.length > 0 ? (
              <div className="grid grid-cols-1 gap-2.5">
                {candidates.map((cand) => {
                  const isSelected = selectedCandidateId === cand.id;
                  return (
                    <div
                      key={cand.id}
                      data-testid={`candidate-card-${cand.id}`}
                      data-candidate-id={cand.id}
                      onClick={() => handleSelectCandidate(cand)}
                      className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/40 ring-1 ring-blue-600 shadow-xs'
                          : 'border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50/50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <strong className="text-xs font-semibold text-zinc-900">{cand.name}</strong>
                          <span className="text-[10px] font-medium bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded">
                            {cand.badge}
                          </span>
                        </div>
                        {renderCandidateStatusBadge(cand)}
                      </div>
                      <p className="text-[11px] text-zinc-600 leading-relaxed mb-2">{cand.description}</p>

                      {/* Explicit Verification Errors / Unable to verify reasons */}
                      {cand.verificationErrors && cand.verificationErrors.length > 0 && (
                        <div className="my-2 p-2 rounded-md bg-amber-50 border border-amber-200/80 text-[11px] text-amber-900 space-y-1">
                          <div className="flex items-center gap-1.5 font-semibold text-amber-800">
                            <AlertTriangle className="size-3.5 text-amber-600 shrink-0" />
                            <span>ตรวจสอบไม่ได้ / Verification Incomplete:</span>
                          </div>
                          <ul className="list-disc list-inside space-y-0.5 pl-1 text-[10.5px] text-amber-800/90">
                            {cand.verificationErrors.map((err, i) => (
                              <li key={i}>{err}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Verification Checklist */}
                      <div className="space-y-1 mb-3 pt-2 border-t border-zinc-200/60">
                        {cand.checks.map((chk) => (
                          <div key={chk.id} className="flex items-center gap-1.5 text-[10px]">
                            <span className={chk.passed ? 'text-emerald-600 font-bold' : 'text-amber-600'}>
                              {chk.passed ? '✓' : '⚠️'}
                            </span>
                            <span className="text-zinc-700">{chk.deltaText}</span>
                          </div>
                        ))}
                      </div>

                      {/* Measured Evidence Breakdown */}
                      {cand.measurements && cand.measurements.length > 0 && (
                        <details className="mb-2 text-[11px] text-zinc-700" onClick={(e) => e.stopPropagation()}>
                          <summary className="cursor-pointer font-semibold text-zinc-800 hover:text-zinc-950 flex items-center justify-between">
                            <span>Measured Evidence ({cand.measurements.length} {cand.measurements.length === 1 ? 'element' : 'elements'})</span>
                            <span className="text-[10px] font-normal text-zinc-500">
                              {cand.measurements.filter(m => m.status === 'pass').length} passed / {cand.measurements.filter(m => m.status === 'unable_to_verify').length} unverified
                            </span>
                          </summary>
                          <div className="mt-2 space-y-1.5">
                            {cand.measurements.map((m, idx) => (
                              <div key={idx} className="p-2 rounded bg-zinc-50 border border-zinc-200/70 text-[10.5px] space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-mono font-medium text-zinc-900 truncate max-w-[200px]" title={m.selector}>
                                    {m.selector}
                                  </span>
                                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-semibold ${
                                    m.status === 'pass'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : m.status === 'unable_to_verify'
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-rose-100 text-rose-800'
                                  }`}>
                                    {m.status === 'pass' ? '✓ Pass' : m.status === 'unable_to_verify' ? '⚠️ Unable to verify' : '✗ Fail'}
                                  </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-zinc-600 text-[10px]">
                                  <div>
                                    <span className="text-zinc-400 block text-[9px] uppercase">Before</span>
                                    <span className="font-mono">{formatMeasuredValue(m.ruleId, m.before)}</span>
                                  </div>
                                  <div>
                                    <span className="text-zinc-400 block text-[9px] uppercase">After (Candidate)</span>
                                    <span className="font-mono">{formatMeasuredValue(m.ruleId, m.after)}</span>
                                  </div>
                                </div>
                                <div className="text-[9.5px] text-zinc-500 flex items-center justify-between pt-1 border-t border-zinc-200/40">
                                  <span>Rule: {m.ruleId}</span>
                                  <span>Viewport: {m.viewport.width} × {m.viewport.height}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}

                      {cand.regression && (
                        <details className="mb-3 text-[11px] text-zinc-700" onClick={e => e.stopPropagation()}>
                          <summary className="cursor-pointer font-semibold">Regression evidence: {cand.regression.status.replaceAll('_', ' ')}</summary>
                          <p className="my-2 text-zinc-500">{cand.regression.scope}</p>
                          {cand.regression.findings.map(finding => {
                            const issue = finding.after || finding.before!;
                            return (
                              <div key={finding.key} className="border-t border-zinc-200 py-2 break-words">
                                <strong>{finding.change}: {issue.ruleId}</strong>
                                <p>{issue.selector} · {issue.viewport.width} × {issue.viewport.height}</p>
                                <p>{finding.reason}</p>
                                <p>Before: {finding.before?.status || 'Not measured'} → After: {finding.after?.status || 'Not measured'}</p>
                                <p>Before measurements: {JSON.stringify(finding.before?.measured || {})}</p>
                                <p>After measurements: {JSON.stringify(finding.after?.measured || {})}</p>
                              </div>
                            );
                          })}
                        </details>
                      )}

                      {/* Action buttons inside card */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-zinc-200/60">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px] gap-1 border-zinc-200 bg-white hover:bg-zinc-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAcceptCandidate(cand);
                          }}
                        >
                          <Check className="size-3 text-emerald-600" />
                          <span>Accept & Apply Full Code</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-[10.5px] text-zinc-600 hover:text-zinc-900 border border-zinc-200/60 bg-white"
                          title="Apply only target-size padding and min-dimensions without changing colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCherryPick('target-size', cand);
                          }}
                        >
                          <span>👆 Target Size Only</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-[10.5px] text-zinc-600 hover:text-zinc-900 border border-zinc-200/60 bg-white"
                          title="Apply only text contrast improvements without modifying sizes or layout"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCherryPick('contrast', cand);
                          }}
                        >
                          <span>🔤 Contrast Only</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-[11px] text-zinc-600 hover:text-zinc-900"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyCode(cand.code);
                          }}
                        >
                          <Copy className="size-3" />
                          <span>Copy</span>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 rounded-lg border border-dashed border-zinc-200 bg-zinc-50/50 text-center">
                <p className="text-xs text-zinc-500">
                  Click <strong>✨ Auto-Iterate</strong> to generate 3 template-based candidates and inspect their automated audit results.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANE: Live Sandboxed Canvas & Audit Proof Scorecard */}
        <div className="w-full xl:w-[52%] flex flex-col bg-zinc-100/70 overflow-hidden">
          {/* Mock Browser Shell Bar */}
          <div className="flex items-center justify-between p-3 border-b border-zinc-200 bg-white">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-100 text-[11px] text-zinc-600 font-mono">
                <ShieldCheck className="size-3 text-emerald-600" />
                <span>sandbox://component-preview</span>
              </div>
            </div>

            {/* Viewport Frame Pills: Desktop 1440px Default */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setSelectedViewport({ width: 1440, height: 900 })}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                  selectedViewport.width === 1440 ? 'bg-zinc-900 text-white font-semibold' : 'text-zinc-600 hover:text-zinc-900 bg-zinc-100'
                }`}
              >
                1440px Desktop
              </button>
              <button
                type="button"
                onClick={() => setSelectedViewport({ width: 375, height: 667 })}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                  selectedViewport.width === 375 ? 'bg-zinc-900 text-white font-semibold' : 'text-zinc-600 hover:text-zinc-900 bg-zinc-100'
                }`}
              >
                375px Mobile
              </button>
            </div>
          </div>

          {/* Iframe Viewport Display */}
          <div className="flex-1 p-6 overflow-auto flex items-center justify-center">
            <div
              className="bg-white rounded-xl shadow-md border border-zinc-200 overflow-hidden transition-all"
              style={{
                width: selectedViewport.width === 1440 ? '100%' : '375px',
                maxWidth: '100%',
                height: '480px',
              }}
            >
              <iframe
                ref={iframeRef}
                title="Component Sandbox Preview"
                sandbox="allow-scripts"
                srcDoc={activeCodePreview ? buildSandboxedDocument(activeCodePreview) : ''}
                className="w-full h-full border-0"
              />
            </div>
          </div>

          {/* Live Proof Verification Scorecard Footer */}
          <div className="p-4 border-t border-zinc-200 bg-white space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-emerald-600" />
                <span>Deterministic Evidence & Verification</span>
              </span>
              <div className="flex items-center gap-2">
                {activeCandidate ? (
                  <>
                    <span className="text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                      {activeCandidate.summary.candidateFailCount} Failures
                    </span>
                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                      {activeCandidate.summary.passCount} Passed
                    </span>
                    {activeCandidate.summary.needsReviewCount > 0 && (
                      <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                        {activeCandidate.summary.needsReviewCount} Needs Review
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <span className="text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                      {auditRun ? `${auditRun.summary.candidateFailCount} Failures` : 'Auditing…'}
                    </span>
                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                      {auditRun ? `${auditRun.summary.passCount} Passed` : '0 Passed'}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Active Candidate Verification Warning Banner if unable_to_verify */}
            {activeCandidate?.verificationStatus === 'unable_to_verify' && activeCandidate.verificationErrors.length > 0 && (
              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-[11px] space-y-0.5">
                  <span className="font-semibold block">ตรวจสอบไม่ได้ (Verification Incomplete):</span>
                  <span>{activeCandidate.verificationErrors.join(' · ')}</span>
                </div>
              </div>
            )}

            {/* Evidence Findings Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="p-2.5 rounded-lg border border-zinc-200 bg-zinc-50/50">
                <span className="text-[10px] text-zinc-400 uppercase font-bold block">Touch Target Spec</span>
                <strong className="text-xs text-zinc-900 font-semibold block mt-0.5">
                  {activeCandidate?.metrics.targetSize?.after || 'Not measured'}
                </strong>
                <span className="text-[10px] text-zinc-500">WCAG 2.2 SC 2.5.8</span>
              </div>

              <div className="p-2.5 rounded-lg border border-zinc-200 bg-zinc-50/50">
                <span className="text-[10px] text-zinc-400 uppercase font-bold block">Color Contrast Spec</span>
                <strong className="text-xs text-zinc-900 font-semibold block mt-0.5">
                  {activeCandidate?.metrics.contrast?.after || 'Not measured'}
                </strong>
                <span className="text-[10px] text-zinc-500">WCAG 2.2 SC 1.4.3</span>
              </div>

              <div className="p-2.5 rounded-lg border border-zinc-200 bg-zinc-50/50 col-span-2 sm:col-span-1">
                <span className="text-[10px] text-zinc-400 uppercase font-bold block">Remediation Status</span>
                <strong data-testid="remediation-status-value" className={`text-xs font-semibold block mt-0.5 ${
                  activeCandidate?.verificationStatus === 'verified'
                    ? 'text-emerald-700'
                    : activeCandidate?.verificationStatus === 'unable_to_verify'
                    ? 'text-amber-700'
                    : activeCandidate
                    ? 'text-rose-700'
                    : 'text-zinc-600'
                }`}>
                  {activeCandidate?.verificationStatus === 'verified'
                    ? 'Selected checks passed'
                    : activeCandidate?.verificationStatus === 'unable_to_verify'
                    ? 'Unable to verify'
                    : activeCandidate
                    ? 'Checks failed'
                    : 'Not evaluated'}
                </strong>
                <span className="text-[10px] text-zinc-500">
                  {activeCandidate?.verified
                    ? 'WCAG 2.5.8 & 1.4.3 only; visual/design review required'
                    : 'Automated scope only; designer review required'}
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

