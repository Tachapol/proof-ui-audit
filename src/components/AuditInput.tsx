'use client';

import React, { useEffect, useRef, useState } from 'react';
import { FIXTURES } from '@/fixtures/fixture-registry';
import { Icon } from './Icon';
import { ProductContextFields } from './ProductContextFields';
import { ProductContext, ProductContextSchema, EMPTY_PRODUCT_CONTEXT } from '@/lib/schema/product-context';

interface AuditInputProps {
  onRunAudit: (target: string, productContext?: ProductContext, autoDetectContext?: boolean) => Promise<void>;
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
  try { parsed = new URL(trimmed); } catch { return 'Enter a complete URL, for example https://example.com.'; }
  if (!['http:', 'https:'].includes(parsed.protocol)) return 'Only HTTP and HTTPS URLs can be audited.';
  if (PRIVATE_HOST_PATTERN.test(parsed.hostname)) return 'Private, internal, localhost, and metadata targets are blocked. Use a local fixture instead.';
  return null;
}

export function AuditInput({ onRunAudit, onTargetChange, onValidationStateChange, isLoading, error, currentFixtureId, currentContext }: AuditInputProps) {
  const [productContext, setProductContext] = useState<ProductContext>(EMPTY_PRODUCT_CONTEXT);
  const [contextMode, setContextMode] = useState<'auto' | 'manual'>('auto');

  useEffect(() => {
    if (currentContext) {
      setProductContext(currentContext);
      if (Object.values(currentContext).some(Boolean)) {
        setContextMode('manual');
      }
    }
  }, [currentContext]);

  const submitAudit = async (target: string) => {
    const parsed = ProductContextSchema.safeParse(productContext);
    if (contextMode === 'manual' && !parsed.success) {
      setClientError(parsed.error.issues[0].message);
      onValidationStateChange?.(true);
      return;
    }
    await onRunAudit(
      target,
      contextMode === 'manual' ? (parsed.success ? parsed.data : undefined) : undefined,
      contextMode === 'auto'
    );
  };
  const [selectedFixture, setSelectedFixture] = useState('target-size-demo');
  const [customUrl, setCustomUrl] = useState('');
  const [activeTab, setActiveTab] = useState<'fixture' | 'custom'>('fixture');
  const [clientError, setClientError] = useState<string | null>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const fixtureSelectRef = useRef<HTMLSelectElement>(null);
  const displayedError = clientError || error || null;

  useEffect(() => {
    if (currentFixtureId && FIXTURES.some(f => f.id === currentFixtureId)) setSelectedFixture(currentFixtureId);
  }, [currentFixtureId]);

  useEffect(() => {
    onTargetChange?.(activeTab === 'fixture' ? `fixture://${selectedFixture}` : customUrl);
  }, [activeTab, customUrl, onTargetChange, selectedFixture]);

  useEffect(() => {
    const handleHash = () => {
      if (typeof window !== 'undefined' && window.location.hash === '#local-fixtures') {
        setActiveTab('fixture');
        setClientError(null);
        onValidationStateChange?.(false);
        requestAnimationFrame(() => fixtureSelectRef.current?.focus());
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, [onValidationStateChange]);

  const selectMode = (mode: 'fixture' | 'custom') => {
    setActiveTab(mode);
    setClientError(null);
    onValidationStateChange?.(false);
    requestAnimationFrame(() => (mode === 'fixture' ? fixtureSelectRef.current : urlInputRef.current)?.focus());
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isLoading) return;
    if (activeTab === 'custom') {
      const validationError = validatePublicUrl(customUrl);
      if (validationError) {
        setClientError(validationError);
        onValidationStateChange?.(true);
        requestAnimationFrame(() => urlInputRef.current?.focus());
        return;
      }
    }
    setClientError(null);
    onValidationStateChange?.(false);
    await submitAudit(activeTab === 'fixture' ? selectedFixture : customUrl.trim());
  };

  return (
    <section id="audit-input" className="audit-input-panel rounded-xl border border-zinc-200/90 bg-white p-5 sm:p-6 shadow-xs space-y-5 scroll-mt-20" aria-labelledby="audit-input-title">
      <div id="local-fixtures" className="scroll-mt-24" />
      <div className="section-heading-row flex items-start justify-between gap-4 pb-1">
        <div>
          <p className="eyebrow text-[10px] font-semibold uppercase tracking-wider text-zinc-500">New audit</p>
          <h2 id="audit-input-title" className="text-lg font-bold tracking-tight text-zinc-900">Choose what to review</h2>
        </div>
      </div>

      <div className="segmented-control grid grid-cols-2 gap-1 rounded-lg bg-zinc-100 p-1" role="tablist" aria-label="Audit target type">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'fixture'}
          aria-controls="fixture-panel"
          id="fixture-tab"
          onClick={() => selectMode('fixture')}
          className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-all ${
            activeTab === 'fixture'
              ? 'bg-white text-zinc-950 shadow-xs font-semibold'
              : 'text-zinc-600 hover:text-zinc-900'
          }`}
        >
          <span>Local fixture</span>
          <span className="text-[10px] bg-zinc-200/80 text-zinc-700 font-normal px-1.5 py-0.2 rounded ml-1">Recommended</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'custom'}
          aria-controls="url-panel"
          id="url-tab"
          onClick={() => selectMode('custom')}
          className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-all ${
            activeTab === 'custom'
              ? 'bg-white text-zinc-950 shadow-xs font-semibold'
              : 'text-zinc-600 hover:text-zinc-900'
          }`}
        >
          <span>Public URL</span>
        </button>
      </div>

      <ProductContextFields
        value={productContext}
        onChange={setProductContext}
        disabled={isLoading}
        targetUrl={activeTab === 'custom' && customUrl.trim() ? customUrl.trim() : undefined}
        contextMode={contextMode}
        onContextModeChange={setContextMode}
      />

      <div className="flex items-center justify-between gap-3 pt-1">
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md border border-zinc-200 bg-white hover:bg-zinc-100 hover:text-zinc-900 text-zinc-700 text-xs font-medium px-3 h-8 shadow-xs transition-colors disabled:opacity-50"
          disabled={isLoading}
          onClick={() => {
            setActiveTab('fixture');
            setSelectedFixture('mvp-contrast-demo');
            setClientError(null);
            onValidationStateChange?.(false);
            void submitAudit('fixture://mvp-contrast-demo');
          }}
        >
          Run Text Contrast MVP
        </button>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {activeTab === 'fixture' ? (
          <div id="fixture-panel" role="tabpanel" aria-labelledby="fixture-tab" className="field-group space-y-1.5">
            <label htmlFor="fixture-select" className="text-xs font-medium text-zinc-700 block">
              Local test fixture
            </label>
            <p id="fixture-help" className="field-help text-xs text-zinc-500 leading-relaxed">
              Self-contained and safe for a first audit. Fixture colors and behaviors remain unchanged.
            </p>
            <select
              ref={fixtureSelectRef}
              id="fixture-select"
              value={selectedFixture}
              onChange={(event) => setSelectedFixture(event.target.value)}
              disabled={isLoading}
              aria-describedby="fixture-help"
              className="flex h-9 w-full rounded-md border border-zinc-200 bg-zinc-50/50 px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 focus:bg-white text-zinc-900 transition-colors"
            >
              {FIXTURES.map((fixture) => (
                <option key={fixture.id} value={fixture.id}>
                  {fixture.name} — {fixture.description}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div id="url-panel" role="tabpanel" aria-labelledby="url-tab" className="field-group space-y-1.5">
            <label htmlFor="custom-url-input" className="text-xs font-medium text-zinc-700 block">
              Public rendered page URL
            </label>
            <p id="url-help" className="field-help text-xs text-zinc-500 leading-relaxed">
              HTTP and HTTPS only. Authentication, localhost, private networks, and metadata endpoints are blocked.
            </p>
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
              className="flex h-9 w-full rounded-md border border-zinc-200 bg-zinc-50/50 px-3 py-1 text-xs shadow-xs placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 focus:bg-white text-zinc-900 transition-colors"
            />
          </div>
        )}

        <div className="form-action-row flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-zinc-100">
          <div className="form-message-slot min-h-[24px]">
            {displayedError && (
              <div id="audit-target-error" className="inline-error flex items-center gap-1.5 text-xs text-rose-600 bg-rose-50 border border-rose-200 px-2.5 py-1.5 rounded-md" role="alert">
                <Icon name="AlertTriangle" size={15} />
                <span>{displayedError}</span>
              </div>
            )}
          </div>
          <button
            type="submit"
            id="run-audit-button"
            className="primary-button inline-flex items-center justify-center gap-2 rounded-md bg-zinc-900 px-4 h-9 text-xs font-medium text-white shadow-xs hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 disabled:opacity-50 transition-colors"
            disabled={isLoading}
            aria-describedby="audit-duration"
          >
            <Icon name={isLoading ? 'LoaderCircle' : 'Play'} size={15} className={isLoading ? 'animate-spin' : ''} />
            <span>{isLoading ? 'Audit in progress' : 'Run audit'}</span>
          </button>
        </div>
        <span id="audit-duration" className="sr-only">
          An audit usually takes ten to thirty seconds.
        </span>
      </form>
    </section>
  );
}
