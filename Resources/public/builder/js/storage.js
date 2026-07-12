/**
 * storage.js
 * Project persistence: localStorage autosave, JSON export/import,
 * file download and clipboard helpers.
 */

const LS_KEY = 'sulu-builder-project-v1';
const LS_THEME = 'sulu-builder-theme';
const PROJECT_VERSION = 1;

/* ------------------------------------------------------------ autosave */

export function autosave(project) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ version: PROJECT_VERSION, project }));
  } catch { /* storage full / disabled — autosave is best-effort */ }
}

export function loadAutosaved() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && data.project ? data.project : null;
  } catch {
    return null;
  }
}

export function clearAutosaved() {
  try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
}

/* --------------------------------------------------------------- theme */

export function saveTheme(theme) {
  try { localStorage.setItem(LS_THEME, theme); } catch { /* ignore */ }
}
export function loadTheme() {
  try { return localStorage.getItem(LS_THEME) || 'dark'; } catch { return 'dark'; }
}

/* ----------------------------------------------------------- json i/o */

export function projectToJson(project) {
  return JSON.stringify({
    app: 'sulu-xml-template-builder',
    version: PROJECT_VERSION,
    savedAt: new Date().toISOString(),
    project,
  }, null, 2);
}

/** Parses exported JSON; throws Error with a readable message on failure. */
export function projectFromJson(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error('Not valid JSON: ' + e.message);
  }
  const project = data && data.project ? data.project : data;
  if (!project || typeof project !== 'object' || !Array.isArray(project.properties)) {
    throw new Error('This JSON does not look like a Sulu Builder project (missing "properties" array).');
  }
  // Fill in any fields older exports might miss.
  return {
    templateType: ['page', 'form', 'list', 'fragment'].includes(project.templateType)
      ? project.templateType : 'page',
    listEntity: project.listEntity || '',
    key: project.key || 'default',
    view: project.view || '',
    controller: project.controller || '',
    cacheLifetime: project.cacheLifetime != null ? project.cacheLifetime : '',
    languages: Array.isArray(project.languages) && project.languages.length ? project.languages : ['en'],
    metaTitle: project.metaTitle || { en: project.key || 'Default' },
    addTitleAndUrl: !!project.addTitleAndUrl,
    properties: project.properties,
  };
}

/* ------------------------------------------------------- file download */

export function downloadFile(filename, content, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* ----------------------------------------------------------- clipboard */

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for non-secure contexts (plain http on LAN, etc.)
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}

/* ------------------------------------------------------------ file open */

export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read file.'));
    reader.readAsText(file);
  });
}
