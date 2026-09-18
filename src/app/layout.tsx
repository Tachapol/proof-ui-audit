import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ProofUI Audit PoC — Evidence-Based UX/UI Optimization',
  description: 'A focused research prototype for evidence-based UX/UI optimization with designer-in-the-loop validation across five WCAG-informed criteria.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div id="app-root" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          {children}
        </div>
      </body>
    </html>
  );
}
