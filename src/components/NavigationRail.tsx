'use client';

import React, { useEffect, useRef } from 'react';
import { Icon } from './Icon';

interface NavigationRailProps {
  isOpen: boolean;
  onClose: () => void;
  currentRunId?: string;
  currentFixtureId?: string;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

export function NavigationRail({
  isOpen,
  onClose,
  currentRunId,
  currentFixtureId,
  triggerRef,
}: NavigationRailProps) {
  const drawerRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        triggerRef.current?.focus();
        return;
      }
      if (event.key !== 'Tab' || !drawerRef.current) return;
      const controls = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose, triggerRef]);

  const handleClose = () => {
    onClose();
    triggerRef.current?.focus();
  };

  const handleAnchorClick = (e: React.MouseEvent<HTMLAnchorElement>, hash: string) => {
    handleClose();
    if (hash === '#local-fixtures') {
      window.location.hash = '#local-fixtures';
      const el = document.getElementById('local-fixtures') || document.getElementById('audit-input');
      el?.scrollIntoView({ behavior: 'smooth' });
      requestAnimationFrame(() => {
        const select = document.getElementById('fixture-select') as HTMLSelectElement | null;
        select?.focus();
      });
    } else if (hash === '#audit-results') {
      if (currentRunId) {
        window.location.hash = '#audit-results';
        const el = document.getElementById('audit-results');
        el?.scrollIntoView({ behavior: 'smooth' });
      } else {
        const el = document.getElementById('empty-state') || document.getElementById('audit-input');
        el?.scrollIntoView({ behavior: 'smooth' });
      }
    } else if (hash.startsWith('#')) {
      const el = document.querySelector(hash);
      el?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <>
      {isOpen && <button className="drawer-backdrop" aria-label="Close navigation drawer" onClick={handleClose} />}
      <aside
        ref={drawerRef}
        id="primary-navigation"
        className={`navigation-rail${isOpen ? ' is-open' : ''}`}
        aria-label="Primary navigation"
        aria-modal={isOpen ? 'true' : undefined}
        role={isOpen ? 'dialog' : undefined}
      >
        <div className="rail-brand">
          <div className="brand-mark" aria-hidden="true">P</div>
          <div>
            <strong>ProofUI</strong>
            <span>Audit workspace</span>
          </div>
          <button ref={closeRef} className="icon-button rail-close" type="button" onClick={handleClose} aria-label="Close navigation drawer">
            <Icon name="X" size={19} />
          </button>
        </div>

        <nav aria-label="Audit workspace">
          <a
            className="rail-link is-current"
            href="#audit-input"
            aria-current="page"
            onClick={(e) => handleAnchorClick(e, '#audit-input')}
          >
            <Icon name="Target" size={17} />
            <span>Current audit</span>
          </a>
          <a
            className="rail-link"
            href="#local-fixtures"
            onClick={(e) => handleAnchorClick(e, '#local-fixtures')}
          >
            <Icon name="FlaskConical" size={17} />
            <span>Local fixtures</span>
          </a>
          <a
            className="rail-link"
            href={currentRunId ? '#audit-results' : '#empty-state'}
            aria-disabled={!currentRunId}
            onClick={(e) => handleAnchorClick(e, '#audit-results')}
          >
            <Icon name="FileText" size={17} />
            <span>Report access</span>
          </a>
          <a
            className="rail-link"
            href="/studio"
            onClick={handleClose}
          >
            <Icon name="Users" size={17} />
            <span>Critique Studio</span>
          </a>
        </nav>

        <section className="rail-section rail-recent" aria-labelledby="recent-title">
          <h2 id="recent-title">Recent audit runs</h2>
          {currentRunId ? (
            <a className="recent-run" href={`?runId=${encodeURIComponent(currentRunId)}`} onClick={handleClose}>
              <Icon name="History" size={15} />
              <span className="safe-wrap">{currentRunId}</span>
            </a>
          ) : (
            <p>No saved run in this session.</p>
          )}
        </section>
      </aside>
    </>
  );
}
