import { randomUUID } from 'crypto';

export interface SandboxSnippet {
  id: string;
  html: string;
  timestamp: string;
}

// In-memory store with auto-cleanup for snippets
const snippetStore = new Map<string, SandboxSnippet>();

export function saveSandboxSnippet(html: string): SandboxSnippet {
  const id = `snip-${randomUUID().slice(0, 8)}`;
  const snippet: SandboxSnippet = {
    id,
    html,
    timestamp: new Date().toISOString(),
  };
  snippetStore.set(id, snippet);

  // Keep store bounded to latest 50 snippets
  if (snippetStore.size > 50) {
    const oldestKey = snippetStore.keys().next().value;
    if (oldestKey) snippetStore.delete(oldestKey);
  }

  return snippet;
}

export function getSandboxSnippet(id: string): SandboxSnippet | undefined {
  return snippetStore.get(id);
}

export function buildSandboxedDocument(snippetHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
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

