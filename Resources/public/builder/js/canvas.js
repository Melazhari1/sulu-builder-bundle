/**
 * canvas.js
 * Center panel: renders the project tree as page-builder cards with
 * drop zones, resize handles, block type tabs and the breadcrumb.
 */

import { store } from './state.js';
import { attachDropZone, makeNodeDraggable, attachResizeHandle } from './dragdrop.js';
import { findComponent, ICONS, listSettings, contentTypeToListType } from './components.js';

let currentIssues = [];

const ACTIONS = {
  duplicate: '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  delete: '<svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M10 11v6M14 11v6"/></svg>',
  collapse: '<svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>',
};

function nodeLabel(node) {
  return (node.label && (node.label.en || Object.values(node.label)[0])) || node.name || node.type;
}

function nodeIcon(node) {
  const def = findComponent(node.paletteType) || null;
  if (def) return def.icon;
  if (node.kind === 'block') return ICONS.block;
  if (node.kind === 'section') return ICONS.section;
  return ICONS.custom;
}

function nodeHasError(nodeId) {
  return currentIssues.some((i) => i.nodeId === nodeId && i.severity === 'error');
}

function actionButtons(node, { collapsible = false } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'field-actions';

  if (collapsible) {
    const btn = mkBtn(ACTIONS.collapse, node.collapsed ? 'Expand' : 'Collapse', 'collapse-btn');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      store.updateNode(node.id, { collapsed: !node.collapsed }, { record: false });
    });
    wrap.appendChild(btn);
  }

  const dup = mkBtn(ACTIONS.duplicate, 'Duplicate (Ctrl+D)');
  dup.addEventListener('click', (e) => { e.stopPropagation(); store.duplicateNode(node.id); });
  wrap.appendChild(dup);

  const del = mkBtn(ACTIONS.delete, 'Delete (Del)', 'danger');
  del.addEventListener('click', (e) => { e.stopPropagation(); store.removeNode(node.id); });
  wrap.appendChild(del);

  return wrap;
}

function mkBtn(svg, title, extraClass = '') {
  const b = document.createElement('button');
  b.className = 'fa-btn ' + extraClass;
  b.title = title;
  b.innerHTML = svg;
  return b;
}

function selectOnClick(el, nodeId) {
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    store.select(nodeId);
  });
}

/* ------------------------------------------------------------ field card */

function renderPropertyCard(node) {
  const card = document.createElement('div');
  card.className = 'field-card'
    + (store.selectedId === node.id ? ' selected' : '')
    + (nodeHasError(node.id) ? ' has-error' : '');

  const def = findComponent(node.paletteType);
  const isList = (store.project.templateType || 'page') === 'list';
  let metaText;
  if (isList) {
    const l = listSettings(node);
    metaText = `${escapeHtml(node.name)} · ${escapeHtml(l.type || contentTypeToListType(node.type) || 'string')} column`
      + (l.visibility ? ` · ${escapeHtml(l.visibility)}` : '');
  } else {
    metaText = `${escapeHtml(node.name)} · ${escapeHtml(node.type)}${node.mandatory ? '<span class="req">*</span>' : ''}`;
  }
  const head = document.createElement('div');
  head.className = 'field-head';
  head.innerHTML = `
    <div class="field-icon">${nodeIcon(node)}</div>
    <div class="field-titles">
      <div class="field-label">${escapeHtml(nodeLabel(node))}</div>
      <div class="field-meta">${metaText}</div>
    </div>`;
  head.appendChild(actionButtons(node));
  card.appendChild(head);

  const previewKind = def ? def.preview : 'input';
  if (previewKind) {
    const prev = document.createElement('div');
    prev.className = 'field-preview';
    if (previewKind === 'input') prev.innerHTML = '<div class="fp-input"></div>';
    else if (previewKind === 'area') prev.innerHTML = '<div class="fp-input fp-area"></div>';
    else if (previewKind === 'media') prev.innerHTML = `<div class="fp-input fp-media">${nodeIcon(node)}</div>`;
    card.appendChild(prev);
  }

  return card;
}

/* ------------------------------------------------------------ block card */

function renderBlockCard(node) {
  const card = document.createElement('div');
  card.className = 'block-card'
    + (store.selectedId === node.id ? ' selected' : '')
    + (node.collapsed ? ' collapsed' : '')
    + (nodeHasError(node.id) ? ' has-error' : '');

  const head = document.createElement('div');
  head.className = 'block-head';
  const occurs = (node.minOccurs !== '' || node.maxOccurs !== '')
    ? `<span class="occurs-badge">${node.minOccurs || '0'}…${node.maxOccurs || '∞'}</span>` : '';
  head.innerHTML = `
    <div class="field-icon">${ICONS.block}</div>
    <div class="field-titles">
      <div class="field-label">${escapeHtml(nodeLabel(node))}</div>
      <div class="field-meta">${escapeHtml(node.name)} · block · ${node.types.length} type${node.types.length > 1 ? 's' : ''}</div>
    </div>
    ${occurs}`;
  head.appendChild(actionButtons(node, { collapsible: true }));
  card.appendChild(head);

  const body = document.createElement('div');
  body.className = 'block-body';

  /* type tabs */
  const tabs = document.createElement('div');
  tabs.className = 'block-type-tabs';
  const activeIdx = store.getActiveBlockType(node.id);
  node.types.forEach((t, i) => {
    const tab = document.createElement('button');
    tab.className = 'block-type-tab' + (i === activeIdx ? ' active' : '');
    tab.innerHTML = `${escapeHtml(t.title.en || Object.values(t.title)[0] || t.name)}`
      + (node.defaultType === t.name ? ' <span class="default-star" title="default type">★</span>' : '');
    tab.title = `Block type "${t.name}"` + (node.defaultType === t.name ? ' (default)' : '');
    tab.addEventListener('click', (e) => {
      e.stopPropagation();
      store.setActiveBlockType(node.id, i);
      store.select(node.id);
    });
    tabs.appendChild(tab);
  });
  const addTab = document.createElement('button');
  addTab.className = 'block-type-add';
  addTab.title = 'Add block type';
  addTab.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>';
  addTab.addEventListener('click', (e) => { e.stopPropagation(); store.addBlockType(node.id); });
  tabs.appendChild(addTab);
  body.appendChild(tabs);

  /* active type drop zone */
  const zoneWrap = document.createElement('div');
  zoneWrap.className = 'block-type-zone';
  zoneWrap.appendChild(renderDropZone(node.types[activeIdx].children, `blk:${node.id}:${activeIdx}`,
    'Drop fields into this block type'));
  body.appendChild(zoneWrap);

  card.appendChild(body);
  return card;
}

/* ---------------------------------------------------------- section card */

function renderSectionCard(node) {
  const card = document.createElement('div');
  card.className = 'section-card'
    + (store.selectedId === node.id ? ' selected' : '')
    + (node.collapsed ? ' collapsed' : '')
    + (nodeHasError(node.id) ? ' has-error' : '');

  const head = document.createElement('div');
  head.className = 'section-head';
  head.innerHTML = `
    <div class="field-icon">${ICONS.section}</div>
    <div class="field-titles">
      <div class="field-label">${escapeHtml(nodeLabel(node))}</div>
      <div class="field-meta">${escapeHtml(node.name)} · section</div>
    </div>`;
  head.appendChild(actionButtons(node, { collapsible: true }));
  card.appendChild(head);

  const body = document.createElement('div');
  body.className = 'section-body';
  body.appendChild(renderDropZone(node.children, 'sec:' + node.id, 'Drop fields into this section'));
  card.appendChild(body);
  return card;
}

/* ------------------------------------------------------------- drop zone */

function renderDropZone(list, containerId, emptyText) {
  const zone = document.createElement('div');
  zone.className = 'drop-zone';
  zone.dataset.container = containerId;

  if (!list.length) {
    const empty = document.createElement('div');
    empty.className = 'drop-zone-empty';
    empty.textContent = emptyText;
    zone.appendChild(empty);
  }

  list.forEach((node) => {
    const wrap = document.createElement('div');
    wrap.className = 'field-wrap';
    const colspan = Number(node.colspan) || 12;
    wrap.dataset.colspan = String([3, 4, 6, 8, 9, 12].includes(colspan) ? colspan : 12);
    if (![3, 4, 6, 8, 9, 12].includes(colspan)) wrap.style.width = (colspan / 12 * 100) + '%';

    let card;
    if (node.kind === 'block') card = renderBlockCard(node);
    else if (node.kind === 'section') card = renderSectionCard(node);
    else card = renderPropertyCard(node);

    selectOnClick(card, node.id);
    makeNodeDraggable(card, node.id);
    wrap.appendChild(card);

    /* width badge + resize handle */
    const badge = document.createElement('span');
    badge.className = 'width-badge';
    badge.textContent = Math.round((Number(wrap.dataset.colspan) / 12) * 100) + '%';
    wrap.appendChild(badge);

    const handle = document.createElement('div');
    handle.className = 'resize-handle';
    handle.title = 'Drag to resize (snaps to 25 / 33 / 50 / 66 / 75 / 100%)';
    attachResizeHandle(handle, wrap, node.id);
    wrap.appendChild(handle);

    zone.appendChild(wrap);
  });

  attachDropZone(zone);
  return zone;
}

/* ------------------------------------------------------------ breadcrumb */

function renderBreadcrumb() {
  const el = document.getElementById('breadcrumb');
  el.innerHTML = '';

  const mk = (text, onClick, current = false) => {
    const b = document.createElement('button');
    b.className = 'breadcrumb-item' + (current ? ' current' : '');
    b.textContent = text;
    if (onClick) b.addEventListener('click', onClick);
    el.appendChild(b);
  };
  const sep = () => {
    const s = document.createElement('span');
    s.className = 'breadcrumb-sep';
    s.textContent = '›';
    el.appendChild(s);
  };

  mk(store.project.key || 'template', () => store.select(null), !store.selectedId);

  if (store.selectedId) {
    const path = store.pathTo(store.selectedId);
    path.forEach((n) => {
      sep();
      mk(nodeLabel(n), () => store.select(n.id));
    });
    const node = store.findNode(store.selectedId);
    if (node) {
      sep();
      mk(nodeLabel(node), null, true);
    }
  }
}

/* ---------------------------------------------------------------- render */

export function renderCanvas(issues) {
  currentIssues = issues || [];
  const canvas = document.getElementById('canvas');
  canvas.innerHTML = '';
  canvas.appendChild(renderDropZone(store.project.properties, 'root',
    'Drag components here to start building your template'));
  renderBreadcrumb();
}

export function initCanvas() {
  // Click on empty canvas → back to template settings.
  document.getElementById('canvas-scroll').addEventListener('click', (e) => {
    if (e.target.id === 'canvas-scroll' || e.target.id === 'canvas') store.select(null);
  });
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
