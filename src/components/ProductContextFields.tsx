'use client';

import { useState } from 'react';
import { ProductContext } from '@/lib/schema/product-context';
import { Icon } from './Icon';

interface Props {
  value: ProductContext;
  onChange: (value: ProductContext) => void;
  disabled?: boolean;
  targetUrl?: string;
  contextMode?: 'auto' | 'manual';
  onContextModeChange?: (mode: 'auto' | 'manual') => void;
}

export function ProductContextFields({
  value,
  onChange,
  disabled,
  targetUrl,
  contextMode,
  onContextModeChange,
}: Props) {
  // If value has non-empty values, default to manual; otherwise default to auto
  const [internalMode, setInternalMode] = useState<'auto' | 'manual'>(() =>
    Object.values(value).some(Boolean) ? 'manual' : 'auto'
  );
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectNotice, setDetectNotice] = useState<string | null>(null);

  const mode = contextMode ?? internalMode;
  const setMode = (nextMode: 'auto' | 'manual') => {
    setDetectNotice(null);
    if (onContextModeChange) {
      onContextModeChange(nextMode);
    } else {
      setInternalMode(nextMode);
    }
  };

  const fields = [
    { key: 'productGoal', label: 'Product Goal', placeholder: 'Help students find and register for courses easily.', max: 1000, multiline: true },
    { key: 'brandKeywords', label: 'Brand Keywords', placeholder: 'Friendly, trustworthy, clear', max: 300 },
    { key: 'themeColor', label: 'Theme Color', placeholder: '#2563EB', max: 7 },
    { key: 'targetAudience', label: 'Target Audience', placeholder: 'University students using mobile devices', max: 1000, multiline: true },
    { key: 'additionalContext', label: 'Others / Additional Context', placeholder: 'Key task, platform, language, design constraints or evaluation focus', max: 2000, multiline: true },
  ] as const;

  const handleAutoFill = async () => {
    if (!targetUrl || disabled || isDetecting) return;
    setIsDetecting(true);
    setDetectNotice(null);
    try {
      const res = await fetch('/api/context/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: targetUrl }),
      });
      const data = await res.json();
      if (data.success && data.context) {
        onChange({
          productGoal: data.context.productGoal || value.productGoal,
          brandKeywords: data.context.brandKeywords || value.brandKeywords,
          themeColor: data.context.themeColor || value.themeColor,
          targetAudience: data.context.targetAudience || value.targetAudience,
          additionalContext: data.context.additionalContext || value.additionalContext,
        });
        setDetectNotice('Auto-filled from page metadata.');
      } else {
        setDetectNotice(data.error || 'Could not auto-detect from this URL.');
      }
    } catch {
      setDetectNotice('Failed to reach detection service.');
    } finally {
      setIsDetecting(false);
    }
  };

  return (
    <fieldset disabled={disabled} className="product-context-fields space-y-3">
      <legend className="sr-only">Product Context</legend>

      {/* Mode Switch Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-1">
        <div>
          <span className="text-xs font-semibold text-zinc-900 flex items-center gap-1.5">
            Product Context
            <span className="text-[10px] font-normal text-zinc-500">(Optional)</span>
          </span>
          <p id="product-context-help" className="text-[11px] text-zinc-500">
            Choose whether to auto-detect details from page or specify custom brand guidelines.
          </p>
        </div>

        {/* 2 Choice segmented control */}
        <div
          className="inline-flex items-center rounded-lg bg-zinc-100 p-0.5 self-start sm:self-auto border border-zinc-200/60"
          role="radiogroup"
          aria-label="Context input mode"
        >
          <button
            type="button"
            role="radio"
            id="context-mode-auto"
            aria-checked={mode === 'auto'}
            onClick={() => setMode('auto')}
            disabled={disabled}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
              mode === 'auto'
                ? 'bg-white text-zinc-950 shadow-xs font-semibold'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <Icon name="Sparkles" size={13} className="text-amber-500" />
            <span>Auto-detect</span>
          </button>
          <button
            type="button"
            role="radio"
            id="context-mode-manual"
            aria-checked={mode === 'manual'}
            onClick={() => setMode('manual')}
            disabled={disabled}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
              mode === 'manual'
                ? 'bg-white text-zinc-950 shadow-xs font-semibold'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <Icon name="FileText" size={13} />
            <span>Custom details</span>
          </button>
        </div>
      </div>

      {/* Choice 1: Auto-detect summary card */}
      {mode === 'auto' ? (
        <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50/70 p-3.5 flex items-start gap-3 transition-colors">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-50 border border-amber-200/70 text-amber-600 shrink-0 mt-0.5">
            <Icon name="Sparkles" size={16} />
          </div>
          <div className="space-y-1 text-xs leading-relaxed">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-zinc-900">Auto-detect from page</span>
              <span className="text-[10px] bg-amber-100/70 text-amber-800 font-medium px-1.5 py-0.5 rounded">Active</span>
            </div>
            <p className="text-zinc-600 text-[11px]">
              Page title, meta description, and brand theme color will be extracted automatically during the audit to tailor remediation guidance.
            </p>
            <button
              type="button"
              onClick={() => setMode('manual')}
              className="text-[11px] font-medium text-zinc-900 underline hover:text-zinc-700 pt-0.5 inline-block"
            >
              Need specific requirements? Customize manually &rarr;
            </button>
          </div>
        </div>
      ) : (
        /* Choice 2: Manual inputs */
        <div className="space-y-3.5 pt-1">
          {targetUrl && (
            <div className="flex flex-wrap items-center justify-between gap-2 bg-zinc-50/80 border border-zinc-200/80 rounded-md px-3 py-1.5">
              <span className="text-[11px] text-zinc-600">
                Want to start with values from this page?
              </span>
              <button
                type="button"
                onClick={handleAutoFill}
                disabled={disabled || isDetecting}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-800 bg-white hover:bg-zinc-100 border border-zinc-200 px-2.5 py-1 rounded shadow-2xs transition-colors disabled:opacity-50"
              >
                <Icon
                  name={isDetecting ? 'LoaderCircle' : 'Sparkles'}
                  size={12}
                  className={isDetecting ? 'animate-spin' : 'text-amber-500'}
                />
                <span>{isDetecting ? 'Detecting page...' : 'Auto-fill from page'}</span>
              </button>
            </div>
          )}

          {detectNotice && (
            <p className="text-[11px] text-zinc-600 bg-zinc-100 px-2.5 py-1 rounded border border-zinc-200/60">
              {detectNotice}
            </p>
          )}

          <div className="product-context-grid grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {fields.map(field => (
              <div
                className={`field-group flex flex-col gap-1.5 ${
                  field.key === 'productGoal' || field.key === 'additionalContext' ? 'md:col-span-2' : ''
                }`}
                key={field.key}
              >
                <label className="text-xs font-medium text-zinc-700" htmlFor={`context-${field.key}`}>
                  {field.label}
                </label>
                {'multiline' in field && field.multiline ? (
                  <textarea
                    className="flex min-h-[64px] w-full rounded-md border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-xs shadow-xs placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 focus:bg-white disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                    id={`context-${field.key}`}
                    value={value[field.key]}
                    maxLength={field.max}
                    rows={2}
                    placeholder={field.placeholder}
                    onChange={e => onChange({ ...value, [field.key]: e.target.value })}
                    aria-describedby="product-context-help"
                  />
                ) : (
                  <input
                    className="flex h-9 w-full rounded-md border border-zinc-200 bg-zinc-50/50 px-3 py-1 text-xs shadow-xs placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 focus:bg-white disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                    id={`context-${field.key}`}
                    type="text"
                    value={value[field.key]}
                    maxLength={field.max}
                    placeholder={field.placeholder}
                    onChange={e => onChange({ ...value, [field.key]: e.target.value })}
                    aria-describedby="product-context-help"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </fieldset>
  );
}
