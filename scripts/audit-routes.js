/**
 * audit-routes.js — SEO basics audit for root-level HTML pages.
 * Reports missing <title>, meta viewport, and meta description.
 * Does not modify any files.
 *
 * Usage: node scripts/audit-routes.js
 * Or:    npm run audit:routes
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');

function getRootHtmlFiles() {
  const names = fs.readdirSync(PROJECT_ROOT, { withFileTypes: true });
  return names
    .filter((d) => d.isFile() && d.name.toLowerCase().endsWith('.html'))
    .map((d) => d.name)
    .sort();
}

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    return null;
  }
}

function hasTitle(html) {
  if (!html) return false;
  return /<title[^>]*>[\s\S]*?<\/title>/i.test(html);
}

function hasViewport(html) {
  if (!html) return false;
  return /<meta[^>]+name\s*=\s*["']viewport["'][^>]*>/i.test(html);
}

function hasDescription(html) {
  if (!html) return false;
  return /<meta[^>]+name\s*=\s*["']description["'][^>]*>/i.test(html);
}

function auditPage(filename) {
  const filePath = path.join(PROJECT_ROOT, filename);
  const html = readFileSafe(filePath);
  const empty = !html || html.trim().length === 0;

  return {
    file: filename,
    empty,
    title: empty ? false : hasTitle(html),
    viewport: empty ? false : hasViewport(html),
    description: empty ? false : hasDescription(html),
  };
}

function run() {
  const files = getRootHtmlFiles();
  if (files.length === 0) {
    console.log('No HTML files found in project root.');
    return;
  }

  const results = files.map(auditPage);
  const missingTitle = results.filter((r) => !r.empty && !r.title);
  const missingViewport = results.filter((r) => !r.empty && !r.viewport);
  const missingDescription = results.filter((r) => !r.empty && !r.description);
  const emptyFiles = results.filter((r) => r.empty);

  console.log('=== Route audit (root *.html) ===\n');
  console.log('Pages checked:', files.length);
  console.log('');

  if (emptyFiles.length > 0) {
    console.log('Empty or unreadable:');
    emptyFiles.forEach((r) => console.log('  -', r.file));
    console.log('');
  }

  console.log('Per-page:');
  results.forEach((r) => {
    if (r.empty) {
      console.log('  ', r.file, '— (empty/unreadable)');
      return;
    }
    const parts = [];
    if (!r.title) parts.push('no <title>');
    if (!r.viewport) parts.push('no meta viewport');
    if (!r.description) parts.push('no meta description');
    const status = parts.length === 0 ? 'OK' : parts.join(', ');
    console.log('  ', r.file, '—', status);
  });

  console.log('');
  if (missingTitle.length > 0) {
    console.log('Missing <title>:');
    missingTitle.forEach((r) => console.log('  -', r.file));
    console.log('');
  }
  if (missingViewport.length > 0) {
    console.log('Missing meta viewport:');
    missingViewport.forEach((r) => console.log('  -', r.file));
    console.log('');
  }
  if (missingDescription.length > 0) {
    console.log('Missing meta description (SEO):');
    missingDescription.forEach((r) => console.log('  -', r.file));
    console.log('');
  }

  const allOk = results.every((r) => r.empty || (r.title && r.viewport));
  const descOk = results.every((r) => r.empty || r.description);
  console.log('Summary:');
  console.log('  Title + viewport:', allOk ? 'all present' : 'some missing');
  console.log('  Meta description:', descOk ? 'all present' : 'some missing (report only)');
  console.log('');
  console.log('Done. No files modified.');
}

run();
