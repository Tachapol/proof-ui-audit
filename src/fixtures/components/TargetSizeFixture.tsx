'use client';

import React from 'react';

export function TargetSizeFixture() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* 1. Pass Section */}
      <section style={{ padding: '20px', background: '#ffffff', borderRadius: '8px', border: '1px solid #dededb' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px', color: '#067647' }}>
          Case 1: Standard Pass (min 24 × 24 CSS px)
        </h2>
        <p style={{ fontSize: '13px', color: '#676767', marginBottom: '16px' }}>
          Interactive controls that comfortably meet WCAG 2.2 SC 2.5.8 and provide at least 24×24 px touch area.
        </p>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <button
            id="btn-pass-primary"
            style={{
              width: '120px',
              height: '44px',
              background: '#10a37f',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Save Changes
          </button>

          <button
            id="btn-pass-secondary"
            style={{
              width: '32px',
              height: '32px',
              background: '#f1f1ef',
              border: '1px solid #dededb',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
            aria-label="Add item"
          >
            +
          </button>
        </div>
      </section>

      {/* 2. Candidate Fail Section */}
      <section style={{ padding: '20px', background: '#ffffff', borderRadius: '8px', border: '1px solid #dededb' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px', color: '#b42318' }}>
          Case 2: Candidate Fail (under 24 × 24 CSS px)
        </h2>
        <p style={{ fontSize: '13px', color: '#676767', marginBottom: '16px' }}>
          Undersized interactive controls without sufficient spacing offset or qualifying WCAG exceptions.
        </p>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <button
            id="btn-fail-tiny-delete"
            className="target-fail-delete"
            style={{
              width: '16px',
              height: '16px',
              padding: '0',
              background: '#b42318',
              color: '#ffffff',
              border: 'none',
              borderRadius: '3px',
              fontSize: '10px',
              lineHeight: '16px',
              textAlign: 'center',
              cursor: 'pointer',
            }}
            aria-label="Delete entry"
          >
            ×
          </button>
          <button
            id="btn-fail-tiny-edit"
            className="target-fail-edit"
            style={{
              width: '16px',
              height: '16px',
              padding: '0',
              background: '#475467',
              color: '#ffffff',
              border: 'none',
              borderRadius: '3px',
              fontSize: '10px',
              lineHeight: '16px',
              textAlign: 'center',
              cursor: 'pointer',
            }}
            aria-label="Edit entry"
          >
            ✎
          </button>
          <span style={{ fontSize: '14px', marginLeft: '8px' }}>Item 1042 — Active project record</span>
        </div>
      </section>

      {/* 3. Needs Review Section (WCAG Exceptions) */}
      <section style={{ padding: '20px', background: '#ffffff', borderRadius: '8px', border: '1px solid #dededb' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px', color: '#b54708' }}>
          Case 3: Needs Review (Potential WCAG Exceptions)
        </h2>
        <p style={{ fontSize: '13px', color: '#676767', marginBottom: '16px' }}>
          Controls requiring UX/UI designer interpretation to confirm if WCAG 2.2 exceptions apply.
        </p>

        {/* 3a. Inline link exception */}
        <div style={{ marginBottom: '16px' }}>
          <p id="para-inline-link" style={{ fontSize: '14px', lineHeight: '1.6' }}>
            By registering for an audit session, you agree to our{' '}
            <a
              id="link-inline-terms"
              href="#terms"
              style={{
                color: '#10a37f',
                textDecoration: 'underline',
                display: 'inline',
              }}
            >
              terms and privacy protocol
            </a>{' '}
            governing research data collection.
          </p>
        </div>

        {/* 3b. Spacing offset exception */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ padding: '20px', background: '#f7f7f5', borderRadius: '6px', display: 'inline-block' }}>
            <button
              id="btn-review-spaced"
              style={{
                width: '18px',
                height: '18px',
                background: '#676767',
                color: '#ffffff',
                border: 'none',
                borderRadius: '50%',
                fontSize: '10px',
                cursor: 'pointer',
              }}
              aria-label="Information help tooltip"
            >
              ?
            </button>
          </div>
          <span style={{ fontSize: '13px', color: '#676767' }}>
            (18px icon isolated within 20px padding buffer)
          </span>
        </div>
      </section>
    </div>
  );
}
