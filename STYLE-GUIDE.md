# Bassahaulic Productions - CSS Style Guide

Everything on the site is controlled by CSS custom properties (variables) defined in `variables.css`. Change a value once, it updates everywhere.

---

## Colors

| Variable | Value | Use |
|---|---|---|
| `--color-bg` | `#000000` | Page background |
| `--color-bg-elevated` | `#0a0a0a` | Slightly raised surfaces |
| `--color-text` | `#F0F0F0` | Default body text |
| `--color-text-bright` | `#FFFFFF` | Headings, emphasized text |
| `--color-text-muted` | `#D4D4D4` | Descriptions, secondary text |
| `--color-text-dim` | `#999999` | Hints, labels, footer links |
| `--color-blue` | `#0097FF` | Primary accent, links, nav, borders |
| `--color-pink` | `#E21AFF` | CTA accent, section labels, hover glow |
| `--color-green` | `#00FF41` | Success states, calculator results |

### Borders

| Variable | Value | Use |
|---|---|---|
| `--color-border` | `rgba(0, 151, 255, 0.4)` | Default card/panel borders |
| `--color-border-subtle` | `rgba(255, 255, 255, 0.12)` | Dividers, footer separators |
| `--color-border-muted` | `#888888` | De-emphasized elements |

### Glow Effects

| Variable | Use |
|---|---|
| `--glow-blue` | Default blue glow on cards |
| `--glow-pink` | Pink glow for CTA elements |
| `--glow-blue-strong` | Intense blue hover glow |
| `--glow-pink-strong` | Intense pink hover glow |

### Surfaces (transparent for matrix rain)

| Variable | Value | Use |
|---|---|---|
| `--color-surface` | `rgba(0, 0, 0, 0.4)` | Tool panels, cards |
| `--color-surface-border` | `rgba(0, 151, 255, 0.35)` | Tool panel borders |
| `--color-surface-hover` | `rgba(226, 26, 255, 0.1)` | Hover backgrounds |

---

## Typography

### Fonts

| Variable | Value | Use |
|---|---|---|
| `--font-heading` | `'Audiowide', sans-serif` | All headings, buttons, labels |
| `--font-body` | `'Roboto', 'Inter', system-ui, sans-serif` | Body text, descriptions |
| `--font-body-weight` | `300` | Light weight for body |
| `--font-body-size` | `18px` | Base font size |
| `--font-body-line-height` | `1.6` | Body line height |

### Heading Sizes (responsive with clamp)

```css
h1 { font-size: clamp(1.5rem, 5vw, 3.5rem); }     /* 24px → 56px */
h2 { font-size: clamp(1.25rem, 3.5vw, 2.25rem); }  /* 20px → 36px */
h3 { font-size: clamp(1.125rem, 2.5vw, 1.75rem); } /* 18px → 28px */
h4 { font-size: 1.125rem; }                          /* 18px */
```

All headings use `--font-heading` (Audiowide), `color: --color-text-bright` (white), and `line-height: 1.2`.

---

## Spacing Scale

| Variable | Value | Typical Use |
|---|---|---|
| `--space-xs` | `0.25rem` (4px) | Inline gaps, tiny margins |
| `--space-sm` | `0.5rem` (8px) | Between related elements |
| `--space-md` | `1rem` (16px) | Standard spacing, form groups |
| `--space-lg` | `1.5rem` (24px) | Section padding (mobile) |
| `--space-xl` | `2rem` (32px) | Section padding (tablet) |
| `--space-2xl` | `3rem` (48px) | Section padding (desktop) |
| `--space-3xl` | `4rem` (64px) | Hero sections, large gaps |
| `--space-4xl` | `6rem` (96px) | Maximum spacing |

---

## Layout

### Containers

```html
<div class="container">             <!-- max-width: 1200px, centered -->
<div class="container container--narrow">  <!-- max-width: 800px -->
```

### Sections

```html
<section class="section">                  <!-- standard padding -->
<section class="section section--hero">    <!-- extra top padding for page heroes -->
<section class="section section--flush-top"> <!-- no top padding (follows another section) -->
```

### Grid

```html
<div class="grid grid--2col">  <!-- 1-col mobile → 2-col at 640px -->
<div class="grid grid--3col">  <!-- 1-col mobile → auto-fit at 768px → 3-col at 1024px -->
```

### Text

```html
<div class="text-center">
<p class="page-intro">  <!-- muted text, margin-top, for page descriptions -->
```

---

## Breakpoints

All CSS is **mobile-first** — base styles target 320px, then scale up:

| Breakpoint | Target | What Changes |
|---|---|---|
| Base | 320px+ (mobile) | Single column, tight padding, 56px header |
| `480px` | Larger phones | More padding, header 64px, nav label shows |
| `640px` | Small tablets | 2-column grids, footer goes 2-col |
| `768px` | Tablets | 3-column grids, header 70px, desktop nav shows, footer 4-col |
| `1024px` | Desktop | Locked 3-column grids |

---

## Components

### Buttons

```html
<button class="btn btn--primary">Start Learning</button>   <!-- pink glow CTA -->
<button class="btn btn--secondary">Calculate</button>       <!-- blue border -->
<button class="btn btn--outline">View Details</button>       <!-- grey border, de-emphasized -->
<button class="btn btn--secondary btn--block">Full Width</button>  <!-- spans container -->
<button class="btn btn--secondary btn--lg">Larger</button>         <!-- bigger padding/font -->
```

### Nav Cards (Homepage navigation)

```html
<!-- Default — blue border with glow -->
<a href="/page/" class="nav-card">
  <span class="nav-card__title">Title</span>
  <span class="nav-card__desc">Description text</span>
</a>

<!-- Primary CTA — pink border, pink glow, uppercase title -->
<a href="/page/" class="nav-card nav-card--cta">...</a>

<!-- Community — blue-colored title -->
<a href="/page/" class="nav-card nav-card--community">...</a>

<!-- Service — grey border, de-emphasized -->
<a href="/page/" class="nav-card nav-card--service">...</a>
```

Wrap nav cards in:
```html
<div class="nav-cards">  <!-- centered column, max-width 450px -->
```

### Content Cards (listing/index pages)

```html
<a href="/page/" class="card">
  <div class="card__body">
    <span class="tag tag--pink">Category</span>
    <h3 class="card__title">Card Title</h3>
    <p class="card__text">Description text</p>
  </div>
</a>
```

### Tool Panels (calculators/tools)

```html
<div class="tool-panel">
  <div class="tool-panel__header">
    <h2 class="tool-panel__title">Calculator Name</h2>
  </div>
  <!-- form/content here -->
  <div class="tool-panel__result" hidden>
    <div class="tool-panel__result-label">Result Label</div>
    <div class="tool-panel__result-value">42 AWG</div>
    <p class="tool-panel__result-detail">Additional detail text</p>
  </div>
</div>

<div class="tool-panel tool-panel--spaced">  <!-- adds margin-top -->
```

### Forms

```html
<div class="form-group">
  <label for="input" class="form-label">Label (blue)</label>
  <input type="number" id="input" class="form-input" placeholder="e.g. 100">
  <p class="form-hint">Helper text (dim)</p>
</div>

<select class="form-select">
  <option>Option</option>
</select>
```

### Tags / Badges

```html
<span class="tag">Default</span>
<span class="tag tag--blue">Blue</span>
<span class="tag tag--pink">Pink</span>
```

### Breadcrumbs

```html
<nav class="breadcrumbs" aria-label="Breadcrumb">
  <a href="/">Home</a>
  <span class="breadcrumbs__separator" aria-hidden="true">/</span>
  <a href="/section/">Section</a>
  <span class="breadcrumbs__separator" aria-hidden="true">/</span>
  <span aria-current="page">Current Page</span>
</nav>
```

### Section Labels (pink category headers)

```html
<p class="section-label section-label--pink">Build / Test / Tune</p>
<p class="section-label section-label--green">Success</p>
```

### Community Tagline

```html
<p class="community-tagline">Join 10k+ audio enthusiasts...</p>
```

---

## Accordion (design-support.css)

```html
<div class="accordion">
  <button class="accordion__btn" aria-expanded="false">Section Title</button>
  <div class="accordion__panel">
    <div class="product-grid">
      <!-- product cards or info blocks here -->
    </div>
  </div>
</div>
```

### Product Cards (inside accordions)

```html
<a href="https://..." class="product-card" target="_blank" rel="noopener">
  <span class="product-card__title">Product Name</span>
  <span class="product-card__meta">Subtitle / Specs</span>
  <span class="product-card__source">Store Name</span>
</a>
```

### Info Blocks (tips inside accordions)

```html
<div class="info-block">
  <h3>Tip Title</h3>
  <p>Helpful information here.</p>
</div>
```

---

## Article Pages (article.css)

```html
<article class="section">
  <div class="container container--narrow">
    <header class="article-header">
      <span class="tag tag--pink">Category</span>
      <h1>Article Title</h1>
    </header>

    <div class="article-body">
      <p class="article-lead">Opening paragraph with pink left border.</p>

      <h2><span class="article-section-num">1</span> Section Title</h2>
      <p>Body text...</p>

      <div class="article-callout">           <!-- pink callout box -->
        <h3>Warning/Note Title</h3>
        <p>Callout content</p>
      </div>

      <div class="article-callout article-callout--result">  <!-- blue callout box -->
        <h3>Result/Conclusion</h3>
        <p>Positive outcome content</p>
      </div>

      <ul>
        <li><strong>Bold label:</strong> Description with blue dot bullet</li>
      </ul>
    </div>

    <footer class="article-footer">
      <p>Footer content</p>
    </footer>
  </div>
</article>
```

---

## Component Tokens

| Variable | Value | Use |
|---|---|---|
| `--radius-sm` | `4px` | Buttons, inputs, tags |
| `--radius-md` | `8px` | Cards, panels, nav cards |
| `--radius-lg` | `12px` | Large elements |
| `--shadow-sm` | subtle | Small elevation |
| `--shadow-md` | medium | Tool panels |
| `--shadow-lg` | strong | Modals, overlays |
| `--transition-fast` | `150ms` | Hover color changes |
| `--transition-base` | `300ms` | Card hover transforms |
| `--transition-slow` | `400ms` | Panel animations |
| `--min-touch-target` | `44px` | Minimum button/link tap size |

---

## File Structure

```
src/assets/css/
├── variables.css        ← Design tokens (change colors/fonts here)
├── reset.css            ← CSS reset/normalize
├── global.css           ← Base styles, layout, grid, breakpoints
├── header.css           ← Sticky header, desktop/mobile nav
├── footer.css           ← 4-column footer
├── components.css       ← Buttons, cards, forms, tags, breadcrumbs
├── article.css          ← Article-specific (loaded per-page)
└── design-support.css   ← Accordion/product cards (loaded per-page)
```

**Global CSS** (loaded on every page): variables, reset, global, header, footer, components

**Page-specific CSS** (loaded only when needed via `extra_css` in page config): article, design-support
