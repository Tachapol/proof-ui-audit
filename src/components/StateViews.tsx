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

export function StateView({ kind, title, description }: StateViewProps) {
  const urgent = kind === 'error';
  return (
    <section
      id={kind === 'empty' ? 'empty-state' : undefined}
      className={`state-view state-${kind}`}
      role={urgent ? 'alert' : 'status'}
      aria-live={urgent ? 'assertive' : 'polite'}
      aria-atomic="true"
      data-testid={`state-${kind}`}
    >
      <div className={`state-icon${kind === 'loading' ? ' is-spinning' : ''}`}>
        <Icon name={iconByKind[kind]} size={20} />
      </div>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </section>
  );
}
