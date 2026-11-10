'use client';

import React from 'react';
import Link from 'next/link';
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

const statusStyles: Record<AuditUiStatus, { badge: string; dot: string }> = {
  ready: { badge: 'bg-zinc-100 text-zinc-700 border-zinc-200', dot: 'bg-zinc-400' },
  queued: { badge: 'bg-amber-50 text-amber-800 border-amber-200', dot: 'bg-amber-500 animate-pulse' },
  running: { badge: 'bg-blue-50 text-blue-800 border-blue-200', dot: 'bg-blue-500 animate-pulse' },
  completed: { badge: 'bg-emerald-50 text-emerald-800 border-emerald-200', dot: 'bg-emerald-500' },
  partial: { badge: 'bg-amber-50 text-amber-800 border-amber-200', dot: 'bg-amber-500' },
  failed: { badge: 'bg-rose-50 text-rose-800 border-rose-200', dot: 'bg-rose-500' },
};

export function TopBar({ menuButtonRef, onOpenNavigation, target, status, viewportLabel }: TopBarProps) {
  const currentStatusStyle = statusStyles[status];

  return (
    <header className="top-bar sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-zinc-200 bg-white/90 px-4 md:px-6 backdrop-blur-md transition-colors">
      <div className="top-bar-primary flex items-center min-w-0 gap-3">
        <button
          ref={menuButtonRef}
          className="icon-button menu-trigger inline-flex items-center justify-center rounded-md border border-zinc-200 bg-white p-1.5 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 transition-colors"
          type="button"
          aria-label="Open navigation drawer"
          aria-controls="primary-navigation"
          onClick={onOpenNavigation}
        >
          <Icon name="Menu" size={18} />
        </button>

        <div className="target-context flex flex-col min-w-0">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Current target</span>
          <strong className="safe-wrap text-xs font-mono font-medium text-zinc-800 truncate max-w-[200px] sm:max-w-xs md:max-w-md">
            {target || 'No audit selected'}
          </strong>
        </div>
      </div>

      <div className="top-bar-meta flex items-center gap-2 sm:gap-3">
        {viewportLabel && (
          <span className="viewport-note hidden sm:inline-flex items-center text-[11px] font-mono text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200/80">
            {viewportLabel}
          </span>
        )}

        <span
          className={`audit-status status-${status} inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${currentStatusStyle.badge} transition-colors`}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <span className={`status-dot w-1.5 h-1.5 rounded-full ${currentStatusStyle.dot}`} aria-hidden="true" />
          {statusLabels[status]}
        </span>

        <Link
          href="/studio"
          className="hidden md:inline-flex items-center gap-1 text-xs font-medium text-zinc-600 hover:text-zinc-900 border border-zinc-200 hover:border-zinc-300 rounded-md px-2.5 py-1 transition-colors bg-white hover:bg-zinc-50"
        >
          <Icon name="Users" size={13} />
          <span>Critique Studio</span>
        </Link>
      </div>
    </header>
  );
}
