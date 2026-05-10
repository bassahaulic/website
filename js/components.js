// Component registry. Each component definition is the single source of truth
// for: how it renders in the canvas, what fields the inspector shows, and how
// it serializes to clean HTML on export.
//
// Schema field types: string | text | number | boolean | select | color | range
// For 'select', pass `options: ['a','b']` (or `[{value, label}]`).
// `container: true` makes the component a drop target with children.

import { iconSvg, ICONS } from './icons.js';

const ICON_NAMES = Object.keys(ICONS);

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

// Render an SVG icon into an inline element with the given className.
function iconEl(name, className = 'ds-icon') {
  const span = document.createElement('span');
  span.className = className;
  span.innerHTML = iconSvg(name);
  return span;
}
function iconHTML(name, className = 'ds-icon') {
  return `<span class="${className}">${iconSvg(name)}</span>`;
}

export const CATEGORIES = ['Typography', 'Buttons', 'Inputs', 'Selection', 'Feedback', 'Display', 'Layout'];

export const COMPONENTS = {
  text: {
    id: 'text',
    name: 'Text',
    category: 'Typography',
    paletteIcon: 'list',
    defaults: { content: 'The quick brown fox', variant: 'body1' },
    schema: [
      { key: 'content', type: 'text', label: 'Content' },
      { key: 'variant', type: 'select', label: 'Variant',
        options: ['h1','h2','h3','body1','body2','caption'] },
    ],
    render(p) {
      const tag = p.variant === 'h1' ? 'h1'
        : p.variant === 'h2' ? 'h2'
        : p.variant === 'h3' ? 'h3'
        : p.variant === 'caption' ? 'span'
        : 'p';
      const el = document.createElement(tag);
      el.className = `ds-text ds-text--${p.variant}`;
      el.textContent = p.content;
      return el;
    },
    toHTML(p) {
      const tag = p.variant === 'h1' ? 'h1'
        : p.variant === 'h2' ? 'h2'
        : p.variant === 'h3' ? 'h3'
        : p.variant === 'caption' ? 'span' : 'p';
      return `<${tag} class="ds-text ds-text--${p.variant}">${escapeHtml(p.content)}</${tag}>`;
    },
  },

  button: {
    id: 'button',
    name: 'Button',
    category: 'Buttons',
    paletteIcon: 'plus',
    defaults: { label: 'Button', variant: 'primary', size: 'md', disabled: false },
    schema: [
      { key: 'label', type: 'string', label: 'Label' },
      { key: 'variant', type: 'select', label: 'Variant',
        options: ['primary','secondary','tertiary','ghost','danger'] },
      { key: 'size', type: 'select', label: 'Size', options: ['sm','md','lg'] },
      { key: 'disabled', type: 'boolean', label: 'Disabled' },
    ],
    render(p) {
      const el = document.createElement('button');
      el.className = `ds-button ds-button--${p.variant} ds-button--${p.size}`;
      el.textContent = p.label;
      el.disabled = !!p.disabled;
      return el;
    },
    toHTML(p) {
      const dis = p.disabled ? ' disabled' : '';
      return `<button class="ds-button ds-button--${p.variant} ds-button--${p.size}"${dis}>${escapeHtml(p.label)}</button>`;
    },
  },

  iconbutton: {
    id: 'iconbutton',
    name: 'Icon Button',
    category: 'Buttons',
    paletteIcon: 'edit',
    defaults: { icon: 'edit', variant: 'default' },
    schema: [
      { key: 'icon', type: 'select', label: 'Icon', options: ICON_NAMES },
      { key: 'variant', type: 'select', label: 'Variant', options: ['default','accent','danger'] },
    ],
    render(p) {
      const el = document.createElement('button');
      el.className = 'ds-iconbutton' + (p.variant !== 'default' ? ` ds-iconbutton--${p.variant}` : '');
      el.innerHTML = iconSvg(p.icon);
      return el;
    },
    toHTML(p) {
      const v = p.variant !== 'default' ? ` ds-iconbutton--${p.variant}` : '';
      return `<button class="ds-iconbutton${v}">${iconSvg(p.icon)}</button>`;
    },
  },

  input: {
    id: 'input',
    name: 'Input',
    category: 'Inputs',
    paletteIcon: 'edit',
    defaults: { label: '', placeholder: 'Type here…', value: '', type: 'text' },
    schema: [
      { key: 'label', type: 'string', label: 'Label (optional)' },
      { key: 'placeholder', type: 'string', label: 'Placeholder' },
      { key: 'value', type: 'string', label: 'Value' },
      { key: 'type', type: 'select', label: 'Type', options: ['text','email','password','number'] },
    ],
    render(p) {
      const wrap = document.createElement('div');
      wrap.className = 'ds-field';
      if (p.label) {
        const lab = document.createElement('label');
        lab.textContent = p.label;
        wrap.appendChild(lab);
      }
      const inp = document.createElement('input');
      inp.className = 'ds-input';
      inp.type = p.type;
      inp.placeholder = p.placeholder;
      inp.value = p.value;
      wrap.appendChild(inp);
      return wrap;
    },
    toHTML(p) {
      const lab = p.label ? `\n  <label>${escapeHtml(p.label)}</label>` : '';
      return `<div class="ds-field">${lab}\n  <input class="ds-input" type="${p.type}" placeholder="${escapeHtml(p.placeholder)}" value="${escapeHtml(p.value)}">\n</div>`;
    },
  },

  search: {
    id: 'search',
    name: 'Search',
    category: 'Inputs',
    paletteIcon: 'search',
    defaults: { placeholder: 'Search…' },
    schema: [
      { key: 'placeholder', type: 'string', label: 'Placeholder' },
    ],
    render(p) {
      const wrap = document.createElement('div');
      wrap.className = 'ds-input-search';
      wrap.innerHTML = `${iconSvg('search')}<input class="ds-input" type="search" placeholder="${escapeHtml(p.placeholder)}">`;
      return wrap;
    },
    toHTML(p) {
      return `<div class="ds-input-search">${iconSvg('search')}<input class="ds-input" type="search" placeholder="${escapeHtml(p.placeholder)}"></div>`;
    },
  },

  textarea: {
    id: 'textarea',
    name: 'Textarea',
    category: 'Inputs',
    paletteIcon: 'list',
    defaults: { placeholder: 'Notes…', value: '' },
    schema: [
      { key: 'placeholder', type: 'string', label: 'Placeholder' },
      { key: 'value', type: 'text', label: 'Value' },
    ],
    render(p) {
      const t = document.createElement('textarea');
      t.className = 'ds-textarea';
      t.placeholder = p.placeholder;
      t.value = p.value;
      return t;
    },
    toHTML(p) {
      return `<textarea class="ds-textarea" placeholder="${escapeHtml(p.placeholder)}">${escapeHtml(p.value)}</textarea>`;
    },
  },

  select: {
    id: 'select',
    name: 'Select',
    category: 'Inputs',
    paletteIcon: 'arrowDown',
    defaults: { label: '', options: 'Option A\nOption B\nOption C' },
    schema: [
      { key: 'label', type: 'string', label: 'Label (optional)' },
      { key: 'options', type: 'text', label: 'Options (one per line)' },
    ],
    render(p) {
      const wrap = document.createElement('div');
      wrap.className = 'ds-field';
      if (p.label) {
        const lab = document.createElement('label');
        lab.textContent = p.label;
        wrap.appendChild(lab);
      }
      const sel = document.createElement('select');
      sel.className = 'ds-select';
      String(p.options || '').split('\n').filter(Boolean).forEach(opt => {
        const o = document.createElement('option');
        o.textContent = opt.trim();
        sel.appendChild(o);
      });
      wrap.appendChild(sel);
      return wrap;
    },
    toHTML(p) {
      const lab = p.label ? `\n  <label>${escapeHtml(p.label)}</label>` : '';
      const opts = String(p.options || '').split('\n').filter(Boolean)
        .map(o => `    <option>${escapeHtml(o.trim())}</option>`).join('\n');
      return `<div class="ds-field">${lab}\n  <select class="ds-select">\n${opts}\n  </select>\n</div>`;
    },
  },

  toggle: {
    id: 'toggle',
    name: 'Toggle',
    category: 'Selection',
    paletteIcon: 'check',
    defaults: { label: 'Toggle option', on: true },
    schema: [
      { key: 'label', type: 'string', label: 'Label' },
      { key: 'on', type: 'boolean', label: 'On' },
    ],
    render(p) {
      const wrap = document.createElement('label');
      wrap.className = 'ds-toggle' + (p.on ? ' is-on' : '');
      wrap.innerHTML = `<span class="ds-toggle__track"><span class="ds-toggle__thumb"></span></span><span>${escapeHtml(p.label)}</span>`;
      return wrap;
    },
    toHTML(p) {
      const on = p.on ? ' is-on' : '';
      return `<label class="ds-toggle${on}"><span class="ds-toggle__track"><span class="ds-toggle__thumb"></span></span><span>${escapeHtml(p.label)}</span></label>`;
    },
  },

  checkbox: {
    id: 'checkbox',
    name: 'Checkbox',
    category: 'Selection',
    paletteIcon: 'check',
    defaults: { label: 'Checkbox option', on: true },
    schema: [
      { key: 'label', type: 'string', label: 'Label' },
      { key: 'on', type: 'boolean', label: 'Checked' },
    ],
    render(p) {
      const wrap = document.createElement('label');
      wrap.className = 'ds-check' + (p.on ? ' is-on' : '');
      wrap.innerHTML = `<span class="ds-check__box"></span><span>${escapeHtml(p.label)}</span>`;
      return wrap;
    },
    toHTML(p) {
      const on = p.on ? ' is-on' : '';
      return `<label class="ds-check${on}"><span class="ds-check__box"></span><span>${escapeHtml(p.label)}</span></label>`;
    },
  },

  radio: {
    id: 'radio',
    name: 'Radio',
    category: 'Selection',
    paletteIcon: 'check',
    defaults: { label: 'Radio option', on: false },
    schema: [
      { key: 'label', type: 'string', label: 'Label' },
      { key: 'on', type: 'boolean', label: 'Selected' },
    ],
    render(p) {
      const wrap = document.createElement('label');
      wrap.className = 'ds-radio' + (p.on ? ' is-on' : '');
      wrap.innerHTML = `<span class="ds-radio__dot"></span><span>${escapeHtml(p.label)}</span>`;
      return wrap;
    },
    toHTML(p) {
      const on = p.on ? ' is-on' : '';
      return `<label class="ds-radio${on}"><span class="ds-radio__dot"></span><span>${escapeHtml(p.label)}</span></label>`;
    },
  },

  slider: {
    id: 'slider',
    name: 'Slider',
    category: 'Feedback',
    paletteIcon: 'minus',
    defaults: { value: 50, min: 0, max: 100 },
    schema: [
      { key: 'value', type: 'number', label: 'Value' },
      { key: 'min',   type: 'number', label: 'Min' },
      { key: 'max',   type: 'number', label: 'Max' },
    ],
    render(p) {
      const wrap = document.createElement('div');
      wrap.className = 'ds-slider';
      wrap.innerHTML = `<input type="range" min="${p.min}" max="${p.max}" value="${p.value}">`;
      return wrap;
    },
    toHTML(p) {
      return `<div class="ds-slider"><input type="range" min="${p.min}" max="${p.max}" value="${p.value}"></div>`;
    },
  },

  progress: {
    id: 'progress',
    name: 'Progress',
    category: 'Feedback',
    paletteIcon: 'minus',
    defaults: { value: 65 },
    schema: [
      { key: 'value', type: 'range', label: 'Progress (%)', min: 0, max: 100 },
    ],
    render(p) {
      const wrap = document.createElement('div');
      wrap.className = 'ds-progress';
      const fill = document.createElement('div');
      fill.className = 'ds-progress__fill';
      fill.style.width = `${Math.max(0, Math.min(100, p.value))}%`;
      wrap.appendChild(fill);
      return wrap;
    },
    toHTML(p) {
      const v = Math.max(0, Math.min(100, p.value));
      return `<div class="ds-progress"><div class="ds-progress__fill" style="width:${v}%"></div></div>`;
    },
  },

  badge: {
    id: 'badge',
    name: 'Badge',
    category: 'Display',
    paletteIcon: 'star',
    defaults: { label: 'Rare', variant: 'rare' },
    schema: [
      { key: 'label', type: 'string', label: 'Label' },
      { key: 'variant', type: 'select', label: 'Variant',
        options: ['common','rare','epic','legendary','success','warning','danger','primary'] },
    ],
    render(p) {
      const el = document.createElement('span');
      const isPrimary = p.variant === 'primary';
      el.className = 'ds-badge' + (isPrimary ? '' : ` ds-badge--${p.variant}`);
      el.textContent = p.label;
      return el;
    },
    toHTML(p) {
      const isPrimary = p.variant === 'primary';
      const cls = 'ds-badge' + (isPrimary ? '' : ` ds-badge--${p.variant}`);
      return `<span class="${cls}">${escapeHtml(p.label)}</span>`;
    },
  },

  pill: {
    id: 'pill',
    name: 'Pill',
    category: 'Display',
    paletteIcon: 'plus',
    defaults: { label: 'New', icon: 'star' },
    schema: [
      { key: 'label', type: 'string', label: 'Label' },
      { key: 'icon', type: 'select', label: 'Icon (or "none")', options: ['none', ...ICON_NAMES] },
    ],
    render(p) {
      const el = document.createElement('span');
      el.className = 'ds-pill';
      const ico = (p.icon && p.icon !== 'none') ? `<span class="ds-icon" style="width:14px;height:14px">${iconSvg(p.icon)}</span>` : '';
      el.innerHTML = `${ico}<span>${escapeHtml(p.label)}</span>`;
      return el;
    },
    toHTML(p) {
      const ico = (p.icon && p.icon !== 'none') ? `<span class="ds-icon" style="width:14px;height:14px">${iconSvg(p.icon)}</span>` : '';
      return `<span class="ds-pill">${ico}<span>${escapeHtml(p.label)}</span></span>`;
    },
  },

  icon: {
    id: 'icon',
    name: 'Icon',
    category: 'Display',
    paletteIcon: 'star',
    defaults: { name: 'star', variant: 'default' },
    schema: [
      { key: 'name', type: 'select', label: 'Icon', options: ICON_NAMES },
      { key: 'variant', type: 'select', label: 'Color', options: ['default','accent','danger','warning'] },
    ],
    render(p) {
      const el = document.createElement('span');
      el.className = 'ds-icon' + (p.variant !== 'default' ? ` ds-icon--${p.variant}` : '');
      el.innerHTML = iconSvg(p.name);
      return el;
    },
    toHTML(p) {
      const v = p.variant !== 'default' ? ` ds-icon--${p.variant}` : '';
      return `<span class="ds-icon${v}">${iconSvg(p.name)}</span>`;
    },
  },

  divider: {
    id: 'divider',
    name: 'Divider',
    category: 'Display',
    paletteIcon: 'minus',
    defaults: {},
    schema: [],
    render() {
      return document.createElement('hr');
    },
    toHTML() { return `<hr class="ds-divider">`; },
    classOverride: 'ds-divider',
  },

  panel: {
    id: 'panel',
    name: 'Panel',
    category: 'Layout',
    paletteIcon: 'grid',
    container: true,
    defaults: {},
    schema: [],
    render() {
      const el = document.createElement('div');
      el.className = 'ds-panel';
      const slot = document.createElement('div');
      slot.className = 'ds-container-content';
      el.appendChild(slot);
      return el;
    },
    toHTML(_p, childrenHTML) {
      return `<div class="ds-panel">\n${indent(childrenHTML)}\n</div>`;
    },
  },

  card: {
    id: 'card',
    name: 'Card',
    category: 'Layout',
    paletteIcon: 'grid',
    container: true,
    defaults: { title: 'Card title' },
    schema: [
      { key: 'title', type: 'string', label: 'Title' },
    ],
    render(p) {
      const el = document.createElement('div');
      el.className = 'ds-card';
      const t = document.createElement('div');
      t.className = 'ds-card__title';
      t.textContent = p.title;
      el.appendChild(t);
      const slot = document.createElement('div');
      slot.className = 'ds-container-content';
      el.appendChild(slot);
      return el;
    },
    toHTML(p, childrenHTML) {
      return `<div class="ds-card">\n  <div class="ds-card__title">${escapeHtml(p.title)}</div>\n${indent(childrenHTML)}\n</div>`;
    },
  },

  modal: {
    id: 'modal',
    name: 'Modal',
    category: 'Layout',
    paletteIcon: 'grid',
    defaults: {
      title: 'Confirm action',
      body: 'Are you sure you want to proceed? This cannot be undone.',
      confirmLabel: 'Confirm',
      cancelLabel: 'Cancel',
    },
    schema: [
      { key: 'title', type: 'string', label: 'Title' },
      { key: 'body',  type: 'text',   label: 'Body' },
      { key: 'cancelLabel',  type: 'string', label: 'Cancel label' },
      { key: 'confirmLabel', type: 'string', label: 'Confirm label' },
    ],
    render(p) {
      const el = document.createElement('div');
      el.className = 'ds-modal';
      el.innerHTML = `
        <div class="ds-modal__title">${escapeHtml(p.title)}</div>
        <div class="ds-modal__body">${escapeHtml(p.body)}</div>
        <div class="ds-modal__actions">
          <button class="ds-button ds-button--ghost ds-button--md">${escapeHtml(p.cancelLabel)}</button>
          <button class="ds-button ds-button--primary ds-button--md">${escapeHtml(p.confirmLabel)}</button>
        </div>`;
      return el;
    },
    toHTML(p) {
      return `<div class="ds-modal">
  <div class="ds-modal__title">${escapeHtml(p.title)}</div>
  <div class="ds-modal__body">${escapeHtml(p.body)}</div>
  <div class="ds-modal__actions">
    <button class="ds-button ds-button--ghost ds-button--md">${escapeHtml(p.cancelLabel)}</button>
    <button class="ds-button ds-button--primary ds-button--md">${escapeHtml(p.confirmLabel)}</button>
  </div>
</div>`;
    },
  },
};

function indent(s, n = 2) {
  const pad = ' '.repeat(n);
  return String(s || '').split('\n').map(l => l ? pad + l : l).join('\n');
}

export function paletteByCategory() {
  const grouped = {};
  for (const cat of CATEGORIES) grouped[cat] = [];
  for (const id of Object.keys(COMPONENTS)) {
    const c = COMPONENTS[id];
    grouped[c.category]?.push(c);
  }
  return grouped;
}
