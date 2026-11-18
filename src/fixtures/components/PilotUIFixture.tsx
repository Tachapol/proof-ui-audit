'use client';

import { useState } from 'react';
import type { CSSProperties } from 'react';

/** Neutral participant stimuli. Research expectations live outside this component. */
export function PilotUIFixture({ caseNumber }: { caseNumber: number }) {
  const [message, setMessage] = useState('');
  const button: CSSProperties = { minWidth: 44, minHeight: 44, padding: '8px 16px', background: '#1e40af', color: '#fff', borderRadius: 6 };
  const input: CSSProperties = { width: '100%', minHeight: 44, border: '1px solid #cbd5e1', borderRadius: 6, padding: '8px 12px', background: '#fff', color: '#111827', boxSizing: 'border-box', outline: 'none' };
  return <div style={{ background: '#fff', color: '#111827', padding: 16, fontFamily: 'Arial, sans-serif', fontSize: 16, lineHeight: 1.5 }}>
    {(caseNumber === 1 || caseNumber === 2) && <section>
      <h2 style={{ fontSize: 24 }}>Create your account</h2>
      <p id="registration-note" style={{ color: caseNumber === 1 ? '#aaa' : '#333' }}>Use your email to save your course progress.</p>
      <label htmlFor="registration-email">Email address</label>
      <input id="registration-email" type="email" style={input} />
      <button style={button} onClick={() => setMessage('Account details saved for this demo.')}>Continue</button>
    </section>}
    {(caseNumber === 3 || caseNumber === 4) && <section>
      <h2 style={{ fontSize: 24 }}>Choose a delivery date</h2>
      <p>Select an available day in November.</p>
      <div style={{ display: 'flex', gap: caseNumber === 3 ? 2 : 12 }}>
        {[16,17,18].map(day => <button key={day} id={'day-' + day} aria-label={'November ' + day} onClick={() => setMessage('Selected November ' + day)} style={{ width: caseNumber === 3 ? 18 : 44, height: caseNumber === 3 ? 18 : 44, padding: 0, flexShrink: 0, background: '#1e40af', color: '#fff', fontSize: 12, lineHeight: 'normal' }}>{day}</button>)}
      </div>
    </section>}
    {(caseNumber === 5 || caseNumber === 6) && <section>
      <h2 style={{ fontSize: 24 }}>Course details</h2>
      <article id="course-card" style={{ width: caseNumber === 5 ? 460 : '100%', padding: 16, boxSizing: 'border-box', border: '2px solid #555' }}>
        <h3>Introduction to product design</h3>
        <p>Learn to plan interfaces, review evidence and explain design decisions.</p>
        <button style={button} onClick={() => setMessage('Course added.')}>Add course</button>
      </article>
    </section>}
    {(caseNumber === 7 || caseNumber === 8) && <section>
      <h2 style={{ fontSize: 24 }}>Delivery information</h2>
      <p id="delivery-details" data-text-spacing-target="true" style={{ width: '100%', maxWidth: 260, height: caseNumber === 7 ? 72 : 'auto', overflow: caseNumber === 7 ? 'hidden' : 'visible', lineHeight: '24px', margin: 0 }}>Your order arrives on Monday. Please keep your phone available so our courier can contact you.</p>
      <button style={{ ...button, marginTop: 16 }} onClick={() => setMessage('Delivery confirmed.')}>Confirm delivery</button>
    </section>}
    {(caseNumber === 9 || caseNumber === 10) && <section>
      <h2 style={{ fontSize: 24 }}>Notification settings</h2>
      <label htmlFor="notification-email">Send updates to</label>
      <input id="notification-email" data-nontext-component="true" type="email" style={{ ...input, borderColor: caseNumber === 9 ? '#e0e0de' : '#555' }} />
      <button style={button} onClick={() => setMessage('Settings saved.')}>Save settings</button>
    </section>}
    {caseNumber === 11 && <section>
      <h2 id="catalog-title" style={{ fontSize: 28, fontWeight: 400, color: '#888', background: '#fff' }}>Course catalog</h2>
      <p>Explore available courses for this term.</p>
      <button style={button} onClick={() => setMessage('Showing all courses.')}>Browse courses</button>
    </section>}
    {caseNumber === 12 && <section>
      <h2 style={{ fontSize: 24 }}>Compare quarterly results</h2>
      <p>Compare revenue and costs across quarters.</p>
      <div style={{ overflowX: 'auto' }} tabIndex={0} role="region" aria-label="Quarterly results">
        <table id="quarterly-table" style={{ minWidth: 600, borderCollapse: 'collapse' }}>
          <caption>Amounts in thousands of baht</caption>
          <thead><tr>{['Metric','Q1','Q2','Q3','Q4'].map(t => <th key={t} scope="col" style={{ padding: 12, border: '1px solid #555' }}>{t}</th>)}</tr></thead>
          <tbody>{[['Revenue',120,150,180,200],['Costs',80,90,100,110]].map(row => <tr key={row[0]}>{row.map((v,i) => i === 0 ? <th key={i} scope="row" style={{ padding: 12 }}>{v}</th> : <td key={i} style={{ padding: 12 }}>{v}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </section>}
    <p role="status">{message}</p>
  </div>;
}
