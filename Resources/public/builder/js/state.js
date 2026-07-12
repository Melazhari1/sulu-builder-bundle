/**
 * state.js
 * Central store: project tree, selection, undo/redo history, pub/sub.
 * Every mutation goes through store.commit() so history stays consistent.
 */

import { createNode, cloneNodeDeep, findComponent, labelToName, newId } from './components.js';

const HISTORY_LIMIT = 100;

export function emptyProject() {
  return {
    templateType: 'page', // 'page' | 'form' | 'list' | 'fragment'
    listEntity: '',       // default Doctrine entity class for list columns
    key: 'default',
    view: 'pages/default',
    controller: 'Sulu\\Bundle\\WebsiteBundle\\Controller\\DefaultController::indexAction',
    cacheLifetime: '86400',
    languages: ['en'],
    metaTitle: { en: 'Default' },
    addTitleAndUrl: true,
    properties: [],
  };
}

/** Starter project resembling a typical Sulu page template. */
export function starterProject() {
  const p = emptyProject();
  const title = createNode(findComponent('text_line'), { label: 'Title' });
  title.name = 'title';
  title.mandatory = true;
  title.tags = [{ name: 'sulu.rlp.part', priority: '' }];
  title.params = [{ name: 'headline', type: 'string', value: 'true', children: [] }];

  const url = createNode(findComponent('resource_locator'), { label: 'Resource Locator' });
  url.name = 'url';
  url.mandatory = true;

  p.properties = [title, url];
  return p;
}

class Store {
  constructor() {
    this.project = starterProject();
    this.selectedId = null;      // node id or null (null = template settings)
    this.activeBlockTypes = {};  // blockNodeId -> active type index (UI only)
    this.undoStack = [];
    this.redoStack = [];
    this.listeners = new Set();
    this._batchDepth = 0;
  }

  /* ------------------------------------------------------------ pub/sub */

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(scope = 'all') {
    if (this._batchDepth > 0) { this._pendingEmit = true; return; }
    this.listeners.forEach((fn) => fn(scope));
  }

  /* ------------------------------------------------------------ history */

  snapshot() {
    return JSON.stringify(this.project);
  }

  /** Wraps a mutation: pushes an undo snapshot, applies fn, notifies. */
  commit(fn, { record = true } = {}) {
    if (record) {
      this.undoStack.push(this.snapshot());
      if (this.undoStack.length > HISTORY_LIMIT) this.undoStack.shift();
      this.redoStack.length = 0;
    }
    fn();
    this.emit();
  }

  canUndo() { return this.undoStack.length > 0; }
  canRedo() { return this.redoStack.length > 0; }

  undo() {
    if (!this.canUndo()) return;
    this.redoStack.push(this.snapshot());
    this.project = JSON.parse(this.undoStack.pop());
    if (this.selectedId && !this.findNode(this.selectedId)) this.selectedId = null;
    this.emit();
  }

  redo() {
    if (!this.canRedo()) return;
    this.undoStack.push(this.snapshot());
    this.project = JSON.parse(this.redoStack.pop());
    if (this.selectedId && !this.findNode(this.selectedId)) this.selectedId = null;
    this.emit();
  }

  resetHistory() {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }

  /* --------------------------------------------------- tree navigation */

  /**
   * Container ids address every droppable list in the tree:
   *   'root'                      → project.properties
   *   'sec:<nodeId>'              → section children
   *   'blk:<nodeId>:<typeIndex>'  → children of one block type
   */
  getContainer(containerId) {
    if (containerId === 'root') return this.project.properties;
    const parts = containerId.split(':');
    const node = this.findNode(parts[1]);
    if (!node) return null;
    if (parts[0] === 'sec') return node.children || null;
    if (parts[0] === 'blk') {
      const t = node.types && node.types[Number(parts[2])];
      return t ? t.children : null;
    }
    return null;
  }

  /** Walks the tree; visitor(node, containerId, index, parentNode). Return true to stop. */
  walk(visitor) {
    const visitList = (list, containerId, parentNode) => {
      for (let i = 0; i < list.length; i++) {
        const n = list[i];
        if (visitor(n, containerId, i, parentNode)) return true;
        if (n.kind === 'section' && visitList(n.children, 'sec:' + n.id, n)) return true;
        if (n.kind === 'block') {
          for (let t = 0; t < n.types.length; t++) {
            if (visitList(n.types[t].children, `blk:${n.id}:${t}`, n)) return true;
          }
        }
      }
      return false;
    };
    visitList(this.project.properties, 'root', null);
  }

  findNode(id) {
    let found = null;
    this.walk((n) => { if (n.id === id) { found = n; return true; } });
    return found;
  }

  /** Returns { node, containerId, index, parentNode } or null. */
  locate(id) {
    let res = null;
    this.walk((n, containerId, index, parentNode) => {
      if (n.id === id) { res = { node: n, containerId, index, parentNode }; return true; }
    });
    return res;
  }

  /** Ancestor chain from root to node (exclusive of the node itself). */
  pathTo(id) {
    const path = [];
    const dive = (list, trail) => {
      for (const n of list) {
        if (n.id === id) { path.push(...trail); return true; }
        if (n.kind === 'section' && dive(n.children, [...trail, n])) return true;
        if (n.kind === 'block') {
          for (const t of n.types) {
            if (dive(t.children, [...trail, n])) return true;
          }
        }
      }
      return false;
    };
    dive(this.project.properties, []);
    return path;
  }

  /** True if `maybeAncestorId` contains `nodeId` anywhere below it. */
  isAncestorOf(maybeAncestorId, nodeId) {
    return this.pathTo(nodeId).some((n) => n.id === maybeAncestorId);
  }

  allNodes() {
    const out = [];
    this.walk((n, containerId, index, parentNode) => { out.push({ node: n, containerId, parentNode }); });
    return out;
  }

  countProperties() {
    let c = 0;
    this.walk((n) => { if (n.kind === 'property') c++; });
    return c;
  }

  /* ------------------------------------------------------------ naming */

  usedNames() {
    const names = new Set();
    this.walk((n) => { names.add(n.name); });
    return names;
  }

  uniqueName(base) {
    const names = this.usedNames();
    let name = base || 'field';
    let i = 2;
    while (names.has(name)) name = base + i++;
    return name;
  }

  /* ----------------------------------------------------------- actions */

  addComponent(paletteType, containerId, index) {
    const def = findComponent(paletteType);
    if (!def) return null;
    const container = this.getContainer(containerId);
    if (!container) return null;
    const node = createNode(def);
    node.name = this.uniqueName(labelToName(def.baseName || def.label));
    this.commit(() => {
      const at = index == null ? container.length : Math.min(index, container.length);
      container.splice(at, 0, node);
      this.selectedId = node.id;
    });
    return node;
  }

  moveNode(nodeId, targetContainerId, targetIndex) {
    const loc = this.locate(nodeId);
    if (!loc) return;
    // Prevent dropping a node into itself / its own descendants.
    if (targetContainerId !== 'root') {
      const targetOwner = targetContainerId.split(':')[1];
      if (targetOwner === nodeId || this.isAncestorOf(nodeId, targetOwner)) return;
    }
    this.commit(() => {
      const from = this.getContainer(loc.containerId);
      from.splice(loc.index, 1);
      const to = this.getContainer(targetContainerId);
      if (!to) { from.splice(loc.index, 0, loc.node); return; }
      let at = targetIndex == null ? to.length : targetIndex;
      if (to === from && loc.index < at) at--;
      at = Math.max(0, Math.min(at, to.length));
      to.splice(at, 0, loc.node);
    });
  }

  updateNode(id, patch, { record = true } = {}) {
    const node = this.findNode(id);
    if (!node) return;
    this.commit(() => { Object.assign(node, patch); }, { record });
  }

  removeNode(id) {
    const loc = this.locate(id);
    if (!loc) return;
    this.commit(() => {
      this.getContainer(loc.containerId).splice(loc.index, 1);
      if (this.selectedId === id || this.isAncestorOf(id, this.selectedId || '')) this.selectedId = null;
    });
  }

  duplicateNode(id) {
    const loc = this.locate(id);
    if (!loc) return;
    const copy = cloneNodeDeep(loc.node);
    // Re-name the copy and all descendants to keep names unique.
    this.commit(() => {
      const rename = (n) => {
        n.name = this.uniqueName(n.name.replace(/\d+$/, '') || 'field');
        if (n.types) n.types.forEach((t) => t.children.forEach(rename));
        if (n.children) n.children.forEach(rename);
      };
      // Insert first so uniqueName sees the copy's siblings, then fix names.
      this.getContainer(loc.containerId).splice(loc.index + 1, 0, copy);
      rename(copy);
      this.selectedId = copy.id;
    });
    return copy;
  }

  select(id) {
    if (this.selectedId === id) return;
    this.selectedId = id;
    this.emit('selection');
  }

  updateProject(patch, { record = true } = {}) {
    this.commit(() => { Object.assign(this.project, patch); }, { record });
  }

  /* block type helpers */

  addBlockType(blockId) {
    const block = this.findNode(blockId);
    if (!block || block.kind !== 'block') return;
    this.commit(() => {
      let i = block.types.length + 1;
      let name = 'type' + i;
      while (block.types.some((t) => t.name === name)) name = 'type' + ++i;
      block.types.push({ name, title: { en: 'Type ' + i }, children: [] });
      this.activeBlockTypes[blockId] = block.types.length - 1;
    });
  }

  removeBlockType(blockId, typeIndex) {
    const block = this.findNode(blockId);
    if (!block || block.types.length <= 1) return;
    this.commit(() => {
      const removed = block.types.splice(typeIndex, 1)[0];
      if (block.defaultType === removed.name) block.defaultType = block.types[0].name;
      this.activeBlockTypes[blockId] = 0;
    });
  }

  setActiveBlockType(blockId, typeIndex) {
    this.activeBlockTypes[blockId] = typeIndex;
    this.emit('ui');
  }

  getActiveBlockType(blockId) {
    const block = this.findNode(blockId);
    if (!block) return 0;
    const idx = this.activeBlockTypes[blockId] || 0;
    return Math.min(idx, block.types.length - 1);
  }

  /* whole-project replacement (import / load) */

  loadProject(project, { resetHistory = true } = {}) {
    this.commit(() => {
      this.project = project;
      this.selectedId = null;
      this.activeBlockTypes = {};
    }, { record: !resetHistory });
    if (resetHistory) this.resetHistory();
    this.emit();
  }
}

export const store = new Store();
export { newId };
