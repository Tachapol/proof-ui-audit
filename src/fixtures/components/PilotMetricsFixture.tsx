'use client';

import type { CSSProperties } from 'react';

const control: CSSProperties = { position: 'absolute', width: 32, height: 32, padding: 0, border: '1px solid #222', background: '#fff', color: '#111' };

export function PilotMetricsFixture({ variant }: { variant: string }) {
  if (variant === 'empty') return <p id="no-metric-elements">No pointer controls or headings in this UI.</p>;
  if (variant === 'single') return <button id="only-target" style={{ width: 44, height: 44 }}>Only action</button>;
  if (variant === 'context') return <section><h3 id="component-title">Component title</h3><h4 id="component-child">Child section</h4></section>;
  if (variant === 'invalid') return <section>
    <h2 id="before-invalid">Valid heading</h2>
    <div id="missing-level" role="heading">Missing ARIA level</div>
    <div id="invalid-level" role="heading" aria-level={0}>Invalid ARIA level</div>
    <div id="decimal-level" role="heading" aria-level={2.5}>Fractional ARIA level</div>
    <h4 id="after-invalid">Unknown preceding level</h4>
    <h2 id="valid-return">Return to section</h2>
  </section>;
  if (variant === 'heading') return <section style={{ display: 'flex', flexDirection: 'column' }}>
    <h2 id="heading-start" style={{ order: 5 }}>Overview</h2>
    <h4 id="heading-skip" style={{ order: 4 }}>Deeper subsection</h4>
    <h2 id="heading-return" style={{ order: 3 }}>Next overview</h2>
    <div id="aria-heading" role="heading" aria-level={3} style={{ order: 2 }}>ARIA subsection</div>
    <h3 id="heading-peer" style={{ order: 1 }}>Peer section</h3>
    <div hidden><h6 id="hidden-heading">Hidden heading</h6></div>
    <div aria-hidden="true"><h6 id="aria-hidden-heading">Decorative heading</h6></div>
  </section>;
  if (variant === 'exceptions') return <div style={{ position: 'relative', height: 160 }}>
    <button id="nested-action" style={{ ...control, left: 0, top: 0 }} onClick={() => undefined}>
      <span id="nested-icon" data-audit-pointer-target style={{ display: 'block', width: 20, height: 20 }} onClick={() => undefined}>A</span>
    </button>
    <button id="other-action" style={{ ...control, left: 48, top: 0 }}>B</button>
    <button id="disabled-action" disabled style={{ ...control, left: 33, top: 0 }}>D</button>
    <button id="no-pointer" style={{ ...control, left: 33, top: 0, pointerEvents: 'none' }}>N</button>
    <div style={{ opacity: 0 }}><button id="transparent-action">Invisible</button></div>
    <div hidden><button id="hidden-action">Hidden</button></div>
    <div inert><button id="inert-action">Inert</button></div>
    <details><summary id="disclosure" style={{ position: 'absolute', left: 180, top: 80 }}>Details</summary><button id="closed-action">Closed state</button></details>
  </div>;
  return <div style={{ position: 'relative', height: 400 }}>
    <button id="boundary-a" style={{ ...control, left: 0, top: 0 }}>A</button>
    <button id="boundary-b" style={{ ...control, left: 40, top: 0 }}>B</button>
    <button id="close-a" style={{ ...control, left: 0, top: 100 }}>C</button>
    <button id="close-b" style={{ ...control, left: 39.5, top: 100 }}>D</button>
    <button id="overlap-a" style={{ ...control, left: 0, top: 200 }}>E</button>
    <button id="overlap-b" style={{ ...control, left: 24, top: 200 }}>F</button>
    <button id="contact-a" style={{ ...control, left: 0, top: 300 }}>G</button>
    <button id="contact-b" style={{ ...control, left: 32, top: 300 }}>H</button>
  </div>;
}
