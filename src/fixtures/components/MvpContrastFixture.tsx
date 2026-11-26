export function MvpContrastFixture() {
  const base = { padding: '12px', margin: '12px 0', background: '#ffffff', fontSize: '16px', fontWeight: 400, lineHeight: 1.5 };
  return <section aria-label="Controlled text contrast cases" style={{ background: '#ffffff', padding: '16px' }}>
    <p id="normal-pass" style={{ ...base, color: '#111827' }}>Normal text with high contrast.</p>
    <p id="normal-fail" style={{ ...base, color: '#aaaaaa' }}>Normal text with low contrast.</p>
    <p id="large-pass" style={{ ...base, color: '#777777', fontSize: '28px' }}>Large text with adequate contrast.</p>
    <p id="gradient-review" style={{ ...base, color: '#777777', background: 'linear-gradient(90deg, #fff, #444)' }}>Gradient background requires review.</p>
  </section>;
}
