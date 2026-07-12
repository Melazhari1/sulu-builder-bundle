/**
 * xmlGenerator.js
 * Serializes the project tree to Sulu template XML and parses existing
 * Sulu XML back into a project (import).
 */

import {
  componentForRealType, createNode, newId,
  listSettings, contentTypeToListType, listTypeToContentType,
} from './components.js';
import { emptyProject } from './state.js';

const XMLNS = 'http://schemas.sulu.io/template/template';
const XMLNS_LIST = 'http://schemas.sulu.io/list-builder/list';
const XSI = 'http://www.w3.org/2001/XMLSchema-instance';
const SCHEMA_LOCATION = 'http://schemas.sulu.io/template/template http://schemas.sulu.io/template/template-1.0.xsd';

/* ------------------------------------------------------------ escaping */

function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ---------------------------------------------------------- generation */

class XmlWriter {
  constructor() { this.lines = []; this.depth = 0; }
  ind() { return '    '.repeat(this.depth); }
  line(s) { this.lines.push(this.ind() + s); }
  blank() { this.lines.push(''); }
  open(tag, attrs = {}) {
    this.line(`<${tag}${attrString(attrs)}>`);
    this.depth++;
  }
  close(tag) { this.depth--; this.line(`</${tag}>`); }
  selfClose(tag, attrs = {}) { this.line(`<${tag}${attrString(attrs)}/>`); }
  text(tag, content, attrs = {}) { this.line(`<${tag}${attrString(attrs)}>${esc(content)}</${tag}>`); }
  toString() { return this.lines.join('\n') + '\n'; }
}

function attrString(attrs) {
  return Object.entries(attrs)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => ` ${k}="${esc(v)}"`)
    .join('');
}

function writeMeta(w, titleMap, languages, infoMap) {
  const langs = languages.length ? languages : ['en'];
  const hasTitle = langs.some((l) => (titleMap || {})[l]);
  const hasInfo = infoMap && langs.some((l) => infoMap[l]);
  if (!hasTitle && !hasInfo) return;
  w.open('meta');
  langs.forEach((lang) => {
    const t = (titleMap || {})[lang];
    if (t) w.text('title', t, { lang });
  });
  if (infoMap) {
    langs.forEach((lang) => {
      if (infoMap[lang]) w.text('info_text', infoMap[lang], { lang });
    });
  }
  w.close('meta');
}

function writeParams(w, params) {
  if (!params || !params.length) return;
  w.open('params');
  params.forEach((p) => {
    if (!p.name) return;
    if (p.type === 'collection') {
      w.open('param', { name: p.name, type: 'collection' });
      (p.children || []).forEach((c) => {
        if (!c.name) return;
        if (c.title) {
          w.open('param', { name: c.name, value: c.value });
          w.open('meta');
          w.text('title', c.title, { lang: 'en' });
          w.close('meta');
          w.close('param');
        } else {
          w.selfClose('param', { name: c.name, value: c.value });
        }
      });
      w.close('param');
    } else if (p.type === 'expression') {
      w.selfClose('param', { name: p.name, type: 'expression', value: p.value });
    } else {
      w.selfClose('param', { name: p.name, value: p.value });
    }
  });
  w.close('params');
}

function writeTags(w, tags) {
  const valid = (tags || []).filter((t) => t.name);
  if (!valid.length) return;
  valid.forEach((t) => {
    w.selfClose('tag', { name: t.name, priority: t.priority || undefined });
  });
}

function propertyAttrs(node) {
  const attrs = {
    name: node.name,
    type: node.type,
  };
  if (node.mandatory) attrs.mandatory = 'true';
  if (node.multilingual === false) attrs.multilingual = 'false';
  if (node.minOccurs !== '' && node.minOccurs != null) attrs['min-occurs'] = node.minOccurs;
  if (node.maxOccurs !== '' && node.maxOccurs != null) attrs['max-occurs'] = node.maxOccurs;
  if (node.colspan && Number(node.colspan) !== 12) attrs.colspan = node.colspan;
  if (node.cssClass) attrs['css-class'] = node.cssClass;
  if (node.size) attrs.size = node.size;
  if (node.visibleCondition) attrs['visible-condition'] = node.visibleCondition;
  if (node.disabledCondition) attrs['disabled-condition'] = node.disabledCondition;
  return attrs;
}

function effectiveParams(node) {
  const params = (node.params || []).filter((p) => p.name);
  if (node.defaultValue !== '' && node.defaultValue != null
      && !params.some((p) => p.name === 'default_value')) {
    return [{ name: 'default_value', type: 'string', value: node.defaultValue }, ...params];
  }
  return params;
}

function writeProperty(w, node, languages) {
  const params = effectiveParams(node);
  const tags = (node.tags || []).filter((t) => t.name);
  const hasBody = Object.values(node.label || {}).some(Boolean) || params.length || tags.length;
  const attrs = propertyAttrs(node);

  if (!hasBody) { w.selfClose('property', attrs); return; }
  w.open('property', attrs);
  writeMeta(w, node.label, languages);
  writeTags(w, tags);
  writeParams(w, params);
  w.close('property');
}

function writeBlock(w, node, languages) {
  const attrs = propertyAttrs(node);
  delete attrs.type;
  if (node.defaultType) attrs['default-type'] = node.defaultType;
  w.open('block', attrs);
  writeMeta(w, node.label, languages);
  writeTags(w, (node.tags || []).filter((t) => t.name));
  writeParams(w, (node.params || []).filter((p) => p.name));
  w.open('types');
  node.types.forEach((t) => {
    w.open('type', { name: t.name });
    writeMeta(w, t.title, languages);
    w.open('properties');
    t.children.forEach((child) => writeNode(w, child, languages));
    w.close('properties');
    w.close('type');
  });
  w.close('types');
  w.close('block');
}

function writeSection(w, node, languages) {
  const attrs = { name: node.name };
  if (node.colspan && Number(node.colspan) !== 12) attrs.colspan = node.colspan;
  if (node.cssClass) attrs['css-class'] = node.cssClass;
  w.open('section', attrs);
  writeMeta(w, node.label, languages);
  w.open('properties');
  node.children.forEach((child) => writeNode(w, child, languages));
  w.close('properties');
  w.close('section');
}

function writeNode(w, node, languages) {
  if (node.kind === 'block') writeBlock(w, node, languages);
  else if (node.kind === 'section') writeSection(w, node, languages);
  else writeProperty(w, node, languages);
}

export function generateXml(project) {
  switch (project.templateType || 'page') {
    case 'form': return generateFormXml(project);
    case 'list': return generateListXml(project);
    case 'fragment': return generateFragmentXml(project);
    default: return generatePageXml(project);
  }
}

function generatePageXml(project) {
  const w = new XmlWriter();
  const langs = project.languages && project.languages.length ? project.languages : ['en'];

  w.line('<?xml version="1.0" encoding="utf-8"?>');
  w.line(`<template xmlns="${XMLNS}"`);
  w.line(`          xmlns:xsi="${XSI}"`);
  w.line(`          xsi:schemaLocation="${SCHEMA_LOCATION}">`);
  w.depth = 1;
  w.blank();
  w.text('key', project.key || 'default');
  w.blank();
  if (project.view) w.text('view', project.view);
  if (project.controller) w.text('controller', project.controller);
  if (project.cacheLifetime !== '' && project.cacheLifetime != null) {
    w.text('cacheLifetime', project.cacheLifetime);
  }
  w.blank();
  writeMeta(w, project.metaTitle, langs);
  w.blank();
  w.open('properties');
  const list = project.properties || [];
  list.forEach((node, i) => {
    writeNode(w, node, langs);
    if (i < list.length - 1) w.blank();
  });
  w.close('properties');
  w.depth = 0;
  w.line('</template>');
  return w.toString();
}

/**
 * Sulu admin form (config/forms/<key>.xml). Same schema as templates but the
 * root element is <form> and there is no view/controller/cacheLifetime.
 */
function generateFormXml(project) {
  const w = new XmlWriter();
  const langs = project.languages && project.languages.length ? project.languages : ['en'];

  w.line('<?xml version="1.0" encoding="utf-8"?>');
  w.line(`<form xmlns="${XMLNS}"`);
  w.line(`      xmlns:xsi="${XSI}"`);
  w.line(`      xsi:schemaLocation="${SCHEMA_LOCATION}">`);
  w.depth = 1;
  w.blank();
  w.text('key', project.key || 'form');
  w.blank();
  w.open('properties');
  const list = project.properties || [];
  list.forEach((node, i) => {
    writeNode(w, node, langs);
    if (i < list.length - 1) w.blank();
  });
  w.close('properties');
  w.depth = 0;
  w.line('</form>');
  return w.toString();
}

/**
 * Reusable properties fragment. Include it from a template or form with:
 * <xi:include href="fragments/<key>.xml"
 *   xpointer="xmlns(sulu=http://schemas.sulu.io/template/template) xpointer(/sulu:properties/*)"/>
 */
function generateFragmentXml(project) {
  const w = new XmlWriter();
  const langs = project.languages && project.languages.length ? project.languages : ['en'];

  w.line('<?xml version="1.0" encoding="utf-8"?>');
  w.line('<!--');
  w.line(`    Reusable fragment "${project.key || 'fragment'}".`);
  w.line('    Include it from a template or form with XInclude:');
  w.line('');
  w.line('    <xi:include href="fragments/' + (project.key || 'fragment') + '.xml"');
  w.line('                xpointer="xmlns(sulu=http://schemas.sulu.io/template/template) xpointer(/sulu:properties/*)"/>');
  w.line('');
  w.line('    (declare xmlns:xi="http://www.w3.org/2001/XInclude" on the root element)');
  w.line('-->');
  w.line(`<properties xmlns="${XMLNS}"`);
  w.line(`            xmlns:xsi="${XSI}"`);
  w.line(`            xsi:schemaLocation="${SCHEMA_LOCATION}">`);
  w.depth = 1;
  const list = project.properties || [];
  list.forEach((node, i) => {
    writeNode(w, node, langs);
    if (i < list.length - 1) w.blank();
  });
  w.depth = 0;
  w.line('</properties>');
  return w.toString();
}

/**
 * Sulu list view (config/lists/<key>.xml) — list-builder schema. Every
 * property becomes a column; blocks/sections are not allowed here.
 */
function generateListXml(project) {
  const w = new XmlWriter();

  w.line('<?xml version="1.0" encoding="utf-8"?>');
  w.line(`<list xmlns="${XMLNS_LIST}">`);
  w.depth = 1;
  w.blank();
  w.text('key', project.key || 'list');
  w.blank();
  w.open('properties');
  const flat = [];
  (function collect(nodes) {
    nodes.forEach((n) => {
      if (n.kind === 'property') flat.push(n);
      else if (n.kind === 'section') collect(n.children || []);
      // blocks are invalid in lists — the validator flags them; skip here
    });
  })(project.properties || []);
  flat.forEach((node, i) => {
    writeListProperty(w, node, project);
    if (i < flat.length - 1) w.blank();
  });
  w.close('properties');
  w.depth = 0;
  w.line('</list>');
  return w.toString();
}

function writeListProperty(w, node, project) {
  const l = listSettings(node);
  const attrs = { name: node.name };
  if (l.translation) attrs.translation = l.translation;
  const columnType = l.type || contentTypeToListType(node.type);
  if (columnType && columnType !== 'string') attrs.type = columnType;
  if (l.visibility) attrs.visibility = l.visibility;
  if (l.searchability) attrs.searchability = l.searchability;
  if (l.sortable === false) attrs.sortable = 'false';

  w.open('property', attrs);
  w.text('field-name', l.fieldName || node.name);
  const entity = l.entityName || project.listEntity || '';
  if (entity) w.text('entity-name', entity);
  w.close('property');
}

/* -------------------------------------------------------------- import */

function childElements(el, tagName) {
  return [...el.children].filter((c) => c.localName === tagName);
}
function firstChild(el, tagName) {
  return childElements(el, tagName)[0] || null;
}

function readMeta(el) {
  const titles = {};
  const meta = firstChild(el, 'meta');
  if (meta) {
    childElements(meta, 'title').forEach((t) => {
      titles[t.getAttribute('lang') || 'en'] = t.textContent.trim();
    });
  }
  return titles;
}

function readParams(el) {
  const out = [];
  const paramsEl = firstChild(el, 'params');
  if (!paramsEl) return out;
  childElements(paramsEl, 'param').forEach((p) => {
    const type = p.getAttribute('type');
    if (type === 'collection') {
      out.push({
        name: p.getAttribute('name') || '',
        type: 'collection',
        value: '',
        children: childElements(p, 'param').map((c) => {
          const meta = readMeta(c);
          return {
            name: c.getAttribute('name') || '',
            value: c.getAttribute('value') || '',
            title: meta.en || Object.values(meta)[0] || '',
          };
        }),
      });
    } else {
      out.push({
        name: p.getAttribute('name') || '',
        type: type === 'expression' ? 'expression' : 'string',
        value: p.getAttribute('value') || '',
        children: [],
      });
    }
  });
  return out;
}

function readTags(el) {
  return childElements(el, 'tag').map((t) => ({
    name: t.getAttribute('name') || '',
    priority: t.getAttribute('priority') || '',
  }));
}

function baseNodeFromEl(el, kind, type) {
  const def = kind === 'property'
    ? componentForRealType(type)
    : { kind, type: kind, label: kind };
  const node = createNode(kind === 'property' ? def : { ...def, kind }, {});
  node.id = newId();
  node.kind = kind;
  if (kind === 'property') node.type = type;
  node.paletteType = kind === 'property' ? (def.realType ? def.type : def.type) : kind;
  node.name = el.getAttribute('name') || '';
  node.label = readMeta(el);
  if (!Object.keys(node.label).length) node.label = { en: node.name };
  node.mandatory = el.getAttribute('mandatory') === 'true';
  node.multilingual = el.getAttribute('multilingual') !== 'false';
  node.minOccurs = el.getAttribute('min-occurs') || el.getAttribute('minOccurs') || '';
  node.maxOccurs = el.getAttribute('max-occurs') || el.getAttribute('maxOccurs') || '';
  node.colspan = Number(el.getAttribute('colspan')) || 12;
  node.cssClass = el.getAttribute('css-class') || '';
  node.size = el.getAttribute('size') || '';
  node.visibleCondition = el.getAttribute('visible-condition') || '';
  node.disabledCondition = el.getAttribute('disabled-condition') || '';
  node.tags = readTags(el);
  const params = readParams(el);
  const dv = params.find((p) => p.name === 'default_value' && p.type !== 'collection');
  if (dv) {
    node.defaultValue = dv.value;
    node.params = params.filter((p) => p !== dv);
  } else {
    node.defaultValue = '';
    node.params = params;
  }
  return node;
}

function parseNodeList(propertiesEl, languages) {
  const out = [];
  if (!propertiesEl) return out;
  [...propertiesEl.children].forEach((el) => {
    if (el.localName === 'property') {
      out.push(baseNodeFromEl(el, 'property', el.getAttribute('type') || 'text_line'));
    } else if (el.localName === 'block') {
      const node = baseNodeFromEl(el, 'block', 'block');
      node.defaultType = el.getAttribute('default-type') || '';
      node.types = [];
      const typesEl = firstChild(el, 'types');
      if (typesEl) {
        childElements(typesEl, 'type').forEach((typeEl) => {
          const titles = readMeta(typeEl);
          node.types.push({
            name: typeEl.getAttribute('name') || 'default',
            title: Object.keys(titles).length ? titles : { en: typeEl.getAttribute('name') || 'Default' },
            children: parseNodeList(firstChild(typeEl, 'properties'), languages),
          });
        });
      }
      if (!node.types.length) node.types = [{ name: 'default', title: { en: 'Default' }, children: [] }];
      if (!node.defaultType) node.defaultType = node.types[0].name;
      collectLangs(node.label, languages);
      out.push(node);
    } else if (el.localName === 'section') {
      const node = baseNodeFromEl(el, 'section', 'section');
      node.children = parseNodeList(firstChild(el, 'properties'), languages);
      out.push(node);
    }
    if (out.length) collectLangs(out[out.length - 1].label, languages);
  });
  return out;
}

function collectLangs(titleMap, languages) {
  Object.keys(titleMap || {}).forEach((l) => {
    if (!languages.includes(l)) languages.push(l);
  });
}

/**
 * Parses Sulu XML into a project. Detects the document kind from the root:
 * <template> (page), <form>, <list> (list-builder) or bare <properties>
 * (reusable fragment). Throws Error with a readable message on failure.
 */
export function importXml(xmlString) {
  const doc = new DOMParser().parseFromString(xmlString, 'application/xml');
  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    throw new Error('XML parse error:\n' + parserError.textContent.trim().split('\n')[0]);
  }
  const root = doc.documentElement;

  switch (root.localName) {
    case 'template': return importTemplateLike(root, 'page');
    case 'form': return importTemplateLike(root, 'form');
    case 'properties': return importFragment(root);
    case 'list': return importList(root);
    default:
      throw new Error(`Expected root element <template>, <form>, <list> or <properties>, found <${root.localName}>.`);
  }
}

function importTemplateLike(root, templateType) {
  const project = emptyProject();
  project.templateType = templateType;
  project.languages = [];
  project.addTitleAndUrl = false;

  const keyEl = firstChild(root, 'key');
  project.key = keyEl ? keyEl.textContent.trim() : 'imported';
  const viewEl = firstChild(root, 'view');
  project.view = viewEl ? viewEl.textContent.trim() : '';
  const controllerEl = firstChild(root, 'controller');
  project.controller = controllerEl ? controllerEl.textContent.trim() : '';
  const cacheEl = firstChild(root, 'cacheLifetime');
  project.cacheLifetime = cacheEl ? cacheEl.textContent.trim() : '';

  project.metaTitle = readMeta(root);
  collectLangs(project.metaTitle, project.languages);

  project.properties = parseNodeList(firstChild(root, 'properties'), project.languages);
  if (!project.languages.length) project.languages = ['en'];
  if (!Object.keys(project.metaTitle).length) project.metaTitle = { [project.languages[0]]: project.key };
  return project;
}

function importFragment(root) {
  const project = emptyProject();
  project.templateType = 'fragment';
  project.languages = [];
  project.addTitleAndUrl = false;
  project.key = 'fragment';
  project.view = '';
  project.controller = '';
  project.cacheLifetime = '';

  // The root itself is the <properties> element.
  project.properties = parseNodeList(root, project.languages);
  if (!project.languages.length) project.languages = ['en'];
  project.metaTitle = { [project.languages[0]]: 'Fragment' };
  return project;
}

function importList(root) {
  const project = emptyProject();
  project.templateType = 'list';
  project.addTitleAndUrl = false;
  project.view = '';
  project.controller = '';
  project.cacheLifetime = '';

  const keyEl = firstChild(root, 'key');
  project.key = keyEl ? keyEl.textContent.trim() : 'list';
  project.metaTitle = { en: project.key };

  project.properties = [];
  const propertiesEl = firstChild(root, 'properties');
  if (propertiesEl) {
    [...propertiesEl.children].forEach((el) => {
      if (el.localName !== 'property') return;
      const columnType = el.getAttribute('type') || '';
      const contentType = listTypeToContentType(columnType);
      const def = componentForRealType(contentType);
      const node = createNode(def, {});
      node.id = newId();
      node.type = contentType;
      node.name = el.getAttribute('name') || '';
      node.label = { en: el.getAttribute('translation') || node.name };
      node.params = [];
      node.tags = [];
      const fieldNameEl = firstChild(el, 'field-name');
      const entityEl = firstChild(el, 'entity-name');
      node.list = {
        visibility: el.getAttribute('visibility') || '',
        searchability: el.getAttribute('searchability') || '',
        sortable: el.getAttribute('sortable') !== 'false',
        translation: el.getAttribute('translation') || '',
        fieldName: fieldNameEl ? fieldNameEl.textContent.trim() : '',
        entityName: entityEl ? entityEl.textContent.trim() : '',
        type: columnType,
      };
      project.properties.push(node);
    });
    // If every column shares one entity, hoist it to the project default.
    const entities = [...new Set(project.properties.map((n) => n.list.entityName).filter(Boolean))];
    if (entities.length === 1) {
      project.listEntity = entities[0];
      project.properties.forEach((n) => { n.list.entityName = ''; });
    }
    // Normalise fieldName that just repeats the property name.
    project.properties.forEach((n) => {
      if (n.list.fieldName === n.name) n.list.fieldName = '';
    });
  }
  return project;
}

/* ---------------------------------------------------- syntax highlight */

/** Minimal XML syntax highlighter returning HTML for the preview pane. */
export function highlightXml(xml) {
  const escaped = xml
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return escaped
    .replace(/(&lt;\?[\s\S]*?\?&gt;)/g, '<span class="xd">$1</span>')
    .replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="xc">$1</span>')
    .replace(/(&lt;\/?)([\w:-]+)([^&]*?)(\/?&gt;)/g, (m, open, tag, attrs, close) => {
      const attrsHl = attrs.replace(/([\w:-]+)(=)("[^"]*")/g,
        '<span class="xa">$1</span>$2<span class="xv">$3</span>');
      return `<span class="xt">${open}${tag}</span>${attrsHl}<span class="xt">${close}</span>`;
    });
}
