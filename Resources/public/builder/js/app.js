/**
 * app.js
 * Bootstrap and glue: render cycle, toolbar, keyboard shortcuts,
 * XML preview drawer, modals, toasts, autosave and custom types.
 */

import { store, emptyProject, starterProject } from './state.js';
import { COMPONENTS, ICONS } from './components.js';
import { initPalette, renderPalette } from './palette.js';
import { initCanvas, renderCanvas } from './canvas.js';
import { renderInspector } from './inspector.js';
import { generateXml, importXml, highlightXml } from './xmlGenerator.js';
import { validateProject, errorCount, warningCount } from './validator.js';
import * as storage from './storage.js';

const $ = (id) => document.getElementById(id);

let issues = [];
let autosaveTimer = null;

/* ================================================================ toasts */

function toast(message, type = 'info', ms = 2600) {
  const icons = {
    success: '<svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>',
    error: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v4m0 4h.01"/></svg>',
    info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 16v-5m0-3h.01"/></svg>',
  };
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.innerHTML = (icons[type] || icons.info) + `<span>${message}</span>`;
  $('toast-stack').appendChild(el);
  setTimeout(() => {
    el.classList.add('hide');
    setTimeout(() => el.remove(), 350);
  }, ms);
}

/* ================================================================ modals */

function openModal({ title, body, footer = [] }) {
  $('modal-title').textContent = title;
  const bodyEl = $('modal-body');
  bodyEl.innerHTML = '';
  if (typeof body === 'string') bodyEl.innerHTML = body;
  else bodyEl.appendChild(body);
  const footEl = $('modal-footer');
  footEl.innerHTML = '';
  footer.forEach((btn) => footEl.appendChild(btn));
  $('modal-backdrop').hidden = false;
}

function closeModal() {
  $('modal-backdrop').hidden = true;
}

function mkButton(label, cls, onClick) {
  const b = document.createElement('button');
  b.className = cls;
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

/* ======================================================== render cycle */

function updateToolbar() {
  $('btn-undo').disabled = !store.canUndo();
  $('btn-redo').disabled = !store.canRedo();
  const keyInput = $('template-key-input');
  if (document.activeElement !== keyInput) keyInput.value = store.project.key || '';
  $('template-type-select').value = store.project.templateType || 'page';
}

function updateStatus() {
  const errs = errorCount(issues);
  const warns = warningCount(issues);
  const badge = $('validation-badge');
  const badgeText = $('validation-badge-text');
  badge.classList.toggle('has-errors', errs > 0);
  badge.classList.toggle('has-warnings', errs === 0 && warns > 0);
  badgeText.textContent = errs > 0 ? `${errs} error${errs > 1 ? 's' : ''}`
    : warns > 0 ? `${warns} warning${warns > 1 ? 's' : ''}` : 'Valid';

  const sv = $('status-validation');
  sv.classList.toggle('has-errors', errs > 0);
  sv.classList.toggle('has-warnings', errs === 0 && warns > 0);
  $('status-validation-text').textContent =
    `${errs + warns} problem${errs + warns === 1 ? '' : 's'}`;

  const count = store.countProperties();
  const type = store.project.templateType || 'page';
  $('status-count').textContent = type === 'list'
    ? `${count} column${count === 1 ? '' : 's'}`
    : `${count} propert${count === 1 ? 'y' : 'ies'}`;
  $('status-schema').textContent = type === 'list'
    ? 'Sulu list-builder schema' : 'Sulu template schema 1.0';
}

function updateXmlPreview() {
  if (!$('xml-drawer').classList.contains('open')) return;
  $('xml-code').innerHTML = highlightXml(generateXml(store.project));
}

function renderProblems() {
  const list = $('problems-list');
  list.innerHTML = '';
  if (!issues.length) {
    list.innerHTML = '<li class="empty">No problems — the template is valid. 🎉</li>';
    return;
  }
  issues.forEach((i) => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="sev ${i.severity}">${i.severity === 'error' ? 'ERR' : 'WARN'}</span>
      <span>${i.message} <span class="loc">${i.where && i.where !== 'Template' ? '· ' + i.where : ''}</span></span>`;
    li.addEventListener('click', () => {
      if (i.nodeId) {
        store.select(i.nodeId);
        // Expand ancestors so the node is visible.
        store.pathTo(i.nodeId).forEach((a) => { if (a.collapsed) a.collapsed = false; });
        store.emit();
      }
      $('problems-pop').hidden = true;
    });
    list.appendChild(li);
  });
}

function renderAll() {
  issues = validateProject(store.project);
  renderPalette($('palette-search').value); // palette filters by template type
  renderCanvas(issues);
  renderInspector(issues);
  updateToolbar();
  updateStatus();
  updateXmlPreview();
  renderProblems();
  scheduleAutosave();
}

function scheduleAutosave() {
  clearTimeout(autosaveTimer);
  $('status-autosave').textContent = 'saving…';
  autosaveTimer = setTimeout(() => {
    storage.autosave(store.project);
    $('status-autosave').textContent = 'autosaved';
  }, 600);
}

/* ============================================================== toolbar */

const XML_TARGET_DIR = {
  page: 'config/templates/pages/',
  form: 'config/forms/',
  list: 'config/lists/',
  fragment: 'config/templates/fragments/',
};

function fileNameForXml() {
  return (store.project.key || 'template') + '.xml';
}

function xmlTargetPath() {
  return (XML_TARGET_DIR[store.project.templateType || 'page'] || XML_TARGET_DIR.page) + fileNameForXml();
}

function doGenerate() {
  const xml = generateXml(store.project);
  const errs = errorCount(issues);

  const body = document.createElement('div');
  if (errs > 0) {
    body.appendChild(el(`<div class="import-error">⚠ This template has ${errs} validation error${errs > 1 ? 's' : ''}. The XML below may be rejected by Sulu — check the Problems panel.</div>`));
  }
  const pre = el('<pre class="xml-code" style="max-height:50vh;border:1px solid var(--border);border-radius:6px;"></pre>');
  pre.innerHTML = highlightXml(xml);
  body.appendChild(pre);
  body.appendChild(el(`<div class="insp-help">Save as <b>${xmlTargetPath()}</b> in your Sulu project, then clear the cache.</div>`));

  openModal({
    title: 'Generated Sulu XML — ' + fileNameForXml(),
    body,
    footer: [
      mkButton('Copy', 'btn', async () => {
        const ok = await storage.copyToClipboard(xml);
        toast(ok ? 'XML copied to clipboard' : 'Copy failed', ok ? 'success' : 'error');
      }),
      mkButton('Download', 'btn', () => {
        storage.downloadFile(fileNameForXml(), xml, 'application/xml');
        toast('Downloaded ' + fileNameForXml(), 'success');
      }),
      mkButton('Close', 'btn btn-primary', closeModal),
    ],
  });
}

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function pickFile(accept, onText) {
  const input = $('file-input');
  input.accept = accept;
  input.value = '';
  input.onchange = async () => {
    const file = input.files && input.files[0];
    if (!file) return;
    try {
      onText(await storage.readFileAsText(file), file.name);
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  input.click();
}

function doImportXmlModal() {
  const body = document.createElement('div');
  const ta = el('<textarea class="paste-area" placeholder="Paste your Sulu template XML here…" spellcheck="false"></textarea>');
  const errBox = el('<div class="import-error" style="display:none"></div>');
  body.appendChild(ta);
  body.appendChild(el('<div class="or-sep">— or —</div>'));
  const fileBtn = mkButton('Choose .xml file…', 'btn', () => {
    pickFile('.xml,text/xml,application/xml', (text) => { ta.value = text; });
  });
  fileBtn.style.alignSelf = 'center';
  body.appendChild(fileBtn);
  body.appendChild(errBox);

  const tryImport = () => {
    try {
      const project = importXml(ta.value);
      store.loadProject(project, { resetHistory: false });
      closeModal();
      const kindLabel = { page: 'Page template', form: 'Form', list: 'List', fragment: 'Fragment' };
      toast(`${kindLabel[project.templateType] || 'Template'} imported: ${project.key}`, 'success');
    } catch (e) {
      errBox.style.display = 'block';
      errBox.textContent = e.message;
    }
  };

  openModal({
    title: 'Import Sulu XML (template / form / list / fragment)',
    body,
    footer: [
      mkButton('Cancel', 'btn', closeModal),
      mkButton('Import', 'btn btn-primary', tryImport),
    ],
  });
}

function doNewProject() {
  openModal({
    title: 'New project',
    body: '<p>Start a new template? The current work stays in Undo history and autosave until replaced.</p>',
    footer: [
      mkButton('Cancel', 'btn', closeModal),
      mkButton('Empty template', 'btn', () => {
        store.loadProject(emptyProject(), { resetHistory: false });
        closeModal();
        toast('Empty template created', 'success');
      }),
      mkButton('Page starter (title + URL)', 'btn btn-primary', () => {
        store.loadProject(starterProject(), { resetHistory: false });
        closeModal();
        toast('Starter template created', 'success');
      }),
    ],
  });
}

function doAddCustomType() {
  const body = document.createElement('div');
  const typeInput = el('<input class="insp-input mono" placeholder="content type string, e.g. location" spellcheck="false">');
  const labelInput = el('<input class="insp-input" placeholder="Display label, e.g. Location">');
  body.appendChild(el('<label class="insp-help">Sulu content type (as registered in your project):</label>'));
  body.appendChild(typeInput);
  body.appendChild(el('<label class="insp-help" style="margin-top:8px;display:block">Palette label:</label>'));
  body.appendChild(labelInput);

  openModal({
    title: 'Add custom property type',
    body,
    footer: [
      mkButton('Cancel', 'btn', closeModal),
      mkButton('Add to palette', 'btn btn-primary', () => {
        const type = typeInput.value.trim();
        if (!type) { typeInput.classList.add('invalid'); return; }
        const label = labelInput.value.trim() || type;
        const paletteType = 'custom#' + type;
        COMPONENTS.push({
          type: paletteType, realType: type, label, category: 'Custom',
          icon: ICONS.custom, baseName: type.replace(/[^a-zA-Z0-9]+/g, ''), preview: 'input',
          help: 'Custom type "' + type + '".',
        });
        saveCustomTypes();
        renderPalette($('palette-search').value);
        closeModal();
        toast(`Custom type "${type}" added to the palette`, 'success');
      }),
    ],
  });
  setTimeout(() => typeInput.focus(), 50);
}

const LS_CUSTOM = 'sulu-builder-custom-types';
function saveCustomTypes() {
  const customs = COMPONENTS.filter((c) => c.type.startsWith('custom#'))
    .map((c) => ({ type: c.realType, label: c.label }));
  try { localStorage.setItem(LS_CUSTOM, JSON.stringify(customs)); } catch { /* ignore */ }
}
function loadCustomTypes() {
  try {
    const customs = JSON.parse(localStorage.getItem(LS_CUSTOM) || '[]');
    customs.forEach(({ type, label }) => {
      if (!COMPONENTS.some((c) => c.type === 'custom#' + type)) {
        COMPONENTS.push({
          type: 'custom#' + type, realType: type, label: label || type, category: 'Custom',
          icon: ICONS.custom, baseName: type.replace(/[^a-zA-Z0-9]+/g, ''), preview: 'input',
          help: 'Custom type "' + type + '".',
        });
      }
    });
  } catch { /* ignore */ }
}

function doExportJson() {
  const json = storage.projectToJson(store.project);
  storage.downloadFile((store.project.key || 'template') + '.sulu-builder.json', json, 'application/json');
  toast('Project exported as JSON', 'success');
}

function doLoadJson() {
  pickFile('.json,application/json', (text, name) => {
    try {
      const project = storage.projectFromJson(text);
      store.loadProject(project, { resetHistory: false });
      toast('Project loaded: ' + name, 'success');
    } catch (e) {
      toast(e.message, 'error', 4500);
    }
  });
}

function toggleXmlDrawer(force) {
  const drawer = $('xml-drawer');
  const open = force != null ? force : !drawer.classList.contains('open');
  drawer.classList.toggle('open', open);
  if (open) updateXmlPreview();
}

function toggleTheme() {
  const html = document.documentElement;
  const next = html.dataset.theme === 'dark' ? 'light' : 'dark';
  html.dataset.theme = next;
  storage.saveTheme(next);
}

/* ==================================================== keyboard shortcuts */

function isTyping() {
  const a = document.activeElement;
  return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || a.isContentEditable);
}

function initShortcuts() {
  document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;

    if (e.key === 'Escape') {
      if (!$('modal-backdrop').hidden) { closeModal(); return; }
      if (!$('problems-pop').hidden) { $('problems-pop').hidden = true; return; }
      if ($('xml-drawer').classList.contains('open')) { toggleXmlDrawer(false); return; }
      store.select(null);
      return;
    }

    if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); store.undo(); return; }
    if ((mod && e.key.toLowerCase() === 'y') || (mod && e.shiftKey && e.key.toLowerCase() === 'z')) {
      e.preventDefault(); store.redo(); return;
    }
    if (mod && e.key.toLowerCase() === 'g') { e.preventDefault(); doGenerate(); return; }
    if (mod && e.key.toLowerCase() === 'e') { e.preventDefault(); toggleXmlDrawer(); return; }
    if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); doExportJson(); return; }
    if (mod && e.key.toLowerCase() === 'o') { e.preventDefault(); doLoadJson(); return; }
    if (mod && e.key.toLowerCase() === 'f') { e.preventDefault(); $('palette-search').focus(); return; }

    if (isTyping()) return;

    if (mod && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      if (store.selectedId) store.duplicateNode(store.selectedId);
      return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && store.selectedId) {
      e.preventDefault();
      store.removeNode(store.selectedId);
    }
  });
}

/* ================================================================= init */

function initToolbar() {
  $('btn-undo').addEventListener('click', () => store.undo());
  $('btn-redo').addEventListener('click', () => store.redo());
  $('btn-new').addEventListener('click', doNewProject);
  $('btn-save-json').addEventListener('click', doExportJson);
  $('btn-load-json').addEventListener('click', doLoadJson);
  $('btn-import-xml').addEventListener('click', doImportXmlModal);
  $('btn-generate').addEventListener('click', doGenerate);
  $('btn-toggle-xml').addEventListener('click', () => toggleXmlDrawer());
  $('btn-close-xml').addEventListener('click', () => toggleXmlDrawer(false));
  $('btn-theme').addEventListener('click', toggleTheme);
  $('btn-add-custom').addEventListener('click', doAddCustomType);

  $('btn-copy-xml').addEventListener('click', async () => {
    const ok = await storage.copyToClipboard(generateXml(store.project));
    toast(ok ? 'XML copied to clipboard' : 'Copy failed', ok ? 'success' : 'error');
  });
  $('btn-download-xml').addEventListener('click', () => {
    storage.downloadFile(fileNameForXml(), generateXml(store.project), 'application/xml');
    toast('Downloaded ' + fileNameForXml(), 'success');
  });

  $('template-key-input').addEventListener('change', (e) => {
    store.updateProject({ key: e.target.value.trim() });
  });
  $('template-type-select').addEventListener('change', (e) => {
    store.updateProject({ templateType: e.target.value });
  });

  $('modal-close').addEventListener('click', closeModal);
  $('modal-backdrop').addEventListener('click', (e) => {
    if (e.target === $('modal-backdrop')) closeModal();
  });

  /* problems popover */
  const toggleProblems = () => { $('problems-pop').hidden = !$('problems-pop').hidden; };
  $('status-validation').addEventListener('click', toggleProblems);
  $('validation-badge').addEventListener('click', toggleProblems);
  document.addEventListener('click', (e) => {
    const pop = $('problems-pop');
    if (!pop.hidden && !pop.contains(e.target)
        && !$('status-validation').contains(e.target)
        && !$('validation-badge').contains(e.target)) {
      pop.hidden = true;
    }
  });
}

function init() {
  document.documentElement.dataset.theme = storage.loadTheme();
  loadCustomTypes();

  const saved = storage.loadAutosaved();
  if (saved) {
    store.project = saved;
  }

  initPalette();
  initCanvas();
  initToolbar();
  initShortcuts();

  store.subscribe(() => renderAll());
  renderAll();
}

init();
