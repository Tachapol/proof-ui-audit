'use client';

import React from 'react';

/**
 * 1. Isolated Clean Reflow Pass Case
 * Document scrollWidth is exactly 320px at 320 CSS px viewport.
 */
export function ReflowPass() {
  return (
    <section style={{ padding: '20px', background: '#ffffff', borderRadius: '8px', border: '1px solid #dededb', maxWidth: '100%', boxSizing: 'border-box' }}>
      <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px', color: '#067647' }}>
        Reflow: Clean Pass (Isolated)
      </h2>
      <p style={{ fontSize: '13px', color: '#676767', marginBottom: '16px' }}>
        Fluid single-column layout that reflows without 2D scrolling at 320 CSS px.
      </p>

      <div
        id="reflow-pass-card"
        style={{
          width: '100%',
          maxWidth: '100%',
          padding: '16px',
          background: '#f7f7f5',
          borderRadius: '6px',
          border: '1px solid #e0e0de',
          boxSizing: 'border-box',
        }}
      >
        <p style={{ fontSize: '14px', lineHeight: 1.5, margin: 0, color: '#202123' }}>
          This text container adapts fluidly to the 320px viewport width. Words wrap naturally, preserving complete content readability without causing horizontal scrolling or clipping.
        </p>
      </div>
    </section>
  );
}

/**
 * 2. Isolated Unintended Horizontal Overflow Candidate Failure
 * Rigid 460px banner forcing document-level horizontal scrolling.
 */
export function ReflowFail() {
  return (
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
  );
}

/**
 * 3. Isolated Essential 2D Presentation Needs Review
 * Complex data table where spatial 2D arrangement is essential to meaning.
 */
export function ReflowReview() {
  return (
    <section style={{ padding: '20px', background: '#ffffff', borderRadius: '8px', border: '1px solid #dededb' }}>
      <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px', color: '#b54708' }}>
        Reflow: Needs Review (Essential 2D Layout)
      </h2>
      <p style={{ fontSize: '13px', color: '#676767', marginBottom: '16px' }}>
        Complex data table where two-dimensional spatial relationship is essential to content meaning.
      </p>

      <div id="reflow-review-container" data-essential-2d="true" style={{ overflowX: 'auto' }}>
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
  );
}

/**
 * 4. Isolated Nested Scroll & Ancestor Clipped Overflow
 * Tests nested scroll containers and overflow that does not increase document.scrollWidth.
 */
export function ReflowNestedFail() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Nested scroll container forcing 2D scrolling on text */}
      <section style={{ padding: '20px', background: '#ffffff', borderRadius: '8px', border: '1px solid #dededb' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#b42318', marginBottom: '8px' }}>
          Nested Horizontal Scroll Container
        </h2>
        <div
          id="nested-scroll-container"
          style={{
            width: '100%',
            overflowX: 'auto',
            padding: '8px',
            background: '#fef3f2',
            border: '1px solid #fecdca',
            borderRadius: '6px',
          }}
        >
          <div style={{ width: '450px', whiteSpace: 'nowrap', fontSize: '13px', color: '#b42318' }}>
            Non-essential text forced into a horizontal scroll strip: Item 1 | Item 2 | Item 3 | Item 4 | Item 5
          </div>
        </div>
      </section>

      {/* Overflow that does not increase document.scrollWidth (clipped by ancestor) */}
      <section style={{ padding: '20px', background: '#ffffff', borderRadius: '8px', border: '1px solid #dededb' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#b42318', marginBottom: '8px' }}>
          Content Clipped by Ancestor (No Document Scrollbar)
        </h2>
        <div
          id="ancestor-clip-box"
          style={{
            width: '260px',
            overflowX: 'hidden',
            background: '#fef3f2',
            border: '1px solid #fecdca',
            borderRadius: '6px',
            padding: '8px',
          }}
        >
          <div id="clipped-child-content" style={{ width: '400px', fontSize: '13px', color: '#7a271a' }}>
            This critical sentence extends to 400px but is silently truncated by ancestor overflow: hidden without causing document scrollbar.
          </div>
        </div>
      </section>
    </div>
  );
}

/**
 * 5. Isolated Controls Positioned Outside Visible/Clipping Area
 */
export function ReflowControlsFail() {
  return (
    <section style={{ padding: '20px', background: '#ffffff', borderRadius: '8px', border: '1px solid #dededb', position: 'relative' }}>
      <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#b42318', marginBottom: '8px' }}>
        Interactive Control Off-Screen
      </h2>
      <p style={{ fontSize: '13px', color: '#676767', marginBottom: '16px' }}>
        Button positioned beyond 320px viewport, rendering it inoperable without horizontal panning.
      </p>
      <div style={{ position: 'relative', height: '60px' }}>
        <button
          id="offscreen-submit-btn"
          type="button"
          style={{
            position: 'absolute',
            left: '340px',
            top: '0px',
            padding: '8px 16px',
            background: '#b42318',
            color: '#ffffff',
            borderRadius: '4px',
            border: 'none',
          }}
        >
          Off-Screen Action
        </button>
      </div>
    </section>
  );
}

/**
 * 6. Isolated Decorative Overflow Exclusion
 * Decorative element with aria-hidden="true" bleeds offscreen; must NOT trigger candidate failure.
 */
export function ReflowDecorativePass() {
  return (
    <section style={{ width: '100%', padding: '20px', background: '#ffffff', borderRadius: '8px', border: '1px solid #dededb', maxWidth: '100%', overflow: 'hidden', boxSizing: 'border-box' }}>
      <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#067647', marginBottom: '8px' }}>
        Decorative Bleed (Excluded from Failure)
      </h2>
      <p style={{ fontSize: '13px', color: '#676767', marginBottom: '16px' }}>
        Decorative shape bleeds beyond 320px with aria-hidden="true" and data-decorative="true" inside an overflow-contained section. The audit excludes decorative content and confirms clean reflow.
      </p>
      <div
        id="decorative-bleed-shape"
        aria-hidden="true"
        data-decorative="true"
        style={{
          width: '450px',
          height: '40px',
          background: 'radial-gradient(circle, #e0e0de 0%, rgba(255,255,255,0) 70%)',
          borderRadius: '50%',
        }}
      />
    </section>
  );
}

/**
 * Composite Suite for general browsing
 */
export function ReflowFixture() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <ReflowPass />
      <ReflowFail />
      <ReflowReview />
    </div>
  );
}
