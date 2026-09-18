'use client';

import React from 'react';

export function ReflowFixture() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* 1. Clean Reflow Pass Case */}
      <section style={{ padding: '20px', background: '#ffffff', borderRadius: '8px', border: '1px solid #dededb' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px', color: '#067647' }}>
          Reflow: Clean Pass
        </h2>
        <p style={{ fontSize: '13px', color: '#676767', marginBottom: '16px' }}>
          Fluid single-column layout that reflows without 2D scrolling at 320 CSS px.
        </p>

        <div
          id="reflow-pass-card"
          style={{
            maxWidth: '100%',
            padding: '16px',
            background: '#f7f7f5',
            borderRadius: '6px',
            border: '1px solid #e0e0de',
            boxSizing: 'border-box',
          }}
        >
          <p style={{ fontSize: '14px', lineHeight: 1.5, margin: 0, color: '#202123' }}>
            This text container adapts fluidly to the viewport width. Words wrap naturally, preserving readability without causing horizontal scrolling at 320px.
          </p>
        </div>
      </section>

      {/* 2. Unintended Horizontal Overflow Candidate Fail Case */}
      <section style={{ padding: '20px', background: '#ffffff', borderRadius: '8px', border: '1px solid #dededb' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px', color: '#b42318' }}>
          Reflow: Candidate Failure (Unintended Overflow)
        </h2>
        <p style={{ fontSize: '13px', color: '#676767', marginBottom: '16px' }}>
          Fixed-width element exceeding 320 CSS px viewport width, forcing document-level horizontal scroll.
        </p>

        <div
          id="reflow-fail-banner"
          style={{
            width: '460px',
            minWidth: '460px',
            padding: '16px',
            background: '#fef3f2',
            border: '1px solid #fecdca',
            borderRadius: '6px',
            boxSizing: 'border-box',
          }}
        >
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#b42318' }}>
            Fixed Width Banner (460px)
          </span>
          <p style={{ fontSize: '13px', color: '#7a271a', margin: '6px 0 0 0' }}>
            This element has a rigid width of 460px. On a 320 CSS px mobile screen, it forces horizontal scrolling and causes loss of content.
          </p>
        </div>
      </section>

      {/* 3. Essential Two-Dimensional Layout Needs Review */}
      <section style={{ padding: '20px', background: '#ffffff', borderRadius: '8px', border: '1px solid #dededb' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px', color: '#b54708' }}>
          Reflow: Needs Review (Essential 2D Layout)
        </h2>
        <p style={{ fontSize: '13px', color: '#676767', marginBottom: '16px' }}>
          Complex data table where two-dimensional spatial relationship is essential to content meaning.
        </p>

        <div style={{ overflowX: 'auto' }}>
          <table
            id="reflow-review-table"
            data-essential-2d="true"
            style={{
              width: '420px',
              minWidth: '420px',
              borderCollapse: 'collapse',
              fontSize: '12px',
              background: '#ffffff',
            }}
          >
            <thead>
              <tr style={{ background: '#f7f7f5', borderBottom: '1px solid #dededb' }}>
                <th style={{ padding: '8px', textAlign: 'left' }}>Metric</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>Q1</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>Q2</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>Q3</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>Q4</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid #f0f0ee' }}>
                <td style={{ padding: '8px' }}>Audited Views</td>
                <td style={{ padding: '8px', textAlign: 'right' }}>12,400</td>
                <td style={{ padding: '8px', textAlign: 'right' }}>18,200</td>
                <td style={{ padding: '8px', textAlign: 'right' }}>24,900</td>
                <td style={{ padding: '8px', textAlign: 'right' }}>31,000</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
