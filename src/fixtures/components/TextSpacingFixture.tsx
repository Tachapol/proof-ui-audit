'use client';

import React from 'react';

/**
 * 1. Isolated Clean Text Spacing Pass Case
 * Container height expands naturally; content wraps without clipping or collision.
 */
export function TextSpacingPass() {
  return (
    <section style={{ padding: '20px', background: '#ffffff', borderRadius: '8px', border: '1px solid #dededb' }}>
      <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px', color: '#067647' }}>
        Text Spacing: Clean Pass (Normal Wrapping & Height Expansion)
      </h2>
      <p style={{ fontSize: '13px', color: '#676767', marginBottom: '16px' }}>
        Container expands fluidly in height when WCAG line-height and letter-spacing overrides are applied.
      </p>

      <div
        id="spacing-pass-card"
        data-text-spacing-pass="true"
        data-text-spacing-target="true"
        style={{
          padding: '16px',
          background: '#f7f7f5',
          borderRadius: '6px',
          border: '1px solid #e0e0de',
          height: 'auto',
          minHeight: 'auto',
        }}
      >
        <p style={{ fontSize: '14px', margin: '0 0 12px 0', color: '#202123' }}>
          Paragraph 1: This card has auto height. When line-height increases to 1.5 and letter/word spacing expands, the container simply grows in height with no text clipping.
        </p>
        <p style={{ fontSize: '14px', margin: 0, color: '#202123' }}>
          Paragraph 2: Paragraph spacing expands according to 2em font size without overflowing container boundaries.
        </p>
      </div>
    </section>
  );
}

/**
 * 2. Isolated Deterministically Clipped Candidate Fail Case (Vertical)
 * Fixed-height container with overflow: hidden truncating content under text spacing overrides.
 */
export function TextSpacingFail() {
  return (
    <section style={{ padding: '20px', background: '#ffffff', borderRadius: '8px', border: '1px solid #dededb' }}>
      <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px', color: '#b42318' }}>
        Text Spacing: Candidate Failure (Vertical Clipping)
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
  );
}

/**
 * 3. Isolated Horizontal Clipping Failure
 * Fixed-width nowrap container that horizontally clips text under letter/word spacing.
 */
export function TextSpacingHorizontalFail() {
  return (
    <section style={{ padding: '20px', background: '#ffffff', borderRadius: '8px', border: '1px solid #dededb' }}>
      <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px', color: '#b42318' }}>
        Text Spacing: Candidate Failure (Horizontal Clipping)
      </h2>
      <div
        id="spacing-fail-horiz"
        data-text-spacing-target="true"
        style={{
          width: '140px',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          padding: '8px',
          background: '#fef3f2',
          border: '1px solid #fecdca',
          borderRadius: '6px',
        }}
      >
        <span style={{ fontSize: '13px', color: '#b42318' }}>
          LongUnbrokenNotificationTextExtendingHorizontally
        </span>
      </div>
    </section>
  );
}

/**
 * 4. Isolated Obscured Interactive Control Failure
 * Expanding text overlaps and obscures an interactive action button.
 */
export function TextSpacingObscuredFail() {
  return (
    <section style={{ padding: '20px', background: '#ffffff', borderRadius: '8px', border: '1px solid #dededb' }}>
      <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px', color: '#b42318' }}>
        Text Spacing: Candidate Failure (Obscured Control)
      </h2>
      <div style={{ position: 'relative', height: '90px' }}>
        <div
          id="spacing-obscuring-text"
          data-text-spacing-target="true"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '280px',
            fontSize: '14px',
            background: '#ffffff',
            zIndex: 2,
          }}
        >
          Notice: When text spacing overrides are applied to this multi-line message, it expands downwards and overlaps the action button below.
        </div>
        <button
          id="obscured-action-btn"
          data-spacing-control="true"
          type="button"
          style={{
            position: 'absolute',
            top: '45px',
            left: '10px',
            padding: '6px 14px',
            background: '#10a37f',
            color: '#ffffff',
            border: 'none',
            borderRadius: '4px',
            zIndex: 1,
          }}
        >
          Confirm Payment
        </button>
      </div>
    </section>
  );
}

/**
 * 5. Isolated Ambiguous Sibling Overlap Needs Review
 */
export function TextSpacingReview() {
  return (
    <section style={{ padding: '20px', background: '#ffffff', borderRadius: '8px', border: '1px solid #dededb' }}>
      <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px', color: '#b54708' }}>
        Text Spacing: Needs Review (Ambiguous Sibling Overlap)
      </h2>
      <div
        id="spacing-review-overlap"
        data-spacing-ambiguous="true"
        data-text-spacing-target="true"
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
          Badge A
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
          Badge B Expanded Title
        </span>
      </div>
    </section>
  );
}

/**
 * 6. Minimum-Preserving Demonstration Case
 * Elements already having high line-height, letter-spacing, and word-spacing.
 * Overrides must NOT reduce these existing values.
 */
export function TextSpacingPreserved() {
  return (
    <section style={{ padding: '20px', background: '#ffffff', borderRadius: '8px', border: '1px solid #dededb' }}>
      <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px', color: '#067647' }}>
        Text Spacing: Minimum-Preserving Demonstration
      </h2>
      <p style={{ fontSize: '13px', color: '#676767', marginBottom: '16px' }}>
        Author styles already exceed WCAG minimums (line-height: 2.4, letter-spacing: 0.25em, word-spacing: 0.3em).
      </p>
      <div
        id="spacing-preserved-box"
        data-text-spacing-pass="true"
        data-text-spacing-target="true"
        style={{
          padding: '16px',
          background: '#f7f7f5',
          borderRadius: '6px',
          border: '1px solid #e0e0de',
        }}
      >
        <p
          id="preserved-text-element"
          style={{
            fontSize: '16px',
            lineHeight: '2.4',
            letterSpacing: '0.25em',
            wordSpacing: '0.3em',
            marginBottom: '3.5em',
            color: '#202123',
          }}
        >
          This paragraph has author line-height 2.4, letter-spacing 0.25em, word-spacing 0.3em, and margin-bottom 3.5em. WCAG text spacing evaluation must NOT reduce these properties down to 1.5, 0.12em, 0.16em, or 2em.
        </p>
      </div>
    </section>
  );
}

/**
 * Composite Suite for general browsing
 */
export function TextSpacingFixture() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <TextSpacingPass />
      <TextSpacingFail />
      <TextSpacingReview />
    </div>
  );
}
