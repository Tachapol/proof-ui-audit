'use client';

import React, { useState } from 'react';
import { FIXTURES } from '@/fixtures/fixture-registry';
import { Icon } from './Icon';

interface AuditInputProps {
  onRunAudit: (target: string) => Promise<void>;
  isLoading: boolean;
  error?: string | null;
}

export function AuditInput({ onRunAudit, isLoading, error }: AuditInputProps) {
  const [selectedFixture, setSelectedFixture] = useState<string>(FIXTURES[0].id);
  const [customUrl, setCustomUrl] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'fixture' | 'custom'>('fixture');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    if (activeTab === 'fixture') {
      onRunAudit(selectedFixture);
    } else {
      onRunAudit(customUrl);
    }
  };

  return (
    <div style={{ background: 'var(--surface)', padding: '24px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
        <button
          type="button"
          onClick={() => setActiveTab('fixture')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'fixture' ? '2px solid var(--accent)' : '2px solid transparent',
            padding: '8px 12px',
            cursor: 'pointer',
            fontWeight: activeTab === 'fixture' ? 600 : 400,
            color: activeTab === 'fixture' ? 'var(--foreground)' : 'var(--foreground-muted)',
            minHeight: '44px',
          }}
        >
          Local Test Fixtures (Recommended)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('custom')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'custom' ? '2px solid var(--accent)' : '2px solid transparent',
            padding: '8px 12px',
            cursor: 'pointer',
            fontWeight: activeTab === 'custom' ? 600 : 400,
            color: activeTab === 'custom' ? 'var(--foreground)' : 'var(--foreground-muted)',
            minHeight: '44px',
          }}
        >
          Public URL Target
        </button>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {activeTab === 'fixture' ? (
          <div>
            <label htmlFor="fixture-select" style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: 'var(--foreground-muted)' }}>
              Select Test Fixture Suite
            </label>
            <select
              id="fixture-select"
              value={selectedFixture}
              onChange={(e) => setSelectedFixture(e.target.value)}
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                background: 'var(--surface-subtle)',
                minHeight: '44px',
              }}
            >
              {FIXTURES.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} — {f.description.slice(0, 60)}...
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label htmlFor="custom-url-input" style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: 'var(--foreground-muted)' }}>
              Public HTTP / HTTPS Rendered Page URL
            </label>
            <input
              id="custom-url-input"
              type="text"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              placeholder="https://example.com"
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                background: 'var(--surface-subtle)',
                minHeight: '44px',
              }}
            />
            <span style={{ fontSize: '12px', color: 'var(--foreground-muted)', display: 'block', marginTop: '4px' }}>
              Private IP ranges and localhost targets are blocked for SSRF protection.
            </span>
          </div>
        )}

        {error && (
          <div
            role="alert"
            style={{
              padding: '12px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--danger-surface)',
              color: 'var(--danger)',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Icon name="AlertTriangle" size={16} color="var(--danger)" />
            <span>{error}</span>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="submit"
            id="run-audit-button"
            disabled={isLoading}
            style={{
              background: isLoading ? 'var(--foreground-muted)' : 'var(--accent)',
              color: 'var(--accent-foreground)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              padding: '0 24px',
              fontWeight: 500,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              minHeight: '44px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {isLoading ? (
              <>
                <Icon name="RefreshCw" size={16} />
                <span>Auditing in Headless Browser...</span>
              </>
            ) : (
              <>
                <Icon name="Play" size={16} />
                <span>Run Audit</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
