'use client';

import React from 'react';

export function ContrastFixture() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* 1. Text Contrast Pass Cases */}
      <section style={{ padding: '20px', background: '#ffffff', borderRadius: '8px', border: '1px solid #dededb' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px', color: '#067647' }}>
          Text Contrast: Pass Cases
        </h2>
        <p style={{ fontSize: '13px', color: '#676767', marginBottom: '16px' }}>
          Normal text with ratio &gt;= 4.5:1 and large text with ratio &gt;= 3:1.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p id="text-pass-normal" style={{ fontSize: '16px', color: '#202123', background: '#ffffff', padding: '8px', margin: 0 }}>
            Normal text passing 4.5:1 threshold (#202123 on #ffffff gives ~16:1).
          </p>

          <h3 id="text-pass-large" style={{ fontSize: '24px', fontWeight: 600, color: '#767676', background: '#ffffff', padding: '8px', margin: 0 }}>
            Large text passing 3:1 threshold (#767676 on #ffffff gives 4.54:1).
          </h3>
        </div>
      </section>

      {/* 2. Text Contrast Candidate Fail Cases */}
      <section style={{ padding: '20px', background: '#ffffff', borderRadius: '8px', border: '1px solid #dededb' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px', color: '#b42318' }}>
          Text Contrast: Candidate Fail Cases
        </h2>
        <p style={{ fontSize: '13px', color: '#676767', marginBottom: '16px' }}>
          Normal text below 4.5:1 and large text below 3:1 against background.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p id="text-fail-normal" style={{ fontSize: '15px', color: '#9e9e9e', background: '#ffffff', padding: '8px', margin: 0 }}>
            Washed-out body text failing 4.5:1 (#9e9e9e on #ffffff gives ~2.6:1).
          </p>

          <h3 id="text-fail-large" style={{ fontSize: '26px', fontWeight: 600, color: '#cccccc', background: '#ffffff', padding: '8px', margin: 0 }}>
            Faint large header failing 3:1 (#cccccc on #ffffff gives ~1.6:1).
          </h3>
        </div>
      </section>

      {/* 3. Text Contrast Needs Review (Complex Gradient Background) */}
      <section style={{ padding: '20px', background: '#ffffff', borderRadius: '8px', border: '1px solid #dededb' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px', color: '#b54708' }}>
          Text Contrast: Needs Review (Gradient Background)
        </h2>
        <p style={{ fontSize: '13px', color: '#676767', marginBottom: '16px' }}>
          Text rendered across dynamic multi-color gradient background.
        </p>

        <div
          id="banner-gradient-review"
          data-complex-bg="true"
          style={{
            padding: '24px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #10a37f 0%, #2563eb 50%, #ffffff 100%)',
          }}
        >
          <p id="text-review-gradient" style={{ fontSize: '16px', fontWeight: 600, color: '#ffffff', margin: 0 }}>
            White typography rendered over a multi-stop color gradient.
          </p>
        </div>
      </section>

      {/* 4. Non-Text Component Contrast */}
      <section style={{ padding: '20px', background: '#ffffff', borderRadius: '8px', border: '1px solid #dededb' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px', color: '#202123' }}>
          Non-Text Component Contrast (SC 1.4.11)
        </h2>
        <p style={{ fontSize: '13px', color: '#676767', marginBottom: '16px' }}>
          Visual boundaries and state indicators requiring 3:1 contrast against adjacent colors.
        </p>

        <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Component Pass: 3:1+ boundary */}
          <div>
            <label htmlFor="input-pass-boundary" style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>
              Input (Pass, ~4.9:1 border)
            </label>
            <input
              id="input-pass-boundary"
              data-nontext-component="true"
              type="text"
              defaultValue="High contrast border"
              style={{
                padding: '8px 12px',
                border: '2px solid #555555',
                background: '#ffffff',
                borderRadius: '6px',
              }}
            />
          </div>

          {/* Component Fail: <3:1 boundary */}
          <div>
            <label htmlFor="input-fail-boundary" style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>
              Input (Candidate Fail, ~1.2:1 border)
            </label>
            <input
              id="input-fail-boundary"
              data-nontext-component="true"
              type="text"
              defaultValue="Faint border"
              style={{
                padding: '8px 12px',
                border: '1px solid #e0e0de',
                background: '#ffffff',
                borderRadius: '6px',
              }}
            />
          </div>

          {/* Graphical object with uncertain state: Needs Review */}
          <div>
            <span style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>
              Indicator (Needs Review)
            </span>
            <div
              id="graphic-uncertain-state"
              data-nontext-uncertain="true"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 12px',
                background: '#f7f7f5',
                borderRadius: '6px',
              }}
            >
              <span
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: '#cbd5e1',
                  display: 'inline-block',
                }}
              />
              <span style={{ fontSize: '13px', color: '#202123' }}>Server status pending</span>
            </div>
          </div>

          {/* Inactive / Disabled Control: Excluded under SC 1.4.11 */}
          <div>
            <span style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>
              Disabled Button (Excluded from SC 1.4.11)
            </span>
            <button
              id="btn-disabled-exempt"
              type="button"
              disabled
              style={{
                padding: '8px 16px',
                border: '1px solid #e0e0de',
                background: '#f5f5f4',
                color: '#a8a8a6',
                borderRadius: '6px',
                cursor: 'not-allowed',
              }}
            >
              Disabled Action
            </button>
          </div>
        </div>
      </section>

      {/* 5. Nested Inline Typography (De-duplication validation) */}
      <section style={{ padding: '20px', background: '#ffffff', borderRadius: '8px', border: '1px solid #dededb' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px', color: '#202123' }}>
          Nested Inline Elements (Traversal Deduplication)
        </h2>
        <p style={{ fontSize: '13px', color: '#676767', marginBottom: '16px' }}>
          Text split across nested tags must not create duplicate whole-block issues.
        </p>

        <p id="text-nested-parent" style={{ fontSize: '16px', color: '#202123', background: '#ffffff', padding: '8px', margin: 0 }}>
          Parent text segment with a <span id="text-nested-child" style={{ fontWeight: 700, color: '#10a37f' }}>nested highlighted span</span> inside.
        </p>
      </section>
    </div>
  );
}
