'use client';

import React, { useEffect, useRef, useState } from 'react';
import { FIXTURES } from '@/fixtures/fixture-registry';
import { Icon } from './Icon';
import { ProductContextFields } from './ProductContextFields';
import { ProductContext, ProductContextSchema, EMPTY_PRODUCT_CONTEXT } from '@/lib/schema/product-context';

interface AuditInputProps {
  onRunAudit: (target: string, productContext?: ProductContext) => Promise<void>;
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
  useEffect(() => { setProductContext(currentContext || EMPTY_PRODUCT_CONTEXT); }, [currentContext]);
  const submitAudit = async (target: string) => {
    const parsed = ProductContextSchema.safeParse(productContext);
    if (!parsed.success) { setClientError(parsed.error.issues[0].message); onValidationStateChange?.(true); return; }
    await onRunAudit(target, parsed.data);
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
    <section id="audit-input" className="audit-input-panel" aria-labelledby="audit-input-title">
      <div className="section-heading-row">
        <div><p className="eyebrow">New audit</p><h2 id="audit-input-title">Choose what to review</h2></div>
        <span className="duration-note"><Icon name="Clock3" size={15} /> Usually 10–30 seconds</span>
      </div>

      <div className="segmented-control" role="tablist" aria-label="Audit target type">
        <button type="button" role="tab" aria-selected={activeTab === 'fixture'} aria-controls="fixture-panel" id="fixture-tab" onClick={() => selectMode('fixture')}>Local fixture <span>Recommended</span></button>
        <button type="button" role="tab" aria-selected={activeTab === 'custom'} aria-controls="url-panel" id="url-tab" onClick={() => selectMode('custom')}>Public URL</button>
      </div>

      <ProductContextFields value={productContext} onChange={setProductContext} disabled={isLoading} />
      <button type="button" className="primary-button" disabled={isLoading} onClick={() => {
        setActiveTab('fixture'); setSelectedFixture('mvp-contrast-demo'); setClientError(null); onValidationStateChange?.(false);
        void submitAudit('fixture://mvp-contrast-demo');
      }}>Run Text Contrast MVP</button>
      <form onSubmit={handleSubmit} noValidate>
        {activeTab === 'fixture' ? (
          <div id="fixture-panel" role="tabpanel" aria-labelledby="fixture-tab" className="field-group">
            <label htmlFor="fixture-select">Local test fixture</label>
            <p id="fixture-help" className="field-help">Self-contained and safe for a first audit. Fixture colors and behaviors remain unchanged.</p>
            <select ref={fixtureSelectRef} id="fixture-select" value={selectedFixture} onChange={(event) => setSelectedFixture(event.target.value)} disabled={isLoading} aria-describedby="fixture-help">
              {FIXTURES.map((fixture) => <option key={fixture.id} value={fixture.id}>{fixture.name} — {fixture.description}</option>)}
            </select>
          </div>
        ) : (
          <div id="url-panel" role="tabpanel" aria-labelledby="url-tab" className="field-group">
            <label htmlFor="custom-url-input">Public rendered page URL</label>
            <p id="url-help" className="field-help">HTTP and HTTPS only. Authentication, localhost, private networks, and metadata endpoints are blocked.</p>
            <input ref={urlInputRef} id="custom-url-input" name="auditUrl" type="url" inputMode="url" autoComplete="url" value={customUrl} onChange={(event) => { setCustomUrl(event.target.value); if (clientError) { setClientError(null); onValidationStateChange?.(false); } }} placeholder="https://example.com" disabled={isLoading} aria-invalid={displayedError ? 'true' : 'false'} aria-describedby={`url-help${displayedError ? ' audit-target-error' : ''}`} />
          </div>
        )}

        <div className="form-action-row">
          <div className="form-message-slot">
            {displayedError && <div id="audit-target-error" className="inline-error" role="alert"><Icon name="AlertTriangle" size={17} /><span>{displayedError}</span></div>}
          </div>
          <button type="submit" id="run-audit-button" className="primary-button" disabled={isLoading} aria-describedby="audit-duration">
            <Icon name={isLoading ? 'LoaderCircle' : 'Play'} size={17} className={isLoading ? 'spin' : ''} /><span>{isLoading ? 'Audit in progress' : 'Run audit'}</span>
          </button>
        </div>
        <span id="audit-duration" className="sr-only">An audit usually takes ten to thirty seconds.</span>
      </form>
    </section>
  );
}
