/**
 * palette.js
 * Left panel: searchable, categorised component list. Items are draggable
 * onto the canvas and double-clickable to append at the end.
 */

import { COMPONENTS, CATEGORY_ORDER } from './components.js';
import { makePaletteItemDraggable } from './dragdrop.js';
import { store } from './state.js';

const collapsedCats = new Set();

// Categories that make no sense as list-view columns.
const HIDDEN_IN_LIST_MODE = new Set(['Blocks', 'Structure', 'Editor']);

export function renderPalette(filter = '') {
  const root = document.getElementById('palette');
  root.innerHTML = '';
  const q = filter.trim().toLowerCase();
  const isList = (store.project.templateType || 'page') === 'list';

  let any = false;
  CATEGORY_ORDER.forEach((cat) => {
    if (isList && HIDDEN_IN_LIST_MODE.has(cat)) return;
    const items = COMPONENTS.filter((c) => c.category === cat
      && (!q || c.label.toLowerCase().includes(q)
          || (c.realType || c.type).toLowerCase().includes(q)
          || cat.toLowerCase().includes(q)));
    if (!items.length) return;
    any = true;

    const catEl = document.createElement('div');
    catEl.className = 'palette-cat' + (collapsedCats.has(cat) && !q ? ' collapsed' : '');

    const header = document.createElement('button');
    header.className = 'palette-cat-header';
    header.innerHTML = `<svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg><span>${cat}</span>`;
    header.addEventListener('click', () => {
      if (collapsedCats.has(cat)) collapsedCats.delete(cat); else collapsedCats.add(cat);
      catEl.classList.toggle('collapsed');
    });
    catEl.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'palette-items';
    items.forEach((c) => {
      const item = document.createElement('div');
      item.className = 'palette-item';
      item.title = c.help || c.label;
      item.innerHTML = `${c.icon}
        <span class="pi-label">${c.label}</span>
        <span class="pi-type">${c.realType || (c.type === 'custom' ? 'custom' : c.type)}</span>`;
      makePaletteItemDraggable(item, c.type);
      item.addEventListener('dblclick', () => {
        store.addComponent(c.type, 'root', null);
      });
      grid.appendChild(item);
    });
    catEl.appendChild(grid);
    root.appendChild(catEl);
  });

  if (!any) {
    const empty = document.createElement('div');
    empty.className = 'palette-empty';
    empty.textContent = `No components match “${filter}”.`;
    root.appendChild(empty);
  }
}

export function initPalette() {
  const search = document.getElementById('palette-search');
  search.addEventListener('input', () => renderPalette(search.value));
  renderPalette();
}
