'use client';

import React from 'react';

export function TextSpacingFixture() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* 1. Clean Text Spacing Pass Case */}
      <section style={{ padding: '20px', background: '#ffffff', borderRadius: '8px', border: '1px solid #dededb' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px', color: '#067647' }}>
          Text Spacing: Clean Pass
        </h2>
        <p style={{ fontSize: '13px', color: '#676767', marginBottom: '16px' }}>
          Container expands fluidly when WCAG line-height and letter-spacing overrides are applied.
        </p>

        <div
          id="spacing-pass-card"
          style={{
            padding: '16px',
            background: '#f7f7f5',
            borderRadius: '6px',
            border: '1px solid #e0e0de',
            minHeight: 'auto',
          }}
        >
          <p style={{ fontSize: '14px', margin: 0, color: '#202123' }}>
            This card has auto height. When line-height increases to 1.5 and letter/word spacing expands, the container simply grows in height with no text clipping.
          </p>
        </div>
      </section>

      {/* 2. Deterministically Clipped Candidate Fail Case */}
      <section style={{ padding: '20px', background: '#ffffff', borderRadius: '8px', border: '1px solid #dededb' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px', color: '#b42318' }}>
          Text Spacing: Candidate Failure (Deterministic Clipping)
        </h2>
        <p style={{ fontSize: '13px', color: '#676767', marginBottom: '16px' }}>
          Fixed-height container with overflow: hidden that truncates content under text spacing overrides.
        </p>

        <div
          id="spacing-fail-clipped"
          data-text-spacing-target="true"
          style={{
            height: '42px',
            maxHeight: '42px',
            overflow: 'hidden',
            padding: '8px 12px',
            background: '#fef3f2',
            border: '1px solid #fecdca',
            borderRadius: '6px',
            boxSizing: 'border-box',
          }}
        >
          <p style={{ fontSize: '13px', margin: 0, color: '#b42318', lineHeight: 1.2 }}>
            Critical Alert: When line-height is overridden to 1.5, the second line of this important notification text overflows beyond 42px and is permanently cut off.
          </p>
        </div>
      </section>

      {/* 3. Ambiguous Overlap Needs Review */}
      <section style={{ padding: '20px', background: '#ffffff', borderRadius: '8px', border: '1px solid #dededb' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px', color: '#b54708' }}>
          Text Spacing: Needs Review (Ambiguous Overlap)
        </h2>
        <p style={{ fontSize: '13px', color: '#676767', marginBottom: '16px' }}>
          Tight layout where expanded text creates potential bounding box collision.
        </p>

        <div
          id="spacing-review-overlap"
          data-spacing-ambiguous="true"
          style={{
            display: 'flex',
            gap: '4px',
            alignItems: 'center',
            padding: '12px',
            background: '#f7f7f5',
            borderRadius: '6px',
            position: 'relative',
          }}
        >
          <span
            style={{
              fontSize: '12px',
              padding: '4px 8px',
              background: '#e0e0de',
              borderRadius: '4px',
              whiteSpace: 'nowrap',
            }}
          >
            Tag Alpha
          </span>
          <span
            style={{
              fontSize: '12px',
              padding: '4px 8px',
              background: '#e0e0de',
              borderRadius: '4px',
              whiteSpace: 'nowrap',
            }}
          >
            Tag Beta Long Title
          </span>
        </div>
      </section>
    </div>
  );
}
