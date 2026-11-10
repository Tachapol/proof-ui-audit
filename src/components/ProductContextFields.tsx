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
  // Default to manual (Custom details) as requested
  const [internalMode, setInternalMode] = useState<'auto' | 'manual'>('manual');

  const mode = contextMode ?? internalMode;
  const setMode = (nextMode: 'auto' | 'manual') => {
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

  return (
    <fieldset disabled={disabled} className="product-context-fields space-y-3">
      <legend className="sr-only">Product Context</legend>

      {/* Mode Switch Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-0.5">
        <div>
          <span className="text-xs font-semibold text-zinc-900 flex items-center gap-1.5">
            Product Context
            <span className="text-[10px] font-normal text-zinc-400">(Optional)</span>
          </span>
        </div>

        {/* 2 Choice segmented control: Custom details first, Auto-detect second */}
        <div
          className="inline-flex items-center rounded-lg bg-zinc-100 p-0.5 self-start sm:self-auto border border-zinc-200/60"
          role="radiogroup"
          aria-label="Context input mode"
        >
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
        </div>
      </div>

      {/* Choice 1: Compact Auto-detect note */}
      {mode === 'auto' ? (
        <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-500 bg-zinc-50/80 border border-zinc-200/60 rounded-md px-3 py-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <Icon name="Sparkles" size={12} className="text-amber-500 shrink-0" />
            <span id="product-context-help" className="truncate">
              Title, description, and brand theme color will be auto-detected from page.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setMode('manual')}
            className="text-zinc-700 hover:text-zinc-950 font-medium underline shrink-0 whitespace-nowrap ml-2"
          >
            Customize &rarr;
          </button>
        </div>
      ) : (
        /* Choice 2: Manual inputs */
        <div className="space-y-3.5 pt-1">
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
