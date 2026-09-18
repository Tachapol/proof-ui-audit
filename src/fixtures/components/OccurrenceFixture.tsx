'use client';

import React from 'react';

export function OccurrenceFixture() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* 1. Multi-Occurrence Target Size Candidate Failures */}
      <section style={{ padding: '20px', background: '#ffffff', borderRadius: '8px', border: '1px solid #dededb' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px', color: '#b42318' }}>
          Repeated Action Badges (5 Identical Undersized Controls)
        </h2>
        <p style={{ fontSize: '13px', color: '#676767', marginBottom: '16px' }}>
          Five identical 18×18 px dismiss buttons sharing the class <code>button.repeat-tag-btn</code>. Tests that identical raw findings across multiple elements collapse deterministically into a single grouped issue card.
        </p>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          {['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'].map((tag, i) => (
            <div
              key={tag}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 8px',
                background: '#f1f1ef',
                borderRadius: '6px',
                border: '1px solid #dededb',
                fontSize: '13px',
              }}
            >
              <span>{tag}</span>
              <button
                className="repeat-tag-btn"
                aria-label={`Remove ${tag}`}
                style={{
                  width: '18px',
                  height: '18px',
                  padding: 0,
                  border: '1px solid #b42318',
                  background: '#fef3f2',
                  color: '#b42318',
                  borderRadius: '3px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* 2. Repeated Low Contrast Links */}
      <section style={{ padding: '20px', background: '#ffffff', borderRadius: '8px', border: '1px solid #dededb' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px', color: '#b42318' }}>
          Repeated Low-Contrast Footer Links (3 Identical Failures)
        </h2>
        <p style={{ fontSize: '13px', color: '#676767', marginBottom: '16px' }}>
          Three identical navigation links sharing class <code>a.repeat-footer-link</code> with insufficient contrast (ratio ~2.8:1 against white).
        </p>
        <nav style={{ display: 'flex', gap: '16px', background: '#ffffff', padding: '8px 0' }}>
          <a
            href="#terms"
            className="repeat-footer-link"
            style={{ color: '#94a3b8', fontSize: '14px', textDecoration: 'none' }}
          >
            Terms of Service
          </a>
          <a
            href="#privacy"
            className="repeat-footer-link"
            style={{ color: '#94a3b8', fontSize: '14px', textDecoration: 'none' }}
          >
            Privacy Policy
          </a>
          <a
            href="#cookies"
            className="repeat-footer-link"
            style={{ color: '#94a3b8', fontSize: '14px', textDecoration: 'none' }}
          >
            Cookie Preferences
          </a>
        </nav>
      </section>

      {/* 3. Passing Controls (Confirm no false groupings) */}
      <section style={{ padding: '20px', background: '#ffffff', borderRadius: '8px', border: '1px solid #dededb' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px', color: '#067647' }}>
          Compliant Primary Action
        </h2>
        <button
          id="btn-compliant-checkout"
          style={{
            minWidth: '140px',
            minHeight: '44px',
            background: '#10a37f',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 600,
            cursor: 'pointer',
            padding: '10px 16px',
          }}
        >
          Confirm Order
        </button>
      </section>
    </div>
  );
}
