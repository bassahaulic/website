// Builder shell: state tree, palette wiring, drag-and-drop, selection,
// keyboard shortcuts. Re-renders the canvas whenever state changes.

import { COMPONENTS, paletteByCategory } from './components.js';
import { iconSvg } from './icons.js';
import { renderInspector } from './inspector.js';
import { openExportModal } from './export.js';

// ---- State ----
// Tree of placed nodes. Root has no type/props.
// Node shape: { id, type, props, children: [] }
let nextId = 1;
const newId = () => `n${nextId++}`;

const state = {
  root: { id: 'root', type: null, props: {}, children: [] },
  selectedId: null,
  // Drag payload — what we're currently dragging (either a fresh palette item
  // or an existing tree node to move).
  drag: null,
};

// Lookups
function findNode(id, node = state.root, parent = null) {
  if (node.id === id) return { node, parent };
  for (const child of node.children) {
    const r = findNode(id, child, node);
    if (r) return r;
  }
  return null;
}
function removeNode(id) {
  const found = findNode(id);
  if (!found || !found.parent) return null;
  const idx = found.parent.children.indexOf(found.node);
  if (idx >= 0) found.parent.children.splice(idx, 1);
  return found.node;
}

// ---- Rendering ----
const $canvas = () => document.getElementById('canvas');
const $palette = () => document.getElementById('palette');
const $inspector = () => document.getElementById('inspector-body');

function render() {
  const root = $canvas();
  root.innerHTML = '';
  for (const child of state.root.children) {
    root.appendChild(renderNode(child));
  }
  // Mark root canvas as a drop target
  attachDropTarget(root, state.root);
  renderInspector(state, applyPropChange, deleteSelected);
}

function renderNode(node) {
  const def = COMPONENTS[node.type];
  if (!def) return document.createComment(`unknown:${node.type}`);
  const inner = def.render(node.props);

  // Wrap in a selectable shell. Block-level layout via display:block on the wrap.
  const wrap = document.createElement('div');
  wrap.className = 'placed-wrap';
  wrap.dataset.id = node.id;
  wrap.dataset.type = def.name;
  if (state.selectedId === node.id) wrap.classList.add('is-selected');

  wrap.appendChild(inner);

  // Container slot: recursively render children into it.
  if (def.container) {
    const slot = inner.querySelector('.ds-container-content');
    for (const child of node.children) {
      slot.appendChild(renderNode(child));
    }
    attachDropTarget(slot, node);
  }

  // Selection handling
  wrap.addEventListener('click', (e) => {
    e.stopPropagation();
    selectNode(node.id);
  });

  // Make the wrap draggable for moves.
  wrap.draggable = true;
  wrap.addEventListener('dragstart', (e) => {
    e.stopPropagation();
    state.drag = { kind: 'move', id: node.id };
    e.dataTransfer.effectAllowed = 'move';
    // Some browsers need data set to start the drag.
    e.dataTransfer.setData('text/plain', node.id);
  });
  wrap.addEventListener('dragend', () => { state.drag = null; clearDropHints(); });

  return wrap;
}

function attachDropTarget(el, parentNode) {
  el.addEventListener('dragover', (e) => {
    if (!state.drag) return;
    // Don't allow dropping a node into its own descendant.
    if (state.drag.kind === 'move' && isDescendant(state.drag.id, parentNode.id)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = state.drag.kind === 'move' ? 'move' : 'copy';
    clearDropHints();
    el.classList.add('is-drop-target');
  });
  el.addEventListener('dragleave', (e) => {
    if (e.target === el) el.classList.remove('is-drop-target');
  });
  el.addEventListener('drop', (e) => {
    if (!state.drag) return;
    e.preventDefault();
    e.stopPropagation();
    el.classList.remove('is-drop-target');
    handleDrop(parentNode, e);
  });
}

function isDescendant(ancestorId, candidateId) {
  if (ancestorId === candidateId) return true;
  const found = findNode(ancestorId);
  if (!found) return false;
  const stack = [...found.node.children];
  while (stack.length) {
    const n = stack.pop();
    if (n.id === candidateId) return true;
    stack.push(...n.children);
  }
  return false;
}

function handleDrop(parentNode, _e) {
  if (state.drag.kind === 'palette') {
    const def = COMPONENTS[state.drag.type];
    if (!def) return;
    const node = {
      id: newId(),
      type: def.id,
      props: structuredClone(def.defaults),
      children: [],
    };
    parentNode.children.push(node);
    state.selectedId = node.id;
  } else if (state.drag.kind === 'move') {
    const node = removeNode(state.drag.id);
    if (node) {
      parentNode.children.push(node);
      state.selectedId = node.id;
    }
  }
  state.drag = null;
  render();
}

function clearDropHints() {
  document.querySelectorAll('.is-drop-target').forEach(el => el.classList.remove('is-drop-target'));
}

function selectNode(id) {
  state.selectedId = id;
  render();
}

function applyPropChange(key, value) {
  if (!state.selectedId) return;
  const found = findNode(state.selectedId);
  if (!found) return;
  found.node.props[key] = value;
  render();
}

function deleteSelected() {
  if (!state.selectedId) return;
  removeNode(state.selectedId);
  state.selectedId = null;
  render();
}

// ---- Palette ----
function buildPalette() {
  const root = $palette();
  const grouped = paletteByCategory();
  for (const cat of Object.keys(grouped)) {
    const items = grouped[cat];
    if (!items.length) continue;
    const section = document.createElement('div');
    section.className = 'palette__category';
    const title = document.createElement('div');
    title.className = 'palette__category-title';
    title.textContent = cat;
    section.appendChild(title);
    const grid = document.createElement('div');
    grid.className = 'palette__grid';
    for (const c of items) {
      const item = document.createElement('div');
      item.className = 'palette-item';
      item.draggable = true;
      item.dataset.type = c.id;
      item.innerHTML = `
        <span class="palette-item__icon">${iconSvg(c.paletteIcon || 'plus')}</span>
        <span class="palette-item__label">${c.name}</span>`;
      item.addEventListener('dragstart', (e) => {
        state.drag = { kind: 'palette', type: c.id };
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('text/plain', c.id);
      });
      item.addEventListener('dragend', () => { state.drag = null; clearDropHints(); });
      grid.appendChild(item);
    }
    section.appendChild(grid);
    root.appendChild(section);
  }
}

// ---- Topbar wiring ----
function bindTopbar() {
  document.getElementById('btn-clear').addEventListener('click', () => {
    if (state.root.children.length === 0) return;
    if (!confirm('Clear the entire canvas?')) return;
    state.root.children = [];
    state.selectedId = null;
    render();
  });
  document.getElementById('btn-export').addEventListener('click', () => {
    openExportModal(state.root);
  });
  document.getElementById('btn-theme').addEventListener('click', toggleTheme);
  document.getElementById('btn-sample').addEventListener('click', loadSample);
}

function toggleTheme() {
  const html = document.documentElement;
  const next = html.dataset.theme === 'light' ? 'dark' : 'light';
  if (next === 'light') html.dataset.theme = 'light';
  else delete html.dataset.theme;
  document.getElementById('btn-theme').innerHTML = next === 'light' ? iconSvg('moon') : iconSvg('sun');
}

// ---- Keyboard ----
function bindKeyboard() {
  document.addEventListener('keydown', (e) => {
    // Ignore typing in inputs/textareas/contenteditable.
    const t = e.target;
    const tag = (t.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || t.isContentEditable) return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedId) {
      e.preventDefault();
      deleteSelected();
    }
    if (e.key === 'Escape') {
      state.selectedId = null;
      render();
    }
  });
}

// ---- Sample (so the empty canvas isn't a brick wall on first run) ----
function loadSample() {
  const make = (type, props = {}, children = []) => ({
    id: newId(),
    type,
    props: { ...structuredClone(COMPONENTS[type].defaults), ...props },
    children,
  });
  state.root.children = [
    make('card', { title: 'Welcome to the GUI Builder' }, [
      make('text', { variant: 'body1', content: 'Drag components from the left, click to edit on the right.' }),
      make('text', { variant: 'caption', content: 'Tip: panels and cards are nestable drop zones.' }),
    ]),
    make('panel', {}, [
      make('text', { variant: 'h3', content: 'Profile' }),
      make('input', { label: 'Display name', placeholder: 'e.g. Ada Lovelace', value: '' }),
      make('input', { label: 'Email', placeholder: 'you@example.com', value: '', type: 'email' }),
      make('toggle', { label: 'Notify me by email', on: true }),
      make('divider'),
      make('button', { label: 'Save changes', variant: 'primary', size: 'md' }),
    ]),
  ];
  state.selectedId = null;
  render();
}

// ---- Boot ----
document.addEventListener('DOMContentLoaded', () => {
  buildPalette();
  bindTopbar();
  bindKeyboard();
  // Initialize the theme button icon.
  document.getElementById('btn-theme').innerHTML = iconSvg('sun');
  render();
});
