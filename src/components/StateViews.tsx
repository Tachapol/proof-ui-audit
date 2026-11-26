import React from 'react';
import { Icon, IconName } from './Icon';

interface StateViewProps {
  kind: 'empty' | 'loading' | 'error' | 'partial' | 'no-results';
  title: string;
  description: string;
}

const iconByKind: Record<StateViewProps['kind'], IconName> = {
  empty: 'FileText',
  loading: 'LoaderCircle',
  error: 'AlertTriangle',
  partial: 'Info',
  'no-results': 'CheckCircle2',
};

const kindStyles: Record<StateViewProps['kind'], { card: string; iconBox: string; iconColor: string }> = {
  empty: {
    card: 'border-zinc-200 bg-white text-zinc-900',
    iconBox: 'bg-zinc-100 border-zinc-200',
    iconColor: 'text-zinc-600',
  },
  loading: {
    card: 'border-blue-200/80 bg-blue-50/30 text-zinc-900',
    iconBox: 'bg-blue-100/70 border-blue-200',
    iconColor: 'text-blue-600',
  },
  error: {
    card: 'border-rose-200 bg-rose-50/50 text-rose-950',
    iconBox: 'bg-rose-100 border-rose-200',
    iconColor: 'text-rose-600',
  },
  partial: {
    card: 'border-amber-200 bg-amber-50/40 text-amber-950',
    iconBox: 'bg-amber-100/80 border-amber-200',
    iconColor: 'text-amber-700',
  },
  'no-results': {
    card: 'border-zinc-200 bg-white text-zinc-900',
    iconBox: 'bg-zinc-100 border-zinc-200',
    iconColor: 'text-zinc-600',
  },
};

export function StateView({ kind, title, description }: StateViewProps) {
  const urgent = kind === 'error';
  const style = kindStyles[kind];

  return (
    <section
      id={kind === 'empty' ? 'empty-state' : undefined}
      className={`state-view state-${kind} flex items-start gap-3.5 rounded-xl border p-4 sm:p-5 shadow-xs transition-colors ${style.card}`}
      role={urgent ? 'alert' : 'status'}
      aria-live={urgent ? 'assertive' : 'polite'}
      aria-atomic="true"
      data-testid={`state-${kind}`}
    >
      <div
        className={`state-icon shrink-0 w-9 h-9 rounded-lg flex items-center justify-center border ${style.iconBox} ${style.iconColor} ${
          kind === 'loading' ? 'is-spinning' : ''
        }`}
      >
        <Icon name={iconByKind[kind]} size={18} className={kind === 'loading' ? 'animate-spin' : ''} />
      </div>
      <div className="space-y-1 min-w-0">
        <h2 className="text-sm font-semibold tracking-tight text-zinc-900">{title}</h2>
        <p className="text-xs text-zinc-600 leading-relaxed">{description}</p>
      </div>
    </section>
  );
}
