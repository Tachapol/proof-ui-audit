import fs from 'node:fs';
import path from 'node:path';

export const DEFAULT_UXBENCH_BOOKING_DIR =
  process.env.UXBENCH_BOOKING_DIR ||
  '/Users/mysteriouz/Projects/UXBench-data/UXBench-master/websites-data/base/booking';

/**
 * Lists HTML pages available in the UXBench booking baseline directory.
 */
export function listUXBenchBookingPages(baseDir = DEFAULT_UXBENCH_BOOKING_DIR): string[] {
  if (!fs.existsSync(baseDir)) return [];
  return fs
    .readdirSync(baseDir)
    .filter((f) => f.endsWith('.html'))
    .sort((a, b) => (a === 'index.html' ? -1 : b === 'index.html' ? 1 : a.localeCompare(b)));
}

/**
 * Loads a UXBench booking HTML page and inlines its local `styles.css`
 * so it renders accurately in both iframe srcDoc previews and Playwright.
 */
export function loadUXBenchBookingHtml(
  pageName = 'index.html',
  baseDir = DEFAULT_UXBENCH_BOOKING_DIR
): string {
  const safeName = path.basename(pageName);
  const htmlPath = path.join(baseDir, safeName);
  if (!fs.existsSync(htmlPath)) {
    return '';
  }

  let html = fs.readFileSync(htmlPath, 'utf-8');
  const cssPath = path.join(baseDir, 'styles.css');
  if (fs.existsSync(cssPath)) {
    const css = fs.readFileSync(cssPath, 'utf-8');
    html = html.replace(
      /<link\s+rel=["']stylesheet["']\s+href=["']styles\.css["']\s*\/?>/i,
      `<style data-source="uxbench/styles.css">\n${css}\n</style>`
    );
  }

  const jsPath = path.join(baseDir, 'script.js');
  if (fs.existsSync(jsPath)) {
    const js = fs.readFileSync(jsPath, 'utf-8').replace(/<\/script>/gi, '<\\/script>');
    html = html.replace(
      /<script\s+src=["']script\.js["']\s*><\/script>/i,
      `<script data-source="uxbench/script.js">\n${js}\n</script>`
    );
  }

  return html;
}
