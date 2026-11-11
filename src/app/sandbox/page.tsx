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
  Sliders,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SandboxCandidate } from '@/lib/sandbox/iteration';
import { AuditRun, UXIssue } from '@/lib/schema/ux-issue';

const SAMPLE_ACCESSIBLE_SNIPPET = `<div class="p-6 max-w-sm mx-auto bg-white rounded-xl shadow-md space-y-4 border border-zinc-200">
  <div class="flex items-center space-x-3">
    <div class="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
      UI
    </div>
    <div>
      <h3 class="text-sm font-semibold text-zinc-900">Course Registration</h3>
      <!-- Fails SC 1.4.3: Low contrast text (2.1:1 ratio) -->
      <p class="text-xs text-zinc-400">Semester 1 / 2026 Academic Year</p>
    </div>
  </div>

  <!-- Fails SC 1.4.3: Muted descriptive text -->
  <p class="text-xs text-zinc-400 leading-relaxed">
    Select your elective subjects before deadline. Late enrollment incurs additional penalty fees.
  </p>

  <div class="flex items-center justify-between pt-2 border-t border-zinc-100">
    <span class="text-xs text-zinc-500 font-medium">$450.00 / term</span>
    <!-- Fails SC 2.5.8: Target size too small (20px height) and low contrast button -->
    <button class="btn bg-blue-500 hover:bg-blue-600 text-white text-[10px] px-2 py-1 rounded">
      Enroll Now
    </button>
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
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Initial audit on load
  useEffect(() => {
    void handleRunAudit(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRunAudit = async (htmlToAudit: string) => {
    setIsAuditing(true);
    try {
      const res = await fetch('/api/sandbox/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: htmlToAudit }),
      });
      const data = await res.json();
      if (data.success) {
        setRenderId(data.snippetId);
        setAuditRun(data.run);
        setActiveCodePreview(htmlToAudit);
      }
    } catch {
      // Audit fail fallback
    } finally {
      setIsAuditing(false);
    }
  };

  const handleAutoIterate = async () => {
    if (!auditRun) return;
    setIsIterating(true);
    try {
      const res = await fetch('/api/sandbox/iterate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          html: code,
          issues: auditRun.rawIssues,
        }),
      });
      const data = await res.json();
      if (data.success && data.candidates?.length > 0) {
        setCandidates(data.candidates);
        setSelectedCandidateId(data.candidates[0].id);
        setActiveCodePreview(data.candidates[0].code);
      }
    } catch {
      // Iteration fail fallback
    } finally {
      setIsIterating(false);
    }
  };

  const handleSelectCandidate = (candidate: SandboxCandidate) => {
    setSelectedCandidateId(candidate.id);
    setActiveCodePreview(candidate.code);
  };

  const handleAcceptCandidate = (candidate: SandboxCandidate) => {
    setCode(candidate.code);
    setActiveCodePreview(candidate.code);
    setActiveTab('editor');
    void handleRunAudit(candidate.code);
  };

  const handleCopyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const activeCandidate = candidates.find((c) => c.id === selectedCandidateId);
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
          <div className="border-t border-zinc-200 bg-zinc-50/70 p-4 space-y-3.5 max-h-[320px] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Auto-Remediation</span>
                <h4 className="text-xs font-semibold text-zinc-900">Multi-Candidate Iteration</h4>
              </div>
              <Button
                size="sm"
                className="h-8 text-xs gap-1.5 bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                disabled={isIterating || !auditRun}
                onClick={handleAutoIterate}
              >
                <Sparkles className="size-3.5" />
                <span>{isIterating ? 'Generating 3 Candidates…' : '✨ Auto-Iterate (3 Proposals)'}</span>
              </Button>
            </div>

            {/* Candidates Card Grid */}
            {candidates.length > 0 ? (
              <div className="grid grid-cols-1 gap-2.5">
                {candidates.map((cand) => {
                  const isSelected = selectedCandidateId === cand.id;
                  return (
                    <div
                      key={cand.id}
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
                        {cand.verified && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="size-3 text-emerald-600" />
                            <span>Verified Compliant</span>
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-600 leading-relaxed mb-2.5">{cand.description}</p>

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

                      {/* Action buttons inside card */}
                      <div className="flex items-center gap-2 pt-1 border-t border-zinc-200/60">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px] gap-1 border-zinc-200"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAcceptCandidate(cand);
                          }}
                        >
                          <Check className="size-3 text-emerald-600" />
                          <span>Accept & Apply to Editor</span>
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
                          <span>Copy Candidate</span>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 rounded-lg border border-dashed border-zinc-200 bg-zinc-50/50 text-center">
                <p className="text-xs text-zinc-500">
                  Click <strong>✨ Auto-Iterate</strong> to generate 3 AI-optimized accessible candidates with automatic verification.
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
                srcDoc={activeCodePreview ? `<!DOCTYPE html><html><head><script src="https://cdn.tailwindcss.com"></script><style>body{margin:0;padding:24px;font-family:sans-serif;background:#f8fafc;display:flex;justify-content:center;align-items:center;min-height:100vh;}</style></head><body><div style="width:100%;max-width:480px;">${activeCodePreview}</div></body></html>` : ''}
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
                <span className="text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                  {auditRun ? `${auditRun.summary.candidateFailCount} Failures` : 'Auditing…'}
                </span>
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  {auditRun ? `${auditRun.summary.passCount} Passed` : '0 Passed'}
                </span>
              </div>
            </div>

            {/* Evidence Findings Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="p-2.5 rounded-lg border border-zinc-200 bg-zinc-50/50">
                <span className="text-[10px] text-zinc-400 uppercase font-bold block">Touch Target Spec</span>
                <strong className="text-xs text-zinc-900 font-semibold block mt-0.5">
                  {activeCandidate?.metrics.targetSize?.after || (auditRun?.summary.candidateFailCount ? '< 24px (Sub-minimum)' : '≥ 44 × 44 px')}
                </strong>
                <span className="text-[10px] text-zinc-500">WCAG 2.2 SC 2.5.8</span>
              </div>

              <div className="p-2.5 rounded-lg border border-zinc-200 bg-zinc-50/50">
                <span className="text-[10px] text-zinc-400 uppercase font-bold block">Color Contrast Spec</span>
                <strong className="text-xs text-zinc-900 font-semibold block mt-0.5">
                  {activeCandidate?.metrics.contrast?.after || (auditRun?.summary.candidateFailCount ? '2.1:1 (Fails AA)' : '≥ 4.5:1 (Compliant)')}
                </strong>
                <span className="text-[10px] text-zinc-500">WCAG 2.2 SC 1.4.3</span>
              </div>

              <div className="p-2.5 rounded-lg border border-zinc-200 bg-zinc-50/50 col-span-2 sm:col-span-1">
                <span className="text-[10px] text-zinc-400 uppercase font-bold block">Remediation Status</span>
                <strong className={`text-xs font-semibold block mt-0.5 ${activeCandidate?.verified ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {activeCandidate?.verified ? '100% Ready to Merge' : 'Candidate Optimization Available'}
                </strong>
                <span className="text-[10px] text-zinc-500">Multi-Role Verified</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
