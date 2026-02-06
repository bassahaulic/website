# Bassahaulic Productions

Tools, calculators, and resources for car audio enthusiasts.

## Quick Start

```bash
npm run dev     # Build + live reload at http://localhost:3000
npm run build   # Production build to dist/
```

Zero dependencies. Node 18+ required (for `fs.watch` recursive and `fs.rmSync`).

## Project Structure

```
src/
├── assets/
│   ├── css/
│   │   ├── variables.css    # Design tokens (colors, spacing, fonts)
│   │   ├── reset.css        # CSS reset
│   │   ├── global.css       # Base styles, layout utilities
│   │   ├── components.css   # Buttons, cards, forms, tool panels
│   │   ├── header.css       # Site header and navigation
│   │   └── footer.css       # Site footer
│   ├── js/
│   │   ├── nav.js           # Mobile nav toggle (global)
│   │   └── calculators/     # Per-calculator JS files
│   ├── images/
│   └── fonts/
├── includes/
│   ├── partials/            # head.html, header.html, footer.html, end.html
│   └── components/          # Reusable HTML snippets
├── pages/                   # Site pages (directory = URL path)
│   ├── index.html           # Homepage → /
│   ├── calculators/
│   │   ├── index.html       # Calculator listing → /calculators/
│   │   └── wire-gauge/
│   │       └── index.html   # Wire gauge calc → /calculators/wire-gauge/
│   ├── tools/
│   ├── articles/
│   └── about/
├── functions/               # Google Cloud Functions
│   ├── index.js
│   └── package.json
scripts/
└── build.js                 # Build script + dev server
```

## Adding a New Page

1. Create a directory: `src/pages/calculators/my-calc/`
2. Add `index.html` with a config block at the top:

```html
<!-- config: {
  "page_title": "My Calculator",
  "meta_description": "Description for search engines.",
  "extra_css": "",
  "extra_js": "<script src=\"/assets/js/calculators/my-calc.js\" defer></script>"
} -->

    <section class="section">
      <div class="container">
        <!-- Your content here -->
      </div>
    </section>
```

3. If it needs JavaScript, create `src/assets/js/calculators/my-calc.js`
4. Run `npm run build` — the page is now at `/calculators/my-calc/`

The build script automatically wraps your content with the head, header, footer, and closing tags.

## Config Placeholders

Each page can set these values via the `<!-- config: {...} -->` block:

| Placeholder | Purpose |
|---|---|
| `page_title` | `<title>` tag (appended with " \| Bassahaulic Productions") |
| `meta_description` | Meta description for SEO |
| `extra_css` | Additional `<link>` tags for page-specific CSS |
| `extra_js` | Additional `<script>` tags for page-specific JS |

## Design System

All design values live in `src/assets/css/variables.css` as CSS custom properties. Key tokens:

- **Colors**: `--color-accent-blue`, `--color-accent-pink`, `--color-accent-green`
- **Spacing**: `--space-xs` through `--space-3xl`
- **Typography**: `--font-heading` (Montserrat), `--font-body` (Inter)

## Component Classes

| Class | Use |
|---|---|
| `.tool-panel` | Calculator/tool wrapper with shadow and padding |
| `.card` | Clickable card with hover effect |
| `.btn .btn--primary` | Primary action button |
| `.form-group` / `.form-input` | Form fields with focus states |
| `.grid .grid--2col` | Responsive auto-fit grid |
| `.container` | Max-width centered content |
| `.breadcrumbs` | Navigation breadcrumbs |
| `.tag .tag--blue` | Category badges |

## Cloud Functions

```bash
cd src/functions
npm install
npx @google-cloud/functions-framework --target=hello  # Local test
```

Deploy with `gcloud functions deploy`. See `src/functions/index.js` for details.
