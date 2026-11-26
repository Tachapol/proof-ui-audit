/**
 * Pure client-safe HTML document builder for sandbox preview and audit.
 * Ensures that the rendered layout seen by designers in the iframe
 * is 100% identical in CSS, container width (720px), fonts, and Tailwind setup
 * to what Playwright audits.
 */
export function buildSandboxedDocument(snippetHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; connect-src 'none';">
  <title>ProofUI Component Sandbox</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            brand: '#2563EB',
          }
        }
      }
    }
  </script>
  <style>
    body {
      margin: 0;
      padding: 24px;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: #f8fafc;
      color: #0f172a;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .sandbox-container {
      width: 100%;
      max-width: 720px;
      margin: 0 auto;
    }
  </style>
</head>
<body>
  <div class="sandbox-container" id="sandbox-root">
    ${snippetHtml}
  </div>
</body>
</html>`;
}
