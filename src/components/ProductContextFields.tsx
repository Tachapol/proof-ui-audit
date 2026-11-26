'use client';

import { useState } from 'react';
import { ProductContext, EMPTY_PRODUCT_CONTEXT } from '@/lib/schema/product-context';
import { Icon } from './Icon';

interface Props {
  value: ProductContext;
  onChange: (value: ProductContext) => void;
  disabled?: boolean;
  targetUrl?: string;
  htmlSnippet?: string;
  contextMode?: 'auto' | 'manual';
  onContextModeChange?: (mode: 'auto' | 'manual') => void;
}

export function ProductContextFields({
  value,
  onChange,
  disabled,
  targetUrl,
  htmlSnippet,
}: Props) {
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectStatus, setDetectStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const fields = [
    { key: 'productGoal', label: 'Product Goal', placeholder: 'Help students find and register for courses easily.', max: 1000, multiline: true },
    { key: 'brandKeywords', label: 'Brand Keywords', placeholder: 'Friendly, trustworthy, clear', max: 300 },
    { key: 'themeColor', label: 'Theme Color', placeholder: '#2563EB', max: 7 },
    { key: 'targetAudience', label: 'Target Audience', placeholder: 'University students using mobile devices', max: 1000, multiline: true },
    { key: 'additionalContext', label: 'Others / Additional Context', placeholder: 'Key task, platform, language, design constraints or evaluation focus', max: 2000, multiline: true },
  ] as const;

  const hasAnyValue = Object.values(value).some((v) => Boolean(v && v.trim()));

  const handleClear = () => {
    onChange({ ...EMPTY_PRODUCT_CONTEXT });
    setDetectStatus('idle');
  };

  const handleAutoGenerate = async () => {
    if (isDetecting || disabled) return;
    setIsDetecting(true);
    setDetectStatus('idle');

    try {
      const res = await fetch('/api/context/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: targetUrl || '',
          html: htmlSnippet || '',
          allowLocalhost: true,
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to detect context: ${res.statusText}`);
      }

      const data = await res.json();
      if (data.success && data.context) {
        onChange({
          productGoal: data.context.productGoal || '',
          brandKeywords: data.context.brandKeywords || '',
          themeColor: data.context.themeColor || '',
          targetAudience: data.context.targetAudience || '',
          additionalContext: data.context.additionalContext || '',
        });
        setDetectStatus('success');
        setTimeout(() => setDetectStatus('idle'), 3000);
      } else {
        setDetectStatus('error');
        setTimeout(() => setDetectStatus('idle'), 3000);
      }
    } catch (err) {
      console.error('Context detection error:', err);
      setDetectStatus('error');
      setTimeout(() => setDetectStatus('idle'), 3000);
    } finally {
      setIsDetecting(false);
    }
  };

  return (
    <fieldset disabled={disabled} className="product-context-fields space-y-3">
      <legend className="sr-only">Product Context</legend>

      {/* Header: Title & Auto-generate Action Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-0.5">
        <div>
          <span className="text-xs font-semibold text-zinc-900 flex items-center gap-1.5">
            Product Context
            <span className="text-[10px] font-normal text-zinc-400">(Optional)</span>
          </span>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            Provide design goals, branding, or audience to guide context-aware AI critiques.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          {hasAnyValue && (
            <button
              type="button"
              onClick={handleClear}
              disabled={disabled || isDetecting}
              className="text-[11px] text-zinc-400 hover:text-zinc-700 font-medium px-2 py-1 rounded transition-colors disabled:opacity-50"
              title="Clear all fields"
            >
              Clear
            </button>
          )}

          <button
            type="button"
            id="context-mode-manual"
            onClick={handleAutoGenerate}
            disabled={disabled || isDetecting}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border transition-all ${
              detectStatus === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : detectStatus === 'error'
                ? 'bg-rose-50 text-rose-800 border-rose-200'
                : 'bg-white hover:bg-zinc-50 text-zinc-800 border-zinc-200 shadow-2xs hover:border-zinc-300'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            title="Auto-detect context from page metadata or component tags"
          >
            <Icon
              name={isDetecting ? 'LoaderCircle' : detectStatus === 'success' ? 'Check' : 'Sparkles'}
              size={13}
              className={
                isDetecting
                  ? 'animate-spin text-blue-600'
                  : detectStatus === 'success'
                  ? 'text-emerald-600'
                  : 'text-amber-500'
              }
            />
            <span>
              {isDetecting
                ? 'Auto-generating...'
                : detectStatus === 'success'
                ? 'Context generated!'
                : detectStatus === 'error'
                ? 'Detection failed'
                : 'Auto-generate context'}
            </span>
          </button>
        </div>
      </div>

      {/* Custom details input grid: Always visible */}
      <div className="space-y-3.5 pt-1">
        <div className="product-context-grid grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {fields.map((field) => (
            <div
              className={`field-group flex flex-col gap-1.5 ${
                field.key === 'productGoal' ? 'md:col-span-2' : ''
              }`}
              key={field.key}
            >
              <label className="text-xs font-medium text-zinc-700" htmlFor={`context-${field.key}`}>
                {field.label}
              </label>
              {'multiline' in field && field.multiline ? (
                <textarea
                  className="flex min-h-[64px] w-full rounded-md border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-xs shadow-xs placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-600 focus-visible:border-blue-600 focus:bg-white disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                  id={`context-${field.key}`}
                  value={value[field.key]}
                  maxLength={field.max}
                  rows={2}
                  placeholder={field.placeholder}
                  onChange={(e) => onChange({ ...value, [field.key]: e.target.value })}
                />
              ) : (
                <input
                  className="flex h-9 w-full rounded-md border border-zinc-200 bg-zinc-50/50 px-3 py-1 text-xs shadow-xs placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-600 focus-visible:border-blue-600 focus:bg-white disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                  id={`context-${field.key}`}
                  type="text"
                  value={value[field.key]}
                  maxLength={field.max}
                  placeholder={field.placeholder}
                  onChange={(e) => onChange({ ...value, [field.key]: e.target.value })}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </fieldset>
  );
}
