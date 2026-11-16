'use client';

import React, { useEffect, useRef, useState } from 'react';
import { FIXTURES, PILOT_UI_FIXTURES, FixtureDefinition } from '@/fixtures/fixture-registry';
import { buildSandboxedDocument } from '@/lib/sandbox/document';
import { Icon } from './Icon';
import { ProductContextFields } from './ProductContextFields';
import { ProductContext, ProductContextSchema, EMPTY_PRODUCT_CONTEXT } from '@/lib/schema/product-context';

interface AuditInputProps {
  onRunAudit: (
    target: string,
    productContext?: ProductContext,
    autoDetectContext?: boolean,
    htmlSnippet?: string
  ) => Promise<void>;
  onTargetChange?: (target: string) => void;
  onValidationStateChange?: (hasError: boolean) => void;
  isLoading: boolean;
  currentFixtureId?: string;
  currentContext?: ProductContext;
  error?: string | null;
}

const PRIVATE_HOST_PATTERN = /^(localhost|127(?:\.\d{1,3}){3}|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|169\.254(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}|\[?::1\]?)$/i;

function validatePublicUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return 'Enter a public HTTP or HTTPS URL.';
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return 'Enter a complete URL, for example https://example.com.';
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) return 'Only HTTP and HTTPS URLs can be audited.';
  if (PRIVATE_HOST_PATTERN.test(parsed.hostname)) {
    return 'Private, internal, localhost, and metadata targets are blocked. Use Sample UI or Upload Code instead.';
  }
  return null;
}

const DEFAULT_SAMPLE_HTML = `<div class="p-6 max-w-md mx-auto bg-white rounded-xl border border-slate-200 shadow-sm space-y-4 font-sans">
  <div class="space-y-1">
    <h2 class="text-xl font-bold text-slate-900">Account Notification</h2>
    <p class="text-sm text-slate-400">Please review your security preferences before proceeding.</p>
  </div>
  <div class="space-y-2">
    <label for="sample-email" class="text-xs font-semibold text-slate-700">Notification Email</label>
    <input id="sample-email" type="email" value="alex@example.com" class="w-full h-10 px-3 border border-slate-300 rounded-md text-sm text-slate-800" />
  </div>
  <div class="flex items-center gap-3 pt-2">
    <button type="button" class="h-10 px-4 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700">Confirm Changes</button>
    <button type="button" class="h-6 px-2 text-xs text-slate-400 hover:text-slate-600">Skip for now</button>
  </div>
</div>`;

const CATEGORY_COLORS: Record<FixtureDefinition['category'], { badge: string; border: string }> = {
  contrast: { badge: 'bg-blue-50 text-blue-700 border-blue-200', border: 'border-blue-500' },
  'target-size': { badge: 'bg-amber-50 text-amber-700 border-amber-200', border: 'border-amber-500' },
  reflow: { badge: 'bg-purple-50 text-purple-700 border-purple-200', border: 'border-purple-500' },
  'text-spacing': { badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', border: 'border-emerald-500' },
};

export function AuditInput({
  onRunAudit,
  onTargetChange,
  onValidationStateChange,
  isLoading,
  error,
  currentFixtureId,
  currentContext,
}: AuditInputProps) {
  const [productContext, setProductContext] = useState<ProductContext>(EMPTY_PRODUCT_CONTEXT);
  const [contextMode, setContextMode] = useState<'auto' | 'manual'>('manual');
  const [activeTab, setActiveTab] = useState<'sample' | 'url' | 'code'>('sample');

  // Sample UI state
  const [selectedFixture, setSelectedFixture] = useState('pilot-ui-01');

  // Website URL state
  const [customUrl, setCustomUrl] = useState('');

  // Code paste / upload state
  const [codeSnippet, setCodeSnippet] = useState(DEFAULT_SAMPLE_HTML);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [showCodePreview, setShowCodePreview] = useState(false);

  const [clientError, setClientError] = useState<string | null>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const codeTextareaRef = useRef<HTMLTextAreaElement>(null);

  const displayedError = clientError || error || null;

  // Developer fixtures
  const devFixtures = FIXTURES.filter((f) => !f.id.startsWith('pilot-ui-'));
  const activeFixtureDef = FIXTURES.find((f) => f.id === selectedFixture) || PILOT_UI_FIXTURES[0];

  useEffect(() => {
    if (currentContext) {
      setProductContext(currentContext);
      if (Object.values(currentContext).some(Boolean)) {
        setContextMode('manual');
      }
    }
  }, [currentContext]);

  useEffect(() => {
    if (currentFixtureId && FIXTURES.some((f) => f.id === currentFixtureId)) {
      setSelectedFixture(currentFixtureId);
      setActiveTab('sample');
    }
  }, [currentFixtureId]);

  useEffect(() => {
    if (activeTab === 'sample') {
      onTargetChange?.(`fixture://${selectedFixture}`);
    } else if (activeTab === 'url') {
      onTargetChange?.(customUrl.trim());
    } else {
      onTargetChange?.('HTML / CSS Component');
    }
  }, [activeTab, customUrl, onTargetChange, selectedFixture]);

  useEffect(() => {
    const handleHash = () => {
      if (typeof window !== 'undefined' && window.location.hash === '#local-fixtures') {
        setActiveTab('sample');
        setClientError(null);
        onValidationStateChange?.(false);
      }
    };
    const handleSelectFixture = () => selectMode('sample');
    const handleSelectCustom = () => selectMode('url');

    handleHash();
    window.addEventListener('hashchange', handleHash);
    window.addEventListener('proofui:select-fixture-tab', handleSelectFixture);
    window.addEventListener('proofui:select-custom-tab', handleSelectCustom);
    return () => {
      window.removeEventListener('hashchange', handleHash);
      window.removeEventListener('proofui:select-fixture-tab', handleSelectFixture);
      window.removeEventListener('proofui:select-custom-tab', handleSelectCustom);
    };
  }, [onValidationStateChange]);

  const selectMode = (mode: 'sample' | 'url' | 'code') => {
    setActiveTab(mode);
    setClientError(null);
    onValidationStateChange?.(false);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.html') && !file.name.toLowerCase().endsWith('.htm')) {
      setClientError('Please select a .html file.');
      onValidationStateChange?.(true);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result;
      if (typeof content === 'string') {
        setCodeSnippet(content);
        setUploadedFileName(`${file.name} (${Math.round(file.size / 1024 * 10) / 10} KB)`);
        setClientError(null);
        onValidationStateChange?.(false);
      }
    };
    reader.onerror = () => {
      setClientError('Failed to read file contents.');
      onValidationStateChange?.(true);
    };
    reader.readAsText(file);
  };

  const handleClearCode = () => {
    setCodeSnippet('');
    setUploadedFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    codeTextareaRef.current?.focus();
  };

  const handleLoadSample = () => {
    setCodeSnippet(DEFAULT_SAMPLE_HTML);
    setUploadedFileName(null);
    setClientError(null);
    onValidationStateChange?.(false);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isLoading) return;

    if (activeTab === 'url') {
      const validationError = validatePublicUrl(customUrl);
      if (validationError) {
        setClientError(validationError);
        onValidationStateChange?.(true);
        requestAnimationFrame(() => urlInputRef.current?.focus());
        return;
      }
    } else if (activeTab === 'code') {
      if (!codeSnippet.trim()) {
        setClientError('Enter or upload an HTML snippet to audit.');
        onValidationStateChange?.(true);
        requestAnimationFrame(() => codeTextareaRef.current?.focus());
        return;
      }
      if (!/<[a-z][\s\S]*>/i.test(codeSnippet)) {
        setClientError('The snippet must contain valid HTML markup tags.');
        onValidationStateChange?.(true);
        requestAnimationFrame(() => codeTextareaRef.current?.focus());
        return;
      }
    }

    const parsedContext = ProductContextSchema.safeParse(productContext);
    if (contextMode === 'manual' && !parsedContext.success) {
      setClientError(parsedContext.error.issues[0].message);
      onValidationStateChange?.(true);
      return;
    }

    setClientError(null);
    onValidationStateChange?.(false);

    if (activeTab === 'sample') {
      await onRunAudit(
        selectedFixture,
        contextMode === 'manual' ? (parsedContext.success ? parsedContext.data : undefined) : undefined,
        contextMode === 'auto'
      );
    } else if (activeTab === 'url') {
      await onRunAudit(
        customUrl.trim(),
        contextMode === 'manual' ? (parsedContext.success ? parsedContext.data : undefined) : undefined,
        contextMode === 'auto'
      );
    } else {
      // Code audit
      await onRunAudit(
        'snippet://active',
        contextMode === 'manual' ? (parsedContext.success ? parsedContext.data : undefined) : undefined,
        false,
        codeSnippet.trim()
      );
    }
  };

  return (
    <section
      id="audit-input"
      className="audit-input-panel rounded-xl border border-zinc-200/90 bg-white p-5 sm:p-6 shadow-xs space-y-5 scroll-mt-20"
      aria-labelledby="audit-input-title"
    >
      <div id="local-fixtures" className="scroll-mt-24" />

      {/* Header */}
      <div className="section-heading-row flex items-start justify-between gap-4 pb-1">
        <div>
          <p className="eyebrow text-[10px] font-semibold uppercase tracking-wider text-zinc-500">New audit</p>
          <h2 id="audit-input-title" className="text-lg font-bold tracking-tight text-zinc-900">
            Choose what to review
          </h2>
        </div>
      </div>

      {/* Segmented Control - 3 Tabs */}
      <div
        className="segmented-control grid grid-cols-1 sm:grid-cols-3 gap-1 rounded-lg bg-zinc-100 p-1"
        role="tablist"
        aria-label="Audit target type"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'sample'}
          aria-controls="sample-panel"
          id="sample-tab"
          onClick={() => selectMode('sample')}
          className={`flex items-center justify-center gap-1.5 rounded-md py-2 px-3 text-xs font-medium transition-all ${
            activeTab === 'sample'
              ? 'bg-white text-zinc-950 shadow-xs font-semibold'
              : 'text-zinc-600 hover:text-zinc-900'
          }`}
        >
          <Icon name="Layers" size={14} />
          <span>Sample UI</span>
          <span className="text-[10px] bg-blue-100 text-blue-700 font-medium px-1.5 py-0.5 rounded ml-1">
            Pilot Baseline
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'url'}
          aria-controls="url-panel"
          id="url-tab"
          onClick={() => selectMode('url')}
          className={`flex items-center justify-center gap-1.5 rounded-md py-2 px-3 text-xs font-medium transition-all ${
            activeTab === 'url'
              ? 'bg-white text-zinc-950 shadow-xs font-semibold'
              : 'text-zinc-600 hover:text-zinc-900'
          }`}
        >
          <Icon name="Globe" size={14} />
          <span>Website URL</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'code'}
          aria-controls="code-panel"
          id="code-tab"
          onClick={() => selectMode('code')}
          className={`flex items-center justify-center gap-1.5 rounded-md py-2 px-3 text-xs font-medium transition-all ${
            activeTab === 'code'
              ? 'bg-white text-zinc-950 shadow-xs font-semibold'
              : 'text-zinc-600 hover:text-zinc-900'
          }`}
        >
          <Icon name="Upload" size={14} />
          <span>Paste / Upload HTML + CSS</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {/* TAB 1: SAMPLE UI */}
        {activeTab === 'sample' && (
          <div id="sample-panel" role="tabpanel" aria-labelledby="sample-tab" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <label className="text-xs font-semibold text-zinc-800 block">
                  Select a Benchmark Pilot Interface (UI-01 – UI-12)
                </label>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Controlled real-world interfaces designed for research reproducibility.
                </p>
              </div>
              <span className="text-[11px] text-zinc-500 font-mono">12 standardized cases</span>
            </div>

            {/* Grid of UI-01 to UI-12 cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
              {PILOT_UI_FIXTURES.map((fixture) => {
                const isSelected = selectedFixture === fixture.id;
                const colors = CATEGORY_COLORS[fixture.category];
                return (
                  <button
                    key={fixture.id}
                    type="button"
                    onClick={() => setSelectedFixture(fixture.id)}
                    className={`flex flex-col items-start text-left p-2.5 rounded-lg border text-xs transition-all relative ${
                      isSelected
                        ? `bg-blue-50/40 border-blue-600 ring-1 ring-blue-600 shadow-xs`
                        : `bg-zinc-50/50 border-zinc-200 hover:bg-white hover:border-zinc-300 text-zinc-700`
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="font-bold text-zinc-900">{fixture.name.split(':')[0]}</span>
                      <span className={`text-[9px] uppercase px-1 py-0.2 rounded font-semibold border ${colors.badge}`}>
                        {fixture.category}
                      </span>
                    </div>
                    <span className="text-[11px] font-medium text-zinc-800 line-clamp-1">
                      {fixture.name.split(':')[1]?.trim() || fixture.name}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Selected UI Preview Card */}
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3.5 space-y-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-zinc-900">{activeFixtureDef.name}</span>
                    <span
                      className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${
                        CATEGORY_COLORS[activeFixtureDef.category].badge
                      }`}
                    >
                      {activeFixtureDef.category.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-600 leading-relaxed">{activeFixtureDef.description}</p>
                </div>
              </div>

              {/* Rendered Live Preview Frame */}
              <div className="border border-zinc-200 rounded-md overflow-hidden bg-white shadow-xs">
                <div className="bg-zinc-100 px-3 py-1 border-b border-zinc-200 text-[10px] text-zinc-500 flex items-center justify-between font-mono">
                  <span>Rendered UI preview</span>
                  <span>{activeFixtureDef.path}</span>
                </div>
                <iframe
                  src={activeFixtureDef.path}
                  title={`Preview of ${activeFixtureDef.name}`}
                  sandbox="allow-scripts"
                  className="w-full h-36 border-none"
                />
              </div>
            </div>

            {/* Developer & Benchmark Suites (Pass/Fail Debug) */}
            <details open className="group rounded-lg border border-zinc-200 bg-zinc-50/60 p-3 text-xs">
              <summary className="flex items-center justify-between font-medium text-zinc-700 cursor-pointer select-none">
                <div className="flex items-center gap-2">
                  <Icon name="FlaskConical" size={14} className="text-zinc-500" />
                  <span>Developer & Benchmark Suites (Pass/Fail Debug)</span>
                </div>
                <Icon name="ChevronDown" size={14} className="text-zinc-400 group-open:rotate-180 transition-transform" />
              </summary>
              <div className="mt-3 pt-3 border-t border-zinc-200 space-y-2">
                <p className="text-[11px] text-zinc-500">
                  Isolated pass/fail assertion cases for algorithm verification and engine regression tests.
                </p>
                <select
                  id="fixture-select"
                  value={selectedFixture}
                  onChange={(e) => setSelectedFixture(e.target.value)}
                  disabled={isLoading}
                  className="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 text-zinc-900"
                >
                  <optgroup label="Developer Regression Suites">
                    {devFixtures.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} — {f.description}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
            </details>
          </div>
        )}

        {/* TAB 2: WEBSITE URL */}
        {activeTab === 'url' && (
          <div id="url-panel" role="tabpanel" aria-labelledby="url-tab" className="field-group space-y-2">
            <label htmlFor="custom-url-input" className="text-xs font-semibold text-zinc-800 block">
              Public rendered page URL
            </label>
            <p id="url-help" className="field-help text-xs text-zinc-500 leading-relaxed">
              HTTP and HTTPS only. Authentication, localhost, private networks, and cloud metadata endpoints are blocked.
            </p>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                <Icon name="Globe" size={15} />
              </div>
              <input
                ref={urlInputRef}
                id="custom-url-input"
                name="auditUrl"
                type="url"
                inputMode="url"
                autoComplete="url"
                value={customUrl}
                onChange={(event) => {
                  setCustomUrl(event.target.value);
                  if (clientError) {
                    setClientError(null);
                    onValidationStateChange?.(false);
                  }
                }}
                placeholder="https://example.com"
                disabled={isLoading}
                aria-invalid={displayedError ? 'true' : 'false'}
                aria-describedby={`url-help${displayedError ? ' audit-target-error' : ''}`}
                className="flex h-10 w-full rounded-md border border-zinc-200 bg-zinc-50/50 pl-9 pr-3 py-1 text-xs shadow-xs placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 focus:bg-white text-zinc-900 transition-colors font-mono"
              />
            </div>
          </div>
        )}

        {/* TAB 3: PASTE / UPLOAD HTML + CSS */}
        {activeTab === 'code' && (
          <div id="code-panel" role="tabpanel" aria-labelledby="code-tab" className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <label htmlFor="code-textarea" className="text-xs font-semibold text-zinc-800 block">
                  Paste or Upload HTML + CSS
                </label>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Renders the HTML in a headless browser to measure real computed styles, contrast, and geometry.
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".html,.htm"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="html-file-upload"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-zinc-200 bg-zinc-50 text-[11px] font-medium text-zinc-700 hover:bg-zinc-100 transition-colors"
                >
                  <Icon name="Upload" size={13} />
                  <span>Upload .html</span>
                </button>
                <button
                  type="button"
                  onClick={handleLoadSample}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-zinc-200 bg-zinc-50 text-[11px] font-medium text-zinc-700 hover:bg-zinc-100 transition-colors"
                >
                  <Icon name="RefreshCw" size={12} />
                  <span>Load sample</span>
                </button>
                {codeSnippet && (
                  <button
                    type="button"
                    onClick={handleClearCode}
                    className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-medium text-zinc-500 hover:text-zinc-800 transition-colors"
                  >
                    <Icon name="X" size={13} />
                    <span>Clear</span>
                  </button>
                )}
              </div>
            </div>

            {uploadedFileName && (
              <div className="flex items-center justify-between bg-blue-50/60 border border-blue-200 text-blue-800 px-3 py-1.5 rounded-md text-xs">
                <div className="flex items-center gap-2">
                  <Icon name="FileCode" size={14} className="text-blue-600" />
                  <span>Loaded file: <strong>{uploadedFileName}</strong></span>
                </div>
                <button
                  type="button"
                  onClick={handleClearCode}
                  className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                >
                  Remove
                </button>
              </div>
            )}

            {/* Code Textarea */}
            <div className="relative">
              <textarea
                ref={codeTextareaRef}
                id="code-textarea"
                value={codeSnippet}
                onChange={(e) => {
                  setCodeSnippet(e.target.value);
                  if (clientError) {
                    setClientError(null);
                    onValidationStateChange?.(false);
                  }
                }}
                disabled={isLoading}
                rows={7}
                placeholder="<!-- Paste HTML with inline CSS or <style> tags here -->"
                className="w-full font-mono text-xs rounded-md border border-zinc-200 bg-zinc-50/50 p-3 shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 focus:bg-white text-zinc-900 leading-relaxed resize-y transition-colors"
              />
              <div className="flex items-center justify-between text-[10px] text-zinc-400 mt-1 px-1">
                <span>Supports standard HTML5 and Tailwind CSS utility classes</span>
                <span>{codeSnippet.length} characters · {codeSnippet.split('\n').length} lines</span>
              </div>
            </div>

            {/* Preview toggle */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowCodePreview(!showCodePreview)}
                className="inline-flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-900 font-medium"
              >
                <Icon name="Eye" size={14} />
                <span>{showCodePreview ? 'Hide live preview' : 'Show live rendered preview'}</span>
              </button>

              {showCodePreview && (
                <div className="mt-2 border border-zinc-200 rounded-md overflow-hidden bg-white shadow-xs">
                  <div className="bg-zinc-100 px-3 py-1 border-b border-zinc-200 text-[10px] text-zinc-500 font-mono">
                    Sandboxed component render (isolated origin)
                  </div>
                  <iframe
                    srcDoc={buildSandboxedDocument(codeSnippet)}
                    title="Code snippet live preview"
                    sandbox="allow-scripts"
                    className="w-full h-44 border-none"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Product Context Fields */}
        <ProductContextFields
          value={productContext}
          onChange={setProductContext}
          disabled={isLoading}
          targetUrl={
            activeTab === 'sample'
              ? `fixture://${selectedFixture}`
              : activeTab === 'url'
              ? customUrl.trim() || undefined
              : 'snippet://active'
          }
          contextMode={contextMode}
          onContextModeChange={setContextMode}
        />

        {/* Actions Bar */}
        <div className="form-action-row flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-zinc-100">
          <div className="form-message-slot min-h-[24px]">
            {displayedError && (
              <div
                id="audit-target-error"
                className="inline-error flex items-center gap-1.5 text-xs text-rose-600 bg-rose-50 border border-rose-200 px-2.5 py-1.5 rounded-md"
                role="alert"
              >
                <Icon name="AlertTriangle" size={15} />
                <span>{displayedError}</span>
              </div>
            )}
          </div>
          <button
            type="submit"
            id="run-audit-button"
            className="primary-button inline-flex items-center justify-center gap-2 rounded-md bg-zinc-900 px-5 h-9 text-xs font-medium text-white shadow-xs hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 disabled:opacity-50 transition-colors"
            disabled={isLoading}
            aria-describedby="audit-duration"
          >
            <Icon
              name={isLoading ? 'LoaderCircle' : 'Play'}
              size={15}
              className={isLoading ? 'animate-spin' : ''}
            />
            <span>
              {isLoading
                ? 'Audit in progress'
                : activeTab === 'sample'
                ? `Run audit on ${activeFixtureDef.name.split(':')[0]}`
                : activeTab === 'url'
                ? 'Run audit on website'
                : 'Run audit on HTML component'}
            </span>
          </button>
        </div>
        <span id="audit-duration" className="sr-only">
          An audit usually takes ten to thirty seconds.
        </span>
      </form>
    </section>
  );
}
