import fs from 'node:fs';
import path from 'node:path';
import { collectKnowledgeEntries, type KnowledgeEntry } from '@/lib/knowledge/catalog';

function renderHtml(rows: KnowledgeEntry[]): string {
  const safeJson = JSON.stringify(rows).replace(/</g, '\\u003c');
  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.kind] = (acc[r.kind] || 0) + 1;
    return acc;
  }, {});
  const sourceCounts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.source] = (acc[r.source] || 0) + 1;
    return acc;
  }, {});
  const sources = Object.keys(sourceCounts).sort((a, b) => {
    if (a === 'proofui') return -1;
    if (b === 'proofui') return 1;
    const aStack = a.startsWith('stacks/');
    const bStack = b.startsWith('stacks/');
    if (aStack !== bStack) return aStack ? 1 : -1;
    return a.localeCompare(b);
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Knowledge Base</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #212121;
      color: #ececec;
      font-size: 13px;
      line-height: 1.5;
      height: 100vh;
      overflow: hidden;
    }
    .layout {
      display: flex;
      height: 100vh;
      width: 100%;
    }
    .sidebar {
      width: 248px;
      flex: 0 0 248px;
      background: #171717;
      border-right: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      flex-direction: column;
      overflow-y: auto;
      padding: 12px 8px;
    }
    .sidebar-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #8e8e8e;
      padding: 6px 10px 4px;
      margin-top: 8px;
    }
    .sidebar-title:first-child { margin-top: 0; }
    .nav-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      width: 100%;
      padding: 7px 10px;
      border: none;
      border-radius: 8px;
      background: transparent;
      color: #d4d4d4;
      font-size: 13px;
      text-align: left;
      cursor: pointer;
    }
    .nav-item:hover { background: #262626; }
    .nav-item.active { background: #2f2f2f; color: #fff; font-weight: 500; }
    .nav-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .nav-count { font-size: 11px; color: #8e8e8e; flex-shrink: 0; }
    .main {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .kpis {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding: 12px 16px;
      background: #212121;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }
    .kpi {
      background: #171717;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      padding: 6px 12px;
      display: flex;
      align-items: baseline;
      gap: 6px;
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s;
    }
    .kpi:hover { background: #2a2a2a; border-color: rgba(255, 255, 255, 0.22); }
    .kpi.active { background: #2f2f2f; border-color: #10a37f; }
    .kpi strong { font-size: 15px; color: #ececec; }
    .kpi span { font-size: 12px; color: #9b9b9b; }
    .kpi.accent { cursor: default; }
    .kpi.accent:hover { background: #171717; border-color: rgba(255, 255, 255, 0.08); }
    .kpi.accent strong { color: #10a37f; }
    .bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      background: #212121;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }
    input, select, button {
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 8px;
      padding: 6px 10px;
      font-size: 13px;
      background: #2f2f2f;
      color: #ececec;
      outline: none;
    }
    input::placeholder { color: #8e8e8e; }
    input:focus, select:focus { border-color: rgba(255, 255, 255, 0.3); }
    input[type="search"] { flex: 1 1 240px; }
    button { cursor: pointer; }
    button:hover { background: #383838; }
    button#csv {
      background: #ececec;
      color: #171717;
      border-color: #ececec;
      font-weight: 500;
    }
    button#csv:hover { background: #d4d4d4; }
    .table-scroll {
      flex: 1;
      overflow: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      text-align: left;
      vertical-align: top;
      padding: 10px 14px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    }
    th {
      background: #212121;
      color: #9b9b9b;
      font-weight: 500;
      position: sticky;
      top: 0;
      z-index: 5;
      white-space: nowrap;
      border-bottom: 1px solid rgba(255, 255, 255, 0.12);
    }
    tr:hover td { background: #2a2a2a; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; color: #9b9b9b; white-space: nowrap; }
    .pill {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 500;
      background: #2f2f2f;
      border: 1px solid rgba(255, 255, 255, 0.08);
      color: #d4d4d4;
    }
    .pre { white-space: pre-wrap; word-break: break-word; color: #d9d9d9; }
    details { margin-top: 6px; }
    summary { cursor: pointer; color: #10a37f; font-size: 12px; }
    pre {
      margin: 6px 0 0;
      padding: 8px 10px;
      background: #171717;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 6px;
      font-size: 11px;
      color: #d4d4d4;
      white-space: pre-wrap;
      overflow-x: auto;
    }
    .empty { padding: 32px; text-align: center; color: #9b9b9b; }
    @media (max-width: 768px) {
      body { height: auto; overflow: auto; }
      .layout { flex-direction: column; height: auto; }
      .sidebar { width: 100%; flex: none; max-height: 220px; border-right: none; border-bottom: 1px solid rgba(255, 255, 255, 0.08); }
    }
  </style>
</head>
<body>
  <div class="layout">
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-title">Sources</div>
      <button class="nav-item active" data-source="">
        <span class="nav-label">All</span>
        <span class="nav-count">${rows.length}</span>
      </button>
      ${sources
        .filter((s) => !s.startsWith('stacks/'))
        .map(
          (s) => `<button class="nav-item" data-source="${s}"><span class="nav-label">${s}</span><span class="nav-count">${sourceCounts[s]}</span></button>`
        )
        .join('')}
      <div class="sidebar-title">Stacks</div>
      ${sources
        .filter((s) => s.startsWith('stacks/'))
        .map(
          (s) => `<button class="nav-item" data-source="${s}"><span class="nav-label">${s.replace('stacks/', '')}</span><span class="nav-count">${sourceCounts[s]}</span></button>`
        )
        .join('')}
    </aside>

    <main class="main">
      <section class="kpis">
        <button type="button" class="kpi active" data-kind=""><strong>${rows.length}</strong><span>Total</span></button>
        <button type="button" class="kpi" data-kind="standard"><strong>${counts.standard || 0}</strong><span>Standard</span></button>
        <button type="button" class="kpi" data-kind="heuristic"><strong>${counts.heuristic || 0}</strong><span>Heuristic</span></button>
        <button type="button" class="kpi" data-kind="implementation"><strong>${counts.implementation || 0}</strong><span>Implementation</span></button>
        <button type="button" class="kpi" data-kind="style"><strong>${counts.style || 0}</strong><span>Style</span></button>
        <div class="kpi accent"><strong id="count">${rows.length}</strong><span>Showing</span></div>
      </section>

      <div class="bar">
        <input type="search" id="q" placeholder="Search..." />
        <select id="kind">
          <option value="">All kinds</option>
          <option value="standard">standard</option>
          <option value="heuristic">heuristic</option>
          <option value="implementation">implementation</option>
          <option value="style">style</option>
        </select>
        <button id="reset">Reset</button>
        <button id="csv">CSV</button>
      </div>

      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Key</th>
              <th>Kind</th>
              <th>Source</th>
              <th>Title</th>
              <th>Body</th>
              <th>Recommendation</th>
            </tr>
          </thead>
          <tbody id="tbody"></tbody>
        </table>
        <div class="empty" id="empty" style="display:none;">No results</div>
      </div>
    </main>
  </div>

  <script>
    const DATA = ${safeJson};
    const tbody = document.getElementById('tbody');
    const empty = document.getElementById('empty');
    const count = document.getElementById('count');
    const qEl = document.getElementById('q');
    const kindEl = document.getElementById('kind');
    const navButtons = Array.from(document.querySelectorAll('.nav-item'));
    const kpiButtons = Array.from(document.querySelectorAll('button.kpi[data-kind]'));
    let activeSource = '';

    function esc(v) {
      return String(v || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function syncKpiActive() {
      const currentKind = kindEl.value;
      kpiButtons.forEach((btn) => {
        btn.classList.toggle('active', (btn.dataset.kind || '') === currentKind);
      });
    }

    function filterRows() {
      const q = qEl.value.trim().toLowerCase();
      const kind = kindEl.value;
      return DATA.filter((r) => {
        if (activeSource && r.source !== activeSource) return false;
        if (kind && r.kind !== kind) return false;
        if (!q) return true;
        return (r.stableKey + ' ' + r.source + ' ' + r.title + ' ' + r.body + ' ' + r.recommendation)
          .toLowerCase()
          .includes(q);
      });
    }

    function render() {
      syncKpiActive();
      const rows = filterRows();
      count.textContent = String(rows.length);
      if (rows.length === 0) {
        tbody.innerHTML = '';
        empty.style.display = 'block';
        return;
      }
      empty.style.display = 'none';

      const slice = rows.slice(0, 500);
      let html = slice.map((r) => {
        const code = (r.codeGood || r.codeBad)
          ? '<details><summary>Code</summary>'
            + (r.codeGood ? '<pre>' + esc(r.codeGood) + '</pre>' : '')
            + (r.codeBad ? '<pre>' + esc(r.codeBad) + '</pre>' : '')
            + '</details>'
          : '';
        return '<tr>'
          + '<td class="mono">' + esc(r.stableKey) + '</td>'
          + '<td><span class="pill">' + esc(r.kind) + '</span></td>'
          + '<td class="mono">' + esc(r.source) + '</td>'
          + '<td><strong>' + esc(r.title) + '</strong></td>'
          + '<td class="pre">' + esc(r.body) + '</td>'
          + '<td class="pre">' + esc(r.recommendation) + code + '</td>'
          + '</tr>';
      }).join('');

      if (rows.length > 500) {
        html += '<tr><td colspan="6" style="text-align:center;color:#9b9b9b;">Showing 500 / ' + rows.length + '</td></tr>';
      }
      tbody.innerHTML = html;
    }

    kpiButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const nextKind = btn.dataset.kind || '';
        kindEl.value = (nextKind && kindEl.value === nextKind) ? '' : nextKind;
        render();
      });
    });

    navButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        activeSource = btn.dataset.source || '';
        navButtons.forEach((b) => b.classList.toggle('active', b === btn));
        render();
      });
    });

    document.getElementById('reset').addEventListener('click', () => {
      qEl.value = '';
      kindEl.value = '';
      activeSource = '';
      navButtons.forEach((b) => b.classList.toggle('active', (b.dataset.source || '') === ''));
      render();
    });

    document.getElementById('csv').addEventListener('click', () => {
      const rows = filterRows();
      const cell = (v) => '"' + String(v || '').replace(/"/g, '""') + '"';
      const lines = ['key,kind,source,title,body,recommendation'];
      for (const r of rows) {
        lines.push([r.stableKey, r.kind, r.source, r.title, r.body, r.recommendation].map(cell).join(','));
      }
      const blob = new Blob(['\\uFEFF' + lines.join('\\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'knowledge-base.csv';
      a.click();
      URL.revokeObjectURL(url);
    });

    [qEl, kindEl].forEach((el) => {
      el.addEventListener('input', render);
      el.addEventListener('change', render);
    });

    render();
  </script>
</body>
</html>`;
}

function main() {
  const rootDir = process.cwd();
  const rows = collectKnowledgeEntries(rootDir);
  const outDir = path.join(rootDir, 'artifacts');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'knowledge-base.html');
  fs.writeFileSync(outPath, renderHtml(rows), 'utf-8');
  console.log(`Exported ${rows.length} entries -> ${outPath}`);
}

main();
