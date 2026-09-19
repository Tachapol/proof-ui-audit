'use client';

import React from 'react';
import { Icon } from './Icon';

export type AuditUiStatus = 'ready' | 'queued' | 'running' | 'completed' | 'partial' | 'failed';

interface TopBarProps {
  menuButtonRef: React.RefObject<HTMLButtonElement | null>;
  onOpenNavigation: () => void;
  target?: string;
  status: AuditUiStatus;
  viewportLabel?: string;
}

const statusLabels: Record<AuditUiStatus, string> = {
  ready: 'Ready',
  queued: 'Audit starting',
  running: 'Audit running',
  completed: 'Audit completed',
  partial: 'Partial results',
  failed: 'Audit failed',
};

export function TopBar({ menuButtonRef, onOpenNavigation, target, status, viewportLabel }: TopBarProps) {
  return (
    <header className="top-bar">
      <div className="top-bar-primary">
        <button
          ref={menuButtonRef}
          className="icon-button menu-trigger"
          type="button"
          aria-label="Open navigation drawer"
          aria-controls="primary-navigation"
          onClick={onOpenNavigation}
        >
          <Icon name="Menu" size={20} />
        </button>
        <div className="target-context">
          <span>Current target</span>
          <strong className="safe-wrap">{target || 'No audit selected'}</strong>
        </div>
      </div>
      <div className="top-bar-meta">
        {viewportLabel && <span className="viewport-note">{viewportLabel}</span>}
        <span className={`audit-status status-${status}`} role="status" aria-live="polite" aria-atomic="true">
          <span className="status-dot" aria-hidden="true" />
          {statusLabels[status]}
        </span>
      </div>
    </header>
  );
}
