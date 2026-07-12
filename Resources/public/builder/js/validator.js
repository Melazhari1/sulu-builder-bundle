/**
 * validator.js
 * Real-time validation of the project against Sulu template rules.
 * Returns a list of issues: { severity: 'error'|'warning', message, nodeId?, where }
 */

const NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_-]*$/;
const KEY_RE = /^[a-zA-Z0-9_-]+$/;

const LIST_VISIBILITIES = ['', 'always', 'yes', 'no', 'never'];
const LIST_SEARCHABILITIES = ['', 'yes', 'no', 'never'];

export function validateProject(project) {
  const issues = [];
  const type = project.templateType || 'page';
  const add = (severity, message, nodeId = null, where = 'Template') => {
    issues.push({ severity, message, nodeId, where });
  };

  /* ---- template level ---- */
  if (type !== 'fragment') {
    if (!project.key || !project.key.trim()) {
      add('error', 'Template <key> is required.');
    } else if (!KEY_RE.test(project.key.trim())) {
      add('error', `Template key "${project.key}" may only contain letters, numbers, "-" and "_".`);
    }
  }

  const langs = project.languages && project.languages.length ? project.languages : ['en'];
  if (type === 'page') {
    if (!langs.some((l) => (project.metaTitle || {})[l])) {
      add('warning', 'Template has no <meta><title> — the admin UI will show the key instead.');
    }
    if (!project.view || !project.view.trim()) {
      add('warning', 'No <view> set — page templates need a Twig view (e.g. pages/default).');
    }
    if (project.cacheLifetime !== '' && project.cacheLifetime != null
        && !/^\d+$/.test(String(project.cacheLifetime))) {
      add('error', 'cacheLifetime must be a number of seconds.');
    }
  }

  if (type === 'list') {
    validateList(project, add);
    return issues;
  }

  if (!project.properties || !project.properties.length) {
    add('warning', 'Template has no properties yet.');
    return issues;
  }

  /* ---- walk the tree ---- */
  const globalNames = new Map(); // name -> [{nodeId, where}]
  let hasTitle = false;
  let hasRlp = false;

  const visitList = (list, scope, depth, insideBlock) => {
    const siblingNames = new Map();

    list.forEach((node) => {
      const where = scope;
      const label = displayName(node);

      /* name */
      if (!node.name || !node.name.trim()) {
        add('error', `${nodeKindLabel(node)} needs a name.`, node.id, where);
      } else {
        if (!NAME_RE.test(node.name)) {
          add('error', `Name "${node.name}" is invalid — use letters, numbers, "_" or "-", starting with a letter or "_".`, node.id, where);
        }
        if (siblingNames.has(node.name)) {
          add('error', `Duplicate name "${node.name}" in ${where}.`, node.id, where);
        }
        siblingNames.set(node.name, true);
        if (node.kind !== 'section') {
          if (!globalNames.has(node.name)) globalNames.set(node.name, []);
          globalNames.get(node.name).push({ nodeId: node.id, where });
        }
        if (node.name === 'title') hasTitle = true;
      }

      /* occurs */
      const min = node.minOccurs === '' ? null : Number(node.minOccurs);
      const max = node.maxOccurs === '' ? null : Number(node.maxOccurs);
      if (node.minOccurs !== '' && (!Number.isInteger(min) || min < 0)) {
        add('error', `"${label}": min-occurs must be a non-negative integer.`, node.id, where);
      }
      if (node.maxOccurs !== '' && (!Number.isInteger(max) || max < 1)) {
        add('error', `"${label}": max-occurs must be a positive integer.`, node.id, where);
      }
      if (min != null && max != null && Number.isInteger(min) && Number.isInteger(max) && min > max) {
        add('error', `"${label}": min-occurs (${min}) is greater than max-occurs (${max}).`, node.id, where);
      }

      /* colspan */
      const colspan = Number(node.colspan);
      if (node.colspan && (!Number.isInteger(colspan) || colspan < 1 || colspan > 12)) {
        add('error', `"${label}": colspan must be an integer between 1 and 12.`, node.id, where);
      }

      /* label */
      if (!langs.some((l) => (node.label || {})[l])) {
        add('warning', `"${node.name || label}" has no title — the admin form will fall back to the raw name.`, node.id, where);
      }

      if (node.kind === 'property') {
        if (!node.type || !node.type.trim()) {
          add('error', `"${label}": property type is missing.`, node.id, where);
        }
        if (node.type === 'resource_locator') {
          const tagged = (node.tags || []).some((t) => t.name === 'sulu.rlp');
          if (!tagged) {
            add('warning', `"${label}": resource_locator should carry the tag "sulu.rlp".`, node.id, where);
          }
        }
        if ((node.type === 'single_select' || node.type === 'select')
            && !(node.params || []).some((p) => p.name === 'values' && p.type === 'collection' && (p.children || []).some((c) => c.name))) {
          add('warning', `"${label}": ${node.type} has no "values" collection param — the dropdown will be empty.`, node.id, where);
        }
        if (node.type === 'smart_content'
            && !(node.params || []).some((p) => p.name === 'provider' && p.value)) {
          add('warning', `"${label}": smart_content should define a "provider" param (pages, media, snippets…).`, node.id, where);
        }
        (node.tags || []).forEach((t) => {
          if (t.name === 'sulu.rlp') hasRlp = true;
          if (t.priority !== '' && !/^\d+$/.test(String(t.priority))) {
            add('error', `"${label}": tag "${t.name}" priority must be a number.`, node.id, where);
          }
        });
        (node.params || []).forEach((p) => {
          if (!p.name) add('warning', `"${label}": a param is missing its name and will be skipped.`, node.id, where);
        });
      }

      if (node.kind === 'section') {
        if (depth > 0 || insideBlock) {
          add('error', `Section "${label}" must be at template root level — sections cannot be nested or placed inside blocks.`, node.id, where);
        }
        if (!node.children.length) {
          add('warning', `Section "${label}" is empty.`, node.id, where);
        }
        visitList(node.children, `section "${node.name}"`, depth + 1, insideBlock);
      }

      if (node.kind === 'block') {
        if (!node.types.length) {
          add('error', `Block "${label}" needs at least one type.`, node.id, where);
        }
        const typeNames = new Set();
        node.types.forEach((t) => {
          if (!t.name || !NAME_RE.test(t.name)) {
            add('error', `Block "${label}": type name "${t.name}" is invalid.`, node.id, where);
          }
          if (typeNames.has(t.name)) {
            add('error', `Block "${label}": duplicate type name "${t.name}".`, node.id, where);
          }
          typeNames.add(t.name);
          if (!t.children.length) {
            add('warning', `Block "${label}" type "${t.name}" has no fields.`, node.id, where);
          }
        });
        if (node.defaultType && !typeNames.has(node.defaultType)) {
          add('error', `Block "${label}": default-type "${node.defaultType}" does not match any type.`, node.id, where);
        }
        node.types.forEach((t) => {
          visitList(t.children, `block "${node.name}" › type "${t.name}"`, depth + 1, true);
        });
      }
    });
  };

  visitList(project.properties, 'root', 0, false);

  /* duplicate names across the whole template (Sulu stores content flat per name) */
  globalNames.forEach((entries, name) => {
    if (entries.length > 1) {
      const wheres = [...new Set(entries.map((e) => e.where))];
      if (wheres.length > 1 || entries.filter((e) => e.where === wheres[0]).length > 1) {
        // Same-scope duplicates were already flagged as errors above; cross-scope is a warning
        const sameScopeDup = entries.some((e, i) =>
          entries.findIndex((x) => x.where === e.where) !== i);
        if (!sameScopeDup) {
          entries.slice(1).forEach((e) => {
            add('warning', `Name "${name}" is used in multiple scopes (${wheres.join(', ')}). Allowed across block types, but avoid it elsewhere.`, e.nodeId, e.where);
          });
        }
      }
    }
  });

  /* page template conventions */
  if (type === 'page') {
    if (!hasTitle) {
      add('warning', 'Page templates usually need a mandatory "title" property (text_line).');
    }
    if (!hasRlp) {
      add('warning', 'No property tagged "sulu.rlp" — page templates require a resource_locator with this tag.');
    }
  }

  return issues;
}

/* ------------------------------------------------------------ list mode */

function validateList(project, add) {
  if (!project.properties || !project.properties.length) {
    add('warning', 'List has no columns yet.');
    return;
  }

  const names = new Set();
  let missingEntity = false;

  const visit = (nodes, where) => {
    nodes.forEach((node) => {
      const label = node.name || node.type;

      if (node.kind === 'block') {
        add('error', `Blocks are not allowed in list views — remove "${label}" or switch the template type.`, node.id, where);
        return;
      }
      if (node.kind === 'section') {
        add('warning', `Sections have no meaning in list XML — the fields inside "${label}" are exported as flat columns.`, node.id, where);
        visit(node.children || [], `section "${node.name}"`);
        return;
      }

      if (!node.name || !node.name.trim()) {
        add('error', 'Every list column needs a name.', node.id, where);
      } else {
        if (!NAME_RE.test(node.name)) {
          add('error', `Column name "${node.name}" is invalid — use letters, numbers, "_" or "-".`, node.id, where);
        }
        if (names.has(node.name)) {
          add('error', `Duplicate column name "${node.name}".`, node.id, where);
        }
        names.add(node.name);
      }

      const l = node.list || {};
      if (l.visibility && !LIST_VISIBILITIES.includes(l.visibility)) {
        add('error', `"${label}": visibility must be one of always, yes, no, never.`, node.id, where);
      }
      if (l.searchability && !LIST_SEARCHABILITIES.includes(l.searchability)) {
        add('error', `"${label}": searchability must be one of yes, no, never.`, node.id, where);
      }
      if (!l.translation) {
        add('warning', `"${label}": no translation key — the column header will be untranslated.`, node.id, where);
      }
      if (!(l.entityName || project.listEntity)) missingEntity = true;
    });
  };

  visit(project.properties, 'root');

  if (missingEntity) {
    add('warning', 'Some columns have no entity class — set a default entity in Template Settings or per column.');
  }
}

export function issuesForNode(issues, nodeId) {
  return issues.filter((i) => i.nodeId === nodeId);
}

export function errorCount(issues) {
  return issues.filter((i) => i.severity === 'error').length;
}
export function warningCount(issues) {
  return issues.filter((i) => i.severity === 'warning').length;
}

function displayName(node) {
  return (node.label && (node.label.en || Object.values(node.label)[0])) || node.name || node.type;
}
function nodeKindLabel(node) {
  return node.kind === 'block' ? 'Block' : node.kind === 'section' ? 'Section' : 'Property';
}
