#!/usr/bin/env node

/**
 * Bassahaulic Productions - Build Script
 *
 * What it does:
 * 1. Reads all HTML files from src/pages/ (preserving directory structure)
 * 2. Injects partials (head, header, footer, end) via <!-- partial:name --> comments
 * 3. Replaces {{placeholder}} tokens from front-matter-style <!-- config: {...} --> blocks
 * 4. Copies assets (css, js, images, fonts) to dist/
 * 5. Outputs fully assembled pages to dist/
 *
 * Usage:
 *   node scripts/build.js          # Full build
 *   node scripts/build.js --watch  # Watch mode with live reload
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

const SRC = path.join(__dirname, '..', 'src');
const DIST = path.join(__dirname, '..', 'dist');
const PARTIALS_DIR = path.join(SRC, 'includes', 'partials');
const PAGES_DIR = path.join(SRC, 'pages');
const ASSETS_DIR = path.join(SRC, 'assets');

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyDirSync(src, dest) {
  ensureDir(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function getAllFiles(dir, ext) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getAllFiles(full, ext));
    } else if (!ext || full.endsWith(ext)) {
      results.push(full);
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Partial Loader
// ---------------------------------------------------------------------------

const partialsCache = {};

function loadPartial(name) {
  if (partialsCache[name]) return partialsCache[name];
  const filePath = path.join(PARTIALS_DIR, `${name}.html`);
  if (!fs.existsSync(filePath)) {
    console.warn(`  Warning: partial "${name}" not found at ${filePath}`);
    return '';
  }
  partialsCache[name] = fs.readFileSync(filePath, 'utf8');
  return partialsCache[name];
}

// ---------------------------------------------------------------------------
// Page Processing
// ---------------------------------------------------------------------------

function extractConfig(html) {
  const configRegex = /<!--\s*config:\s*(\{[\s\S]*?\})\s*-->/;
  const match = html.match(configRegex);
  if (!match) return { config: {}, cleanHtml: html };
  try {
    const config = JSON.parse(match[1]);
    return { config, cleanHtml: html.replace(configRegex, '').trim() };
  } catch (e) {
    console.warn(`  Warning: invalid config JSON: ${e.message}`);
    return { config: {}, cleanHtml: html };
  }
}

function replacePlaceholders(html, config) {
  return html.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return config[key] !== undefined ? config[key] : '';
  });
}

function buildPage(pageHtml) {
  const { config, cleanHtml } = extractConfig(pageHtml);

  // Assemble full page: head + header + content + footer + end
  let assembled = [
    loadPartial('head'),
    loadPartial('header'),
    `  <main id="main-content">\n${cleanHtml}\n  </main>`,
    loadPartial('footer'),
    loadPartial('end'),
  ].join('\n');

  // Replace config placeholders
  assembled = replacePlaceholders(assembled, config);

  return assembled;
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

function build() {
  const start = Date.now();
  console.log('Building...');

  // Clear partials cache
  Object.keys(partialsCache).forEach(k => delete partialsCache[k]);

  // Clean dist
  if (fs.existsSync(DIST)) {
    fs.rmSync(DIST, { recursive: true });
  }
  ensureDir(DIST);

  // Copy assets
  if (fs.existsSync(ASSETS_DIR)) {
    copyDirSync(ASSETS_DIR, path.join(DIST, 'assets'));
  }

  // Process pages
  const pages = getAllFiles(PAGES_DIR, '.html');
  let count = 0;

  for (const pagePath of pages) {
    const relPath = path.relative(PAGES_DIR, pagePath);
    const pageHtml = fs.readFileSync(pagePath, 'utf8');
    const assembled = buildPage(pageHtml);

    // Determine output path: pages/tools/index.html -> dist/tools/index.html
    const outPath = path.join(DIST, relPath);
    ensureDir(path.dirname(outPath));
    fs.writeFileSync(outPath, assembled, 'utf8');
    count++;
  }

  console.log(`  ${count} page(s) built in ${Date.now() - start}ms`);
}

// ---------------------------------------------------------------------------
// Dev Server with Live Reload
// ---------------------------------------------------------------------------

function startDevServer(port = 3000) {
  const LIVE_RELOAD_SCRIPT = `
<script>
(function(){
  var es = new EventSource('/__reload');
  es.onmessage = function() { location.reload(); };
})();
</script>
</body>`;

  let clients = [];

  const server = http.createServer((req, res) => {
    // SSE endpoint for live reload
    if (req.url === '/__reload') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });
      clients.push(res);
      req.on('close', () => {
        clients = clients.filter(c => c !== res);
      });
      return;
    }

    // Serve static files from dist
    let filePath = path.join(DIST, req.url === '/' ? 'index.html' : req.url);

    // Try directory/index.html for clean URLs
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    // Add .html extension if missing
    if (!fs.existsSync(filePath) && !path.extname(filePath)) {
      filePath += '.html';
    }

    if (!fs.existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('<h1>404 - Not Found</h1>');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
    };

    let content = fs.readFileSync(filePath);
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    // Inject live reload script into HTML
    if (ext === '.html') {
      content = content.toString().replace('</body>', LIVE_RELOAD_SCRIPT);
    }

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });

  server.listen(port, () => {
    console.log(`Dev server running at http://localhost:${port}`);
  });

  // Watch src/ for changes
  const watchDirs = [SRC];
  for (const dir of watchDirs) {
    fs.watch(dir, { recursive: true }, (eventType, filename) => {
      if (!filename) return;
      console.log(`  Changed: ${filename}`);
      try {
        build();
        // Notify all connected clients
        for (const client of clients) {
          client.write('data: reload\n\n');
        }
      } catch (e) {
        console.error(`  Build error: ${e.message}`);
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

build();

if (process.argv.includes('--watch')) {
  startDevServer();
}
