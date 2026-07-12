/**
 * dragdrop.js
 * HTML5 drag & drop: palette → canvas insertion, canvas reordering,
 * nested drops into sections/block types, visual insertion indicator,
 * plus the snap-to-grid width resize handle.
 */

import { store } from './state.js';
import { COLSPANS } from './components.js';

const MIME_PALETTE = 'application/x-sulu-component';
const MIME_NODE = 'application/x-sulu-node';

let drag = null;        // { kind:'palette'|'node', paletteType?, nodeId? }
let indicator = null;   // floating insertion line element
let lastTarget = null;  // { containerId, index } of current drop preview

function getIndicator() {
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.className = 'drop-indicator h';
    document.body.appendChild(indicator);
  }
  return indicator;
}

function hideIndicator() {
  if (indicator) indicator.style.display = 'none';
  document.querySelectorAll('.drop-zone.drag-over').forEach((z) => z.classList.remove('drag-over'));
  lastTarget = null;
}

/* --------------------------------------------------------------- palette */

export function makePaletteItemDraggable(el, paletteType) {
  el.draggable = true;
  el.addEventListener('dragstart', (e) => {
    drag = { kind: 'palette', paletteType };
    e.dataTransfer.setData(MIME_PALETTE, paletteType);
    e.dataTransfer.effectAllowed = 'copy';
    el.classList.add('dragging');
  });
  el.addEventListener('dragend', () => {
    el.classList.remove('dragging');
    drag = null;
    hideIndicator();
  });
}

/* ----------------------------------------------------------- canvas node */

export function makeNodeDraggable(cardEl, nodeId) {
  cardEl.draggable = true;
  cardEl.addEventListener('dragstart', (e) => {
    e.stopPropagation();
    drag = { kind: 'node', nodeId };
    e.dataTransfer.setData(MIME_NODE, nodeId);
    e.dataTransfer.effectAllowed = 'move';
    // Defer so the browser captures the drag image before we fade the card.
    requestAnimationFrame(() => cardEl.classList.add('dragging'));
  });
  cardEl.addEventListener('dragend', (e) => {
    e.stopPropagation();
    cardEl.classList.remove('dragging');
    drag = null;
    hideIndicator();
  });
}

/* ------------------------------------------------------------ drop zones */

/**
 * Computes where inside `zoneEl` the cursor would insert, using the
 * midpoints of each direct child wrapper. Cards flow left→right then wrap,
 * so we compare rows first, then x within the row.
 */
function computeInsertion(zoneEl, x, y) {
  const wraps = [...zoneEl.children].filter((c) => c.classList.contains('field-wrap'));
  if (!wraps.length) return { index: 0, rect: null };

  for (let i = 0; i < wraps.length; i++) {
    const r = wraps[i].getBoundingClientRect();
    if (y < r.top) return { index: i, rect: r, side: 'before' };
    if (y <= r.bottom) {
      // Same row: decide by horizontal midpoint.
      if (x < r.left + r.width / 2) return { index: i, rect: r, side: 'before' };
      // Look ahead: if next wrap is on the same row, continue scanning.
      const next = wraps[i + 1];
      if (!next) return { index: i + 1, rect: r, side: 'after' };
      const nr = next.getBoundingClientRect();
      if (nr.top >= r.bottom) return { index: i + 1, rect: r, side: 'after' };
    }
  }
  const last = wraps[wraps.length - 1].getBoundingClientRect();
  return { index: wraps.length, rect: last, side: 'after' };
}

function showIndicatorAt(ins, zoneEl) {
  const el = getIndicator();
  el.style.display = 'block';
  if (!ins.rect) {
    const zr = zoneEl.getBoundingClientRect();
    el.className = 'drop-indicator h';
    el.style.left = (zr.left + 8) + 'px';
    el.style.top = (zr.top + 6) + 'px';
    el.style.width = (zr.width - 16) + 'px';
    el.style.height = '3px';
    return;
  }
  const r = ins.rect;
  el.className = 'drop-indicator v';
  el.style.width = '3px';
  el.style.height = (r.height - 8) + 'px';
  el.style.top = (r.top + 4) + 'px';
  el.style.left = (ins.side === 'before' ? r.left - 2 : r.right - 1) + 'px';
}

/** Wires a rendered container element as a drop target. */
export function attachDropZone(zoneEl) {
  const containerId = zoneEl.dataset.container;

  zoneEl.addEventListener('dragover', (e) => {
    if (!drag) {
      // dragstart may fire in another window — trust the transfer types.
      const types = e.dataTransfer ? [...e.dataTransfer.types] : [];
      if (!types.includes(MIME_PALETTE) && !types.includes(MIME_NODE)) return;
    }
    if (drag && drag.kind === 'node') {
      // Block dropping a node inside itself or its descendants.
      if (containerId !== 'root') {
        const ownerId = containerId.split(':')[1];
        if (ownerId === drag.nodeId || store.isAncestorOf(drag.nodeId, ownerId)) return;
      }
    }
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = drag && drag.kind === 'palette' ? 'copy' : 'move';

    document.querySelectorAll('.drop-zone.drag-over').forEach((z) => { if (z !== zoneEl) z.classList.remove('drag-over'); });
    zoneEl.classList.add('drag-over');

    const ins = computeInsertion(zoneEl, e.clientX, e.clientY);
    showIndicatorAt(ins, zoneEl);
    lastTarget = { containerId, index: ins.index };
  });

  zoneEl.addEventListener('dragleave', (e) => {
    if (e.target === zoneEl && !zoneEl.contains(e.relatedTarget)) {
      zoneEl.classList.remove('drag-over');
    }
  });

  zoneEl.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const target = lastTarget && lastTarget.containerId === containerId
      ? lastTarget
      : { containerId, index: computeInsertion(zoneEl, e.clientX, e.clientY).index };

    const paletteType = e.dataTransfer.getData(MIME_PALETTE);
    const nodeId = e.dataTransfer.getData(MIME_NODE);
    hideIndicator();

    if (paletteType) {
      store.addComponent(paletteType, target.containerId, target.index);
    } else if (nodeId) {
      store.moveNode(nodeId, target.containerId, target.index);
    }
    drag = null;
  });
}

/* -------------------------------------------------------- width resizing */

/**
 * Attaches the right-edge resize handle of a field wrapper.
 * Dragging snaps the width to the nearest allowed colspan
 * (3=25%, 4=33%, 6=50%, 8=66%, 9=75%, 12=100%).
 */
export function attachResizeHandle(handleEl, wrapEl, nodeId) {
  handleEl.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const zone = wrapEl.parentElement;
    const zoneWidth = zone.getBoundingClientRect().width;
    const startLeft = wrapEl.getBoundingClientRect().left;
    const startColspan = Number(wrapEl.dataset.colspan) || 12;
    let current = startColspan;

    wrapEl.classList.add('resizing');
    document.body.classList.add('is-resizing');

    const badge = wrapEl.querySelector('.width-badge');

    const onMove = (ev) => {
      const px = ev.clientX - startLeft;
      const frac = Math.max(0.05, Math.min(1, px / zoneWidth));
      const raw = frac * 12;
      let best = COLSPANS[0];
      for (const c of COLSPANS) {
        if (Math.abs(c - raw) < Math.abs(best - raw)) best = c;
      }
      if (best !== current) {
        current = best;
        wrapEl.dataset.colspan = String(best);
        if (badge) badge.textContent = Math.round((best / 12) * 100) + '%';
      }
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      wrapEl.classList.remove('resizing');
      document.body.classList.remove('is-resizing');
      if (current !== startColspan) {
        store.updateNode(nodeId, { colspan: current });
      }
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  // Don't let the handle start an HTML5 drag of the card.
  handleEl.addEventListener('dragstart', (e) => { e.preventDefault(); e.stopPropagation(); });
}
