// Export the canvas tree to a self-contained HTML file (or copyable snippet).

import { COMPONENTS } from './components.js';
import { iconSvg } from './icons.js';

function nodeToHTML(node) {
  const def = COMPONENTS[node.type];
  if (!def) return '';
  if (def.container) {
    const childrenHTML = node.children.map(nodeToHTML).join('\n');
    return def.toHTML(node.props, childrenHTML);
  }
  return def.toHTML(node.props);
}

function buildBodyHTML(root) {
  return root.children.map(nodeToHTML).join('\n');
}

function buildDocument(bodyHTML) {
  // Inline tokens + components CSS so the export is self-contained.
  // Fetch them at export time so the export reflects the user's current tokens.
  return `<!doctype html>
<html lang="en" data-theme="${document.documentElement.dataset.theme || ''}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Exported UI</title>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
  <style>__TOKENS__</style>
  <style>__COMPONENTS__</style>
  <style>
    body { margin: 0; padding: 24px; background: var(--ds-color-bg); color: var(--ds-color-text-primary); font-family: var(--ds-font-family); }
    .ds-root { max-width: 920px; margin: 0 auto; display: flex; flex-direction: column; gap: 12px; }
  </style>
</head>
<body>
  <div class="ds-root">
${indent(bodyHTML, 4)}
  </div>
</body>
</html>`;
}

function indent(s, n) {
  const pad = ' '.repeat(n);
  return String(s || '').split('\n').map(l => l ? pad + l : l).join('\n');
}

async function fetchCss(path) {
  try {
    const r = await fetch(path);
    if (!r.ok) return `/* failed to load ${path} */`;
    return await r.text();
  } catch (e) {
    return `/* error loading ${path}: ${e.message} */`;
  }
}

export async function openExportModal(root) {
  const body = buildBodyHTML(root);
  const [tokens, comps] = await Promise.all([
    fetchCss('css/tokens.css'),
    fetchCss('css/components.css'),
  ]);
  const fullDoc = buildDocument(body)
    .replace('__TOKENS__', tokens)
    .replace('__COMPONENTS__', comps);

  const overlay = document.createElement('div');
  overlay.className = 'export-overlay';
  overlay.innerHTML = `
    <div class="export-modal" role="dialog" aria-modal="true">
      <div class="export-modal__header">
        <div class="export-modal__title">Exported HTML</div>
        <button class="ds-iconbutton" data-act="close" title="Close">${iconSvg('close')}</button>
      </div>
      <div class="export-modal__body">
        <div style="display:flex; gap:8px; margin-bottom:12px;">
          <button class="ds-button ds-button--ghost ds-button--sm" data-tab="snippet">Snippet only</button>
          <button class="ds-button ds-button--primary ds-button--sm" data-tab="full">Full document</button>
        </div>
        <pre class="export-modal__code" id="export-code"></pre>
      </div>
      <div class="export-modal__actions">
        <button class="ds-button ds-button--ghost ds-button--md" data-act="copy">${iconSvg('copy')}<span>Copy</span></button>
        <button class="ds-button ds-button--primary ds-button--md" data-act="download">${iconSvg('download')}<span>Download HTML</span></button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  const code = overlay.querySelector('#export-code');
  let activeTab = 'full';
  const setTab = (tab) => {
    activeTab = tab;
    code.textContent = tab === 'full' ? fullDoc : body;
    overlay.querySelectorAll('[data-tab]').forEach(b => {
      const isActive = b.dataset.tab === tab;
      b.classList.toggle('ds-button--primary', isActive);
      b.classList.toggle('ds-button--ghost', !isActive);
    });
  };
  setTab('full');

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  overlay.querySelector('[data-act="close"]').addEventListener('click', close);
  overlay.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
  overlay.querySelector('[data-act="copy"]').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(code.textContent);
      flash('Copied to clipboard');
    } catch {
      flash('Copy failed');
    }
  });
  overlay.querySelector('[data-act="download"]').addEventListener('click', () => {
    const content = activeTab === 'full' ? fullDoc : body;
    const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeTab === 'full' ? 'ui-export.html' : 'ui-snippet.html';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  function close() { overlay.remove(); }

  function flash(msg) {
    const t = document.createElement('div');
    t.textContent = msg;
    Object.assign(t.style, {
      position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
      background: 'var(--ds-color-surface-elev)', color: 'var(--ds-color-text-primary)',
      border: '1px solid var(--ds-color-border)', borderRadius: '8px',
      padding: '8px 14px', fontSize: '13px', boxShadow: 'var(--ds-shadow-md)',
      zIndex: 200,
    });
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 1600);
  }
}
