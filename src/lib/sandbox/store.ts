import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';

export interface SandboxSnippet {
  id: string;
  html: string;
  timestamp: string;
}

const SNIPPETS_DIR = path.resolve(process.cwd(), '.proofui-data/snippets');
try {
  fs.mkdirSync(SNIPPETS_DIR, { recursive: true });
} catch {
  // Ignore
}

// Global store with disk fallback to prevent cache drops on module re-evaluation
const globalForSnippets = globalThis as unknown as {
  __proofui_snippetStore?: Map<string, SandboxSnippet>;
};
const snippetStore = globalForSnippets.__proofui_snippetStore || new Map<string, SandboxSnippet>();
globalForSnippets.__proofui_snippetStore = snippetStore;

export function saveSandboxSnippet(html: string): SandboxSnippet {
  const id = `snip-${randomUUID().slice(0, 8)}`;
  const snippet: SandboxSnippet = {
    id,
    html,
    timestamp: new Date().toISOString(),
  };
  snippetStore.set(id, snippet);

  try {
    fs.writeFileSync(path.join(SNIPPETS_DIR, `${id}.json`), JSON.stringify(snippet), 'utf-8');
  } catch {
    // Disk write best-effort
  }

  // Keep memory store bounded to latest 50 snippets
  if (snippetStore.size > 50) {
    const oldestKey = snippetStore.keys().next().value;
    if (oldestKey) snippetStore.delete(oldestKey);
  }

  return snippet;
}

export function getSandboxSnippet(id: string): SandboxSnippet | undefined {
  const inMem = snippetStore.get(id);
  if (inMem) return inMem;

  try {
    const filePath = path.join(SNIPPETS_DIR, `${id}.json`);
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      snippetStore.set(id, data);
      return data;
    }
  } catch {
    // Disk fallback best-effort
  }

  return undefined;
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

