// Property inspector. Renders editable fields for the currently selected node
// based on its component definition's schema.

import { COMPONENTS } from './components.js';
import { iconSvg } from './icons.js';

export function renderInspector(state, onChange, onDelete) {
  const root = document.getElementById('inspector-body');
  root.innerHTML = '';

  if (!state.selectedId) {
    root.innerHTML = `<div class="inspector__empty">Select a component on the canvas to edit its properties.</div>`;
    return;
  }

  const node = findNode(state.selectedId, state.root);
  if (!node) {
    root.innerHTML = `<div class="inspector__empty">No selection.</div>`;
    return;
  }

  const def = COMPONENTS[node.type];
  if (!def) return;

  const header = document.createElement('div');
  header.className = 'inspector__section';
  header.innerHTML = `<h3 class="inspector__title">${def.name} <small>${def.category}</small></h3>`;
  root.appendChild(header);

  if (def.schema.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'inspector__empty';
    empty.style.padding = '0';
    empty.style.textAlign = 'left';
    empty.textContent = 'This component has no editable properties.';
    root.appendChild(empty);
  }

  for (const field of def.schema) {
    root.appendChild(renderField(field, node.props[field.key], onChange));
  }

  // Delete button
  const actions = document.createElement('div');
  actions.className = 'inspector__section';
  const del = document.createElement('button');
  del.className = 'ds-button ds-button--ghost ds-button--md';
  del.style.width = '100%';
  del.innerHTML = `${iconSvg('trash')}<span>Delete component</span>`;
  del.addEventListener('click', () => onDelete());
  actions.appendChild(del);
  root.appendChild(actions);
}

function renderField(field, value, onChange) {
  const wrap = document.createElement('div');
  wrap.className = 'inspector__field';

  const label = document.createElement('label');
  label.textContent = field.label || field.key;
  wrap.appendChild(label);

  let input;
  switch (field.type) {
    case 'text': {
      input = document.createElement('textarea');
      input.className = 'ds-textarea';
      input.value = value ?? '';
      input.addEventListener('input', () => onChange(field.key, input.value));
      break;
    }
    case 'number': {
      input = document.createElement('input');
      input.type = 'number';
      input.className = 'ds-input';
      input.value = value ?? 0;
      input.addEventListener('input', () => {
        const n = Number(input.value);
        onChange(field.key, Number.isFinite(n) ? n : 0);
      });
      break;
    }
    case 'range': {
      input = document.createElement('input');
      input.type = 'range';
      input.min = field.min ?? 0;
      input.max = field.max ?? 100;
      input.value = value ?? 0;
      input.style.width = '100%';
      input.addEventListener('input', () => onChange(field.key, Number(input.value)));
      // Show a numeric readout next to the slider.
      const wrapInline = document.createElement('div');
      wrapInline.style.display = 'flex';
      wrapInline.style.alignItems = 'center';
      wrapInline.style.gap = '8px';
      const readout = document.createElement('span');
      readout.style.color = 'var(--ds-color-text-secondary)';
      readout.style.fontSize = 'var(--ds-fs-body2)';
      readout.style.minWidth = '32px';
      readout.textContent = String(value ?? 0);
      input.addEventListener('input', () => readout.textContent = input.value);
      wrapInline.appendChild(input);
      wrapInline.appendChild(readout);
      wrap.appendChild(wrapInline);
      return wrap;
    }
    case 'boolean': {
      // Use a styled checkbox row.
      const row = document.createElement('label');
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.gap = '8px';
      row.style.cursor = 'pointer';
      input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = !!value;
      input.addEventListener('change', () => onChange(field.key, input.checked));
      const txt = document.createElement('span');
      txt.style.color = 'var(--ds-color-text-secondary)';
      txt.style.fontSize = 'var(--ds-fs-body2)';
      txt.textContent = value ? 'On' : 'Off';
      input.addEventListener('change', () => txt.textContent = input.checked ? 'On' : 'Off');
      row.appendChild(input);
      row.appendChild(txt);
      wrap.appendChild(row);
      return wrap;
    }
    case 'select': {
      input = document.createElement('select');
      input.className = 'ds-select';
      const opts = (field.options || []).map(o => typeof o === 'string' ? { value: o, label: o } : o);
      for (const opt of opts) {
        const o = document.createElement('option');
        o.value = opt.value;
        o.textContent = opt.label;
        if (String(value) === String(opt.value)) o.selected = true;
        input.appendChild(o);
      }
      input.addEventListener('change', () => onChange(field.key, input.value));
      break;
    }
    case 'color': {
      input = document.createElement('input');
      input.type = 'color';
      input.value = value || '#000000';
      input.addEventListener('input', () => onChange(field.key, input.value));
      break;
    }
    case 'string':
    default: {
      input = document.createElement('input');
      input.type = 'text';
      input.className = 'ds-input';
      input.value = value ?? '';
      input.addEventListener('input', () => onChange(field.key, input.value));
      break;
    }
  }

  wrap.appendChild(input);
  return wrap;
}

function findNode(id, node) {
  if (node.id === id) return node;
  for (const c of node.children) {
    const r = findNode(id, c);
    if (r) return r;
  }
  return null;
}
