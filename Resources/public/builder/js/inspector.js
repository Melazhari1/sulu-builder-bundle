/**
 * inspector.js
 * Right panel: template settings when nothing is selected, otherwise the
 * full attribute editor for the selected property / block / section.
 */

import { store } from './state.js';
import {
  COMPONENTS, COLSPANS, findComponent, labelToName,
  listSettings, LIST_COLUMN_TYPES, contentTypeToListType,
} from './components.js';
import { issuesForNode } from './validator.js';

export const TEMPLATE_TYPES = [
  { value: 'page', label: 'Page template', file: 'config/templates/pages/' },
  { value: 'form', label: 'Form', file: 'config/forms/' },
  { value: 'list', label: 'List view', file: 'config/lists/' },
  { value: 'fragment', label: 'Properties fragment', file: 'config/templates/fragments/' },
];

let currentIssues = [];
const collapsedSections = new Set(['Advanced', 'Params', 'Tags']);

/* ------------------------------------------------------------- helpers */

function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function escapeAttr(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function section(title, bodyEls, { collapsed = null } = {}) {
  const isCollapsed = collapsed != null ? collapsed : collapsedSections.has(title);
  const sec = h(`<div class="insp-section${isCollapsed ? ' collapsed' : ''}">
    <button class="insp-section-header">
      <svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg><span>${title}</span>
    </button>
    <div class="insp-section-body"></div>
  </div>`);
  sec.querySelector('.insp-section-header').addEventListener('click', () => {
    sec.classList.toggle('collapsed');
    if (sec.classList.contains('collapsed')) collapsedSections.add(title);
    else collapsedSections.delete(title);
  });
  const body = sec.querySelector('.insp-section-body');
  bodyEls.forEach((el) => el && body.appendChild(el));
  return sec;
}

function textField(label, value, onChange, {
  mono = false, placeholder = '', help = '', required = false, invalid = false,
} = {}) {
  const el = h(`<div class="insp-field">
    <label>${label}${required ? ' <span class="req">*</span>' : ''}</label>
    <input class="insp-input${mono ? ' mono' : ''}${invalid ? ' invalid' : ''}"
           value="${escapeAttr(value)}" placeholder="${escapeAttr(placeholder)}" spellcheck="false">
    ${help ? `<div class="insp-help">${help}</div>` : ''}
  </div>`);
  const input = el.querySelector('input');
  input.addEventListener('change', () => onChange(input.value));
  return el;
}

function textAreaField(label, value, onChange, { placeholder = '', help = '' } = {}) {
  const el = h(`<div class="insp-field">
    <label>${label}</label>
    <textarea class="insp-textarea" placeholder="${escapeAttr(placeholder)}" spellcheck="false">${escapeAttr(value)}</textarea>
    ${help ? `<div class="insp-help">${help}</div>` : ''}
  </div>`);
  el.querySelector('textarea').addEventListener('change', (e) => onChange(e.target.value));
  return el;
}

function selectField(label, value, options, onChange, { help = '' } = {}) {
  const el = h(`<div class="insp-field">
    <label>${label}</label>
    <select class="insp-select"></select>
    ${help ? `<div class="insp-help">${help}</div>` : ''}
  </div>`);
  const sel = el.querySelector('select');
  options.forEach((o) => {
    const opt = document.createElement('option');
    opt.value = o.value;
    opt.textContent = o.label;
    if (o.value === value) opt.selected = true;
    sel.appendChild(opt);
  });
  sel.addEventListener('change', () => onChange(sel.value));
  return el;
}

function toggleField(label, checked, onChange, { help = '' } = {}) {
  const el = h(`<div class="insp-toggle">
    <span>${label}${help ? `<small>${help}</small>` : ''}</span>
    <label class="switch"><input type="checkbox" ${checked ? 'checked' : ''}><span class="track"></span></label>
  </div>`);
  el.querySelector('input').addEventListener('change', (e) => onChange(e.target.checked));
  return el;
}

function widthPicker(colspan, onChange) {
  const el = h('<div class="insp-field"><label>Width (colspan)</label><div class="width-picker"></div></div>');
  const box = el.querySelector('.width-picker');
  COLSPANS.forEach((c) => {
    const b = document.createElement('button');
    b.textContent = Math.round((c / 12) * 100) + '%';
    b.title = `colspan="${c}"`;
    if (Number(colspan) === c) b.classList.add('active');
    b.addEventListener('click', () => onChange(c));
    box.appendChild(b);
  });
  return el;
}

/* --------------------------------------------------------- node errors */

function nodeErrors(nodeId) {
  const list = issuesForNode(currentIssues, nodeId);
  if (!list.length) return null;
  const wrap = document.createElement('div');
  wrap.className = 'insp-node-errors';
  list.forEach((i) => {
    wrap.appendChild(h(`<div class="insp-error-item${i.severity === 'warning' ? ' warn' : ''}">${i.message}</div>`));
  });
  return wrap;
}

/* -------------------------------------------------------- params editor */

function paramsEditor(node) {
  const wrap = document.createElement('div');
  wrap.className = 'kv-list';

  const commitParams = () => store.updateNode(node.id, { params: node.params });

  (node.params || []).forEach((p, idx) => {
    const row = h(`<div class="kv-row">
      <input class="insp-input mono kv-name" placeholder="name" value="${escapeAttr(p.name)}" spellcheck="false">
      <select class="insp-select kv-type">
        <option value="string">string</option>
        <option value="expression">expr</option>
        <option value="collection">collection</option>
      </select>
      <input class="insp-input mono kv-value" placeholder="value" value="${escapeAttr(p.value)}" spellcheck="false">
      <button class="kv-remove" title="Remove param"><svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
    </div>`);
    row.querySelector('.kv-type').value = p.type || 'string';
    row.querySelector('.kv-name').addEventListener('change', (e) => { p.name = e.target.value.trim(); commitParams(); });
    row.querySelector('.kv-value').addEventListener('change', (e) => { p.value = e.target.value; commitParams(); });
    row.querySelector('.kv-type').addEventListener('change', (e) => {
      p.type = e.target.value;
      if (p.type === 'collection' && !p.children) p.children = [];
      commitParams();
    });
    row.querySelector('.kv-remove').addEventListener('click', () => {
      node.params.splice(idx, 1);
      commitParams();
    });
    wrap.appendChild(row);

    if (p.type === 'collection') {
      const sub = document.createElement('div');
      sub.className = 'kv-sub';
      (p.children || []).forEach((c, ci) => {
        const srow = h(`<div class="kv-row">
          <input class="insp-input mono kv-name" placeholder="name" value="${escapeAttr(c.name)}" spellcheck="false">
          <input class="insp-input kv-value" placeholder="value / label" value="${escapeAttr(c.value)}" spellcheck="false">
          <button class="kv-remove" title="Remove option"><svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
        </div>`);
        srow.children[0].addEventListener('change', (e) => { c.name = e.target.value.trim(); commitParams(); });
        srow.children[1].addEventListener('change', (e) => { c.value = e.target.value; commitParams(); });
        srow.children[2].addEventListener('click', () => { p.children.splice(ci, 1); commitParams(); });
        sub.appendChild(srow);
      });
      const addSub = h(`<button class="btn-add-row"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Add option</button>`);
      addSub.addEventListener('click', () => {
        p.children = p.children || [];
        p.children.push({ name: 'option' + (p.children.length + 1), value: '' });
        commitParams();
      });
      sub.appendChild(addSub);
      wrap.appendChild(sub);
    }
  });

  const add = h(`<button class="btn-add-row"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Add param</button>`);
  add.addEventListener('click', () => {
    node.params = node.params || [];
    node.params.push({ name: '', type: 'string', value: '', children: [] });
    commitParams();
  });
  wrap.appendChild(add);
  return wrap;
}

/* ---------------------------------------------------------- tags editor */

function tagsEditor(node) {
  const wrap = document.createElement('div');
  wrap.className = 'kv-list';
  const commit = () => store.updateNode(node.id, { tags: node.tags });

  (node.tags || []).forEach((t, idx) => {
    const row = h(`<div class="kv-row">
      <input class="insp-input mono kv-name" placeholder="e.g. sulu.rlp" value="${escapeAttr(t.name)}" spellcheck="false" style="flex:2">
      <input class="insp-input mono kv-value" placeholder="priority" value="${escapeAttr(t.priority)}" spellcheck="false" style="flex:1">
      <button class="kv-remove" title="Remove tag"><svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
    </div>`);
    row.children[0].addEventListener('change', (e) => { t.name = e.target.value.trim(); commit(); });
    row.children[1].addEventListener('change', (e) => { t.priority = e.target.value.trim(); commit(); });
    row.children[2].addEventListener('click', () => { node.tags.splice(idx, 1); commit(); });
    wrap.appendChild(row);
  });

  const add = h(`<button class="btn-add-row"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Add tag</button>`);
  add.addEventListener('click', () => {
    node.tags = node.tags || [];
    node.tags.push({ name: '', priority: '' });
    commit();
  });
  wrap.appendChild(add);

  const help = h('<div class="insp-help">Common tags: sulu.rlp, sulu.rlp.part, sulu.search.field, sulu.teaser.description, sulu.teaser.media</div>');
  wrap.appendChild(help);
  return wrap;
}

/* --------------------------------------------------- block types editor */

function blockTypesEditor(node) {
  const wrap = document.createElement('div');
  wrap.className = 'kv-list';

  node.types.forEach((t, idx) => {
    const row = h(`<div class="type-editor-row">
      <div class="row1">
        <input class="insp-input mono" placeholder="type name" value="${escapeAttr(t.name)}" spellcheck="false" style="flex:1">
        <input class="insp-input" placeholder="Title" value="${escapeAttr(t.title.en || '')}" style="flex:1.2">
        <button class="kv-remove" title="Remove type" ${node.types.length <= 1 ? 'disabled style="opacity:.3"' : ''}>
          <svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
    </div>`);
    const [nameInput, titleInput] = row.querySelectorAll('input');
    nameInput.addEventListener('change', (e) => {
      const old = t.name;
      t.name = e.target.value.trim();
      if (node.defaultType === old) node.defaultType = t.name;
      store.updateNode(node.id, { types: node.types, defaultType: node.defaultType });
    });
    titleInput.addEventListener('change', (e) => {
      t.title.en = e.target.value;
      store.updateNode(node.id, { types: node.types });
    });
    row.querySelector('.kv-remove').addEventListener('click', () => {
      if (node.types.length > 1) store.removeBlockType(node.id, idx);
    });
    wrap.appendChild(row);
  });

  const add = h(`<button class="btn-add-row"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Add block type</button>`);
  add.addEventListener('click', () => store.addBlockType(node.id));
  wrap.appendChild(add);

  wrap.appendChild(selectField('Default type', node.defaultType,
    node.types.map((t) => ({ value: t.name, label: t.name })),
    (v) => store.updateNode(node.id, { defaultType: v }),
    { help: 'Type pre-selected when the editor adds a new block entry.' }));

  return wrap;
}

/* --------------------------------------------------- template settings */

function renderTemplateSettings(root) {
  document.getElementById('inspector-title').textContent = 'Template Settings';
  const p = store.project;
  const type = p.templateType || 'page';

  /* ---- Template ---- */
  const templateFields = [
    selectField('Template type', type,
      TEMPLATE_TYPES.map((t) => ({ value: t.value, label: t.label })),
      (v) => store.updateProject({ templateType: v }),
      { help: 'Decides the generated XML: page/home template, admin form, list view or a reusable XInclude fragment.' }),
    textField('Key', p.key, (v) => store.updateProject({ key: v.trim() }), {
      mono: true, required: type !== 'fragment',
      help: type === 'fragment'
        ? 'Fragments have no <key> — this is only used for the file name.'
        : 'File name and unique identifier (e.g. default, homepage).',
    }),
  ];
  if (type === 'page') {
    templateFields.push(
      textField('View', p.view, (v) => store.updateProject({ view: v.trim() }), {
        mono: true, placeholder: 'pages/default',
        help: 'Twig template rendered on the website.',
      }),
      textField('Controller', p.controller, (v) => store.updateProject({ controller: v.trim() }), {
        mono: true, placeholder: 'Sulu\\Bundle\\WebsiteBundle\\Controller\\DefaultController::indexAction',
        help: 'Optional — leave the Sulu default unless you have a custom controller.',
      }),
      textField('Cache lifetime (s)', p.cacheLifetime, (v) => store.updateProject({ cacheLifetime: v.trim() }), {
        mono: true, placeholder: '86400',
        help: 'HTTP cache lifetime in seconds. Empty = omit.',
      }),
    );
  }
  if (type === 'list') {
    templateFields.push(
      textField('Default entity class', p.listEntity || '', (v) => store.updateProject({ listEntity: v.trim() }), {
        mono: true, placeholder: 'App\\Entity\\Event',
        help: 'Written as &lt;entity-name&gt; for every column that has no entity of its own.',
      }),
    );
  }
  root.appendChild(section('Template', templateFields, { collapsed: false }));

  /* ---- Meta (not used by list XML) ---- */
  if (type !== 'list') {
    const langFields = [
      textField('Languages', (p.languages || []).join(', '), (v) => {
        const langs = v.split(',').map((s) => s.trim()).filter(Boolean);
        store.updateProject({ languages: langs.length ? langs : ['en'] });
      }, { mono: true, help: 'Comma-separated locale codes, e.g. en, de, fr. Titles/labels are written per language.' }),
    ];
    if (type === 'page') {
      (p.languages || ['en']).forEach((lang) => {
        langFields.push(textField(`Title (${lang})`, (p.metaTitle || {})[lang] || '', (v) => {
          const metaTitle = { ...(p.metaTitle || {}) };
          metaTitle[lang] = v;
          store.updateProject({ metaTitle });
        }, { help: lang === (p.languages || ['en'])[0] ? 'Shown in the Sulu admin template selector.' : '' }));
      });
    }
    root.appendChild(section('Meta', langFields, { collapsed: false }));
  }

  /* ---- Tips ---- */
  const mono = 'style="font-family:var(--font-mono)"';
  const tips = {
    page: `• Every page template needs a mandatory <b>title</b> (text_line) and a <b>resource_locator</b>
      tagged <span ${mono}>sulu.rlp</span>.<br>
      • SEO &amp; excerpt tabs are added automatically by Sulu — no XML needed.<br>
      • Save the generated file to <span ${mono}>config/templates/pages/&lt;key&gt;.xml</span>.`,
    form: `• Forms use the same schema as templates: properties, sections and blocks all work.<br>
      • No view/controller — forms only describe the admin UI.<br>
      • Save the generated file to <span ${mono}>config/forms/&lt;key&gt;.xml</span> and reference it
      by key from your Admin class or form overlay.`,
    list: `• Every field becomes a list <b>column</b>; blocks are not allowed here.<br>
      • Set visibility, searchability, sortable, translation key and entity per column
      (select a field to edit them).<br>
      • Save the generated file to <span ${mono}>config/lists/&lt;key&gt;.xml</span>.`,
    fragment: `• A fragment is a bare <span ${mono}>&lt;properties&gt;</span> file you can reuse
      across templates and forms with XInclude.<br>
      • The generated file starts with a ready-to-copy
      <span ${mono}>&lt;xi:include&gt;</span> snippet in a comment.<br>
      • Suggested location: <span ${mono}>config/templates/fragments/&lt;key&gt;.xml</span>.`,
  };
  root.appendChild(section('Tips', [
    h(`<div class="insp-help" style="line-height:1.6">${tips[type] || tips.page}</div>`),
  ], { collapsed: false }));
}

/* ------------------------------------------------------- node inspector */

function labelFields(node) {
  const langs = store.project.languages && store.project.languages.length ? store.project.languages : ['en'];
  return langs.map((lang) => textField(`Label (${lang})`, (node.label || {})[lang] || '', (v) => {
    const label = { ...(node.label || {}) };
    label[lang] = v;
    store.updateNode(node.id, { label });
  }));
}

function renderNodeInspector(root, node) {
  const kindTitle = node.kind === 'block' ? 'Block' : node.kind === 'section' ? 'Section' : 'Property';
  document.getElementById('inspector-title').textContent = kindTitle + ' — ' + (node.name || node.type);

  /* breadcrumb */
  const path = store.pathTo(node.id);
  if (path.length) {
    const bc = document.createElement('div');
    bc.className = 'insp-breadcrumb';
    const rootBtn = h(`<button>${escapeAttr(store.project.key)}</button>`);
    rootBtn.addEventListener('click', () => store.select(null));
    bc.appendChild(rootBtn);
    path.forEach((a) => {
      bc.appendChild(document.createTextNode(' › '));
      const b = h(`<button>${escapeAttr(a.name || a.type)}</button>`);
      b.addEventListener('click', () => store.select(a.id));
      bc.appendChild(b);
    });
    bc.appendChild(document.createTextNode(' › ' + (node.name || node.type)));
    root.appendChild(bc);
  }

  const errs = nodeErrors(node.id);
  if (errs) root.appendChild(errs);

  /* List mode: properties are columns with a dedicated attribute set. */
  if ((store.project.templateType || 'page') === 'list' && node.kind === 'property') {
    renderListColumnInspector(root, node);
    return;
  }

  /* ---- General ---- */
  const general = [];
  general.push(textField('Name', node.name, (v) => {
    store.updateNode(node.id, { name: v.trim() });
  }, {
    mono: true, required: true,
    help: 'Property name used in Twig: content.' + (node.name || 'name'),
    invalid: issuesForNode(currentIssues, node.id).some((i) => i.message.includes('name') && i.severity === 'error'),
  }));
  general.push(...labelFields(node));

  if (node.kind === 'property') {
    const def = findComponent(node.paletteType);
    const knownTypes = [...new Set(COMPONENTS
      .filter((c) => c.kind !== 'block' && c.kind !== 'section' && c.type !== 'custom')
      .map((c) => c.realType || c.type))];
    if (def && def.type === 'custom') {
      general.push(textField('Type', node.type, (v) => store.updateNode(node.id, { type: v.trim() }), {
        mono: true, required: true, help: 'Any registered Sulu content type string.',
      }));
    } else {
      general.push(selectField('Type', node.type,
        knownTypes.map((t) => ({ value: t, label: t })),
        (v) => store.updateNode(node.id, { type: v }),
        { help: def ? def.help : '' }));
    }
  }

  const auto = h(`<button class="btn-add-row" title="Generate the name from the label">
    <svg viewBox="0 0 24 24"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/></svg>Auto-name from label</button>`);
  auto.addEventListener('click', () => {
    const base = labelToName((node.label || {}).en || Object.values(node.label || {})[0] || node.type);
    store.updateNode(node.id, { name: store.uniqueName(base) });
  });
  general.push(auto);

  root.appendChild(section('General', general, { collapsed: false }));

  /* ---- Behaviour ---- */
  if (node.kind !== 'section') {
    const behaviour = [
      toggleField('Mandatory', !!node.mandatory,
        (v) => store.updateNode(node.id, { mandatory: v }),
        { help: 'Content cannot be saved as published without it.' }),
      toggleField('Multilingual', node.multilingual !== false,
        (v) => store.updateNode(node.id, { multilingual: v }),
        { help: 'Stored per language (default) or shared across languages.' }),
    ];
    if (node.kind === 'property') {
      behaviour.push(textField('Default value', node.defaultValue || '',
        (v) => store.updateNode(node.id, { defaultValue: v }),
        { help: 'Written as a default_value param.' }));
    }
    behaviour.push(h('<div class="insp-field-row"></div>'));
    const row = behaviour[behaviour.length - 1];
    row.appendChild(textField('Min occurs', node.minOccurs, (v) => store.updateNode(node.id, { minOccurs: v.trim() }), { mono: true, placeholder: '—' }));
    row.appendChild(textField('Max occurs', node.maxOccurs, (v) => store.updateNode(node.id, { maxOccurs: v.trim() }), { mono: true, placeholder: '—' }));
    root.appendChild(section('Behaviour', behaviour, { collapsed: false }));
  }

  /* ---- Layout ---- */
  root.appendChild(section('Layout', [
    widthPicker(node.colspan, (c) => store.updateNode(node.id, { colspan: c })),
    textField('CSS class', node.cssClass || '', (v) => store.updateNode(node.id, { cssClass: v.trim() }), { mono: true, placeholder: '—' }),
  ], { collapsed: false }));

  /* ---- Blocks ---- */
  if (node.kind === 'block') {
    root.appendChild(section('Block Types', [blockTypesEditor(node)], { collapsed: false }));
  }

  /* ---- Visibility ---- */
  if (node.kind !== 'section') {
    root.appendChild(section('Visibility', [
      textAreaField('Visible condition', node.visibleCondition || '',
        (v) => store.updateNode(node.id, { visibleCondition: v.trim() }),
        { placeholder: "e.g. showImage == true", help: 'jexl expression over sibling property values (visible-condition attribute).' }),
      textAreaField('Disabled condition', node.disabledCondition || '',
        (v) => store.updateNode(node.id, { disabledCondition: v.trim() }),
        { placeholder: '—', help: 'jexl expression; field is greyed out when true.' }),
    ]));
  }

  /* ---- Params & Tags ---- */
  if (node.kind !== 'section') {
    root.appendChild(section('Params', [paramsEditor(node)],
      { collapsed: !(node.params || []).length && collapsedSections.has('Params') }));
    root.appendChild(section('Tags', [tagsEditor(node)],
      { collapsed: !(node.tags || []).length && collapsedSections.has('Tags') }));
  }

  /* ---- Danger zone ---- */
  const dz = h('<div class="danger-zone"></div>');
  const dup = h(`<button class="btn-outline"><svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Duplicate</button>`);
  dup.addEventListener('click', () => store.duplicateNode(node.id));
  const del = h(`<button class="btn-outline danger"><svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>Delete</button>`);
  del.addEventListener('click', () => store.removeNode(node.id));
  dz.appendChild(dup);
  dz.appendChild(del);
  root.appendChild(dz);
}

/* ---------------------------------------------------- list column editor */

function renderListColumnInspector(root, node) {
  document.getElementById('inspector-title').textContent = 'Column — ' + (node.name || 'column');
  const l = listSettings(node);
  const patch = (change) => store.updateNode(node.id, { list: { ...l, ...change } });

  root.appendChild(section('Column', [
    textField('Name', node.name, (v) => store.updateNode(node.id, { name: v.trim() }), {
      mono: true, required: true, help: 'Column identifier used by the list view.',
    }),
    textField('Translation key', l.translation, (v) => patch({ translation: v.trim() }), {
      mono: true, placeholder: 'sulu_admin.' + (node.name || 'title'),
      help: 'Header label translation key (translation attribute).',
    }),
    selectField('Column type', l.type || contentTypeToListType(node.type),
      LIST_COLUMN_TYPES.map((t) => ({ value: t, label: t === '' ? 'string (default)' : t })),
      (v) => patch({ type: v }),
      { help: 'Rendering/sorting type of the column (type attribute).' }),
  ], { collapsed: false }));

  root.appendChild(section('Behaviour', [
    selectField('Visibility', l.visibility, [
      { value: '', label: 'default' },
      { value: 'always', label: 'always — shown, cannot be hidden' },
      { value: 'yes', label: 'yes — shown by default' },
      { value: 'no', label: 'no — hidden by default' },
      { value: 'never', label: 'never — only used internally' },
    ], (v) => patch({ visibility: v })),
    selectField('Searchability', l.searchability, [
      { value: '', label: 'default' },
      { value: 'yes', label: 'yes — included in search' },
      { value: 'no', label: 'no' },
      { value: 'never', label: 'never' },
    ], (v) => patch({ searchability: v })),
    toggleField('Sortable', l.sortable !== false, (v) => patch({ sortable: v }),
      { help: 'Whether the list can be ordered by this column.' }),
  ], { collapsed: false }));

  root.appendChild(section('Mapping', [
    textField('Field name', l.fieldName, (v) => patch({ fieldName: v.trim() }), {
      mono: true, placeholder: node.name || 'field',
      help: 'Doctrine field (&lt;field-name&gt;). Empty = same as the column name.',
    }),
    textField('Entity class', l.entityName, (v) => patch({ entityName: v.trim() }), {
      mono: true, placeholder: store.project.listEntity || 'App\\Entity\\…',
      help: 'Overrides the default entity from Template Settings (&lt;entity-name&gt;).',
    }),
  ], { collapsed: false }));

  /* danger zone (same as regular nodes) */
  const dz = h('<div class="danger-zone"></div>');
  const dup = h(`<button class="btn-outline"><svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Duplicate</button>`);
  dup.addEventListener('click', () => store.duplicateNode(node.id));
  const del = h(`<button class="btn-outline danger"><svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>Delete</button>`);
  del.addEventListener('click', () => store.removeNode(node.id));
  dz.appendChild(dup);
  dz.appendChild(del);
  root.appendChild(dz);
}

/* ---------------------------------------------------------------- main */

export function renderInspector(issues) {
  currentIssues = issues || [];
  const root = document.getElementById('inspector');
  root.innerHTML = '';

  const node = store.selectedId ? store.findNode(store.selectedId) : null;
  if (!node) {
    renderTemplateSettings(root);
    return;
  }
  renderNodeInspector(root, node);
}
