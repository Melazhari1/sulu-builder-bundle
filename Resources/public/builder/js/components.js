/**
 * components.js
 * Catalog of every Sulu content type available in the palette,
 * grouped by category, with icons, sensible defaults and node factories.
 */

let uid = 0;
export function newId() {
  return 'n' + Date.now().toString(36) + (uid++).toString(36);
}

/* ------------------------------------------------------------------ icons */

const I = {
  textLine: '<svg viewBox="0 0 24 24"><path d="M4 7V5h16v2M12 5v14M9 19h6"/></svg>',
  textArea: '<svg viewBox="0 0 24 24"><path d="M4 6h16M4 10h16M4 14h10"/><path d="M18 18h3m-3 0v3"/></svg>',
  editor: '<svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
  number: '<svg viewBox="0 0 24 24"><path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/></svg>',
  date: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
  time: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
  checkbox: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="m8 12 3 3 5-6"/></svg>',
  color: '<svg viewBox="0 0 24 24"><path d="M12 21a9 9 0 1 1 9-9c0 2-1.5 3-3 3h-2a2.5 2.5 0 0 0-2 4c.5.8 0 2-2 2z"/><circle cx="7.5" cy="11" r=".8"/><circle cx="10.5" cy="7" r=".8"/><circle cx="15" cy="7.5" r=".8"/></svg>',
  url: '<svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>',
  email: '<svg viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 6L22 7"/></svg>',
  password: '<svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
  phone: '<svg viewBox="0 0 24 24"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7 12.8 12.8 0 0 0 .7 2.8 2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5 12.8 12.8 0 0 0 2.8.7 2 2 0 0 1 1.7 2z"/></svg>',
  singleSelect: '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="m9 11 2 2 4-4"/></svg>',
  select: '<svg viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13"/><path d="m3 6 1 1 2-2M3 12l1 1 2-2M3 18l1 1 2-2"/></svg>',
  smart: '<svg viewBox="0 0 24 24"><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/></svg>',
  category: '<svg viewBox="0 0 24 24"><path d="M3 6a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v2H3z"/><path d="M3 6v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/></svg>',
  tag: '<svg viewBox="0 0 24 24"><path d="m20.6 13.4-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1"/></svg>',
  media: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-4.5-4.5L7 20"/></svg>',
  image: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="m21 17-5-5-9 7"/></svg>',
  gallery: '<svg viewBox="0 0 24 24"><rect x="7" y="7" width="14" height="14" rx="2"/><path d="M3 15V5a2 2 0 0 1 2-2h10"/><circle cx="12" cy="12" r="1.5"/><path d="m21 18-4-4-8 7"/></svg>',
  page: '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h6"/></svg>',
  pages: '<svg viewBox="0 0 24 24"><path d="M16 2H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6z"/><path d="M16 2v4h4M6 6H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10"/></svg>',
  snippet: '<svg viewBox="0 0 24 24"><path d="M20 7H4a2 2 0 0 1 0-4h14v4z"/><path d="M4 5v14a2 2 0 0 0 2 2h14V7"/><path d="M9 13h6M9 17h4"/></svg>',
  link: '<svg viewBox="0 0 24 24"><path d="M9 17H7A5 5 0 0 1 7 7h2M15 7h2a5 5 0 0 1 0 10h-2M8 12h8"/></svg>',
  contact: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  teaser: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="7" rx="1.5"/><rect x="3" y="14" width="18" height="7" rx="1.5"/><path d="M6 7.5h5M6 17.5h5"/></svg>',
  block: '<svg viewBox="0 0 24 24"><path d="M12 2 2 7l10 5 10-5-10-5z"/><path d="m2 12 10 5 10-5"/><path d="m2 17 10 5 10-5"/></svg>',
  section: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>',
  rlp: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3.6 9h16.8M3.6 15h16.8"/><path d="M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z"/></svg>',
  custom: '<svg viewBox="0 0 24 24"><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.9 2.9l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.2A1.7 1.7 0 0 0 8.9 19.3a1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.9-2.9l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2A1.7 1.7 0 0 0 4.7 8.9a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.9-2.9l.1.1a1.7 1.7 0 0 0 1.9.3H9.3a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.9 2.9l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1h.2a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.5 1z"/><circle cx="12" cy="12" r="3"/></svg>',
};

export const ICONS = I;

/* --------------------------------------------------------------- catalog */

/**
 * Each entry:
 *  type        Sulu content type string written to XML
 *  label       Palette display name
 *  category    Palette group
 *  icon        Inline SVG
 *  kind        'property' | 'block' | 'section'
 *  baseName    Seed for auto-generated names
 *  preview     Visual hint on the canvas card ('input'|'area'|'media'|null)
 *  params      Default <param> entries
 *  tags        Default <tag> entries
 *  help        One-line description shown in the inspector
 */
export const COMPONENTS = [
  /* ----- Basic Fields ----- */
  { type: 'text_line', label: 'Text Line', category: 'Basic Fields', icon: I.textLine, baseName: 'text', preview: 'input',
    help: 'Single line of plain text.' },
  { type: 'text_area', label: 'Text Area', category: 'Basic Fields', icon: I.textArea, baseName: 'textarea', preview: 'area',
    help: 'Multi-line plain text.' },
  { type: 'number', label: 'Number', category: 'Basic Fields', icon: I.number, baseName: 'number', preview: 'input',
    help: 'Numeric input. Params: min, max, step, multiple_of.' },
  { type: 'date', label: 'Date', category: 'Basic Fields', icon: I.date, baseName: 'date', preview: 'input',
    help: 'Date picker.' },
  { type: 'time', label: 'Time', category: 'Basic Fields', icon: I.time, baseName: 'time', preview: 'input',
    help: 'Time picker.' },
  { type: 'checkbox', label: 'Checkbox', category: 'Basic Fields', icon: I.checkbox, baseName: 'flag', preview: null,
    help: 'Boolean checkbox. Param: default_value (true/false).' },
  { type: 'color', label: 'Color', category: 'Basic Fields', icon: I.color, baseName: 'color', preview: 'input',
    help: 'Color picker storing a hex value.' },
  { type: 'url', label: 'URL', category: 'Basic Fields', icon: I.url, baseName: 'url', preview: 'input',
    help: 'URL input with scheme validation. Params: defaults, schemes (collection).' },
  { type: 'email', label: 'Email', category: 'Basic Fields', icon: I.email, baseName: 'email', preview: 'input',
    help: 'Email address input with validation.' },
  { type: 'password', label: 'Password', category: 'Basic Fields', icon: I.password, baseName: 'password', preview: 'input',
    help: 'Masked password input (never rendered back).' },
  { type: 'phone', label: 'Phone', category: 'Basic Fields', icon: I.phone, baseName: 'phone', preview: 'input',
    help: 'Telephone number input.' },

  /* ----- Selectors ----- */
  { type: 'single_select', label: 'Single Select', category: 'Selectors', icon: I.singleSelect, baseName: 'option', preview: 'input',
    params: [
      { name: 'values', type: 'collection', value: '', children: [
        { name: 'option1', value: 'Option 1' },
        { name: 'option2', value: 'Option 2' },
      ] },
    ],
    help: 'Dropdown with a single choice. Options come from the "values" collection param.' },
  { type: 'select', label: 'Multi Select', category: 'Selectors', icon: I.select, baseName: 'options', preview: 'input',
    params: [
      { name: 'values', type: 'collection', value: '', children: [
        { name: 'option1', value: 'Option 1' },
        { name: 'option2', value: 'Option 2' },
      ] },
    ],
    help: 'Dropdown allowing multiple choices.' },
  { type: 'smart_content', label: 'Smart Content', category: 'Selectors', icon: I.smart, baseName: 'smartContent', preview: 'media',
    params: [
      { name: 'provider', type: 'string', value: 'pages' },
      { name: 'max_per_page', type: 'string', value: '5' },
      { name: 'page_parameter', type: 'string', value: 'p' },
    ],
    help: 'Auto-filled content list (pages, media, snippets…) with filters and pagination.' },
  { type: 'category_selection', label: 'Category Selection', category: 'Selectors', icon: I.category, baseName: 'categories', preview: 'input',
    help: 'Assign one or more categories.' },
  { type: 'tag_selection', label: 'Tag Selection', category: 'Selectors', icon: I.tag, baseName: 'tags', preview: 'input',
    help: 'Assign one or more tags.' },

  /* ----- Media ----- */
  { type: 'media_selection', label: 'Media Selection', category: 'Media', icon: I.media, baseName: 'media', preview: 'media',
    params: [{ name: 'types', type: 'string', value: 'image,video,audio,document' }],
    help: 'Select multiple media assets of any type.' },
  { type: 'single_media_selection', label: 'Image', category: 'Media', icon: I.image, baseName: 'image', preview: 'media',
    params: [{ name: 'types', type: 'string', value: 'image' }],
    help: 'Single image selection.' },
  { type: 'media_selection#gallery', label: 'Gallery', category: 'Media', icon: I.gallery, baseName: 'gallery', preview: 'media',
    realType: 'media_selection',
    params: [{ name: 'types', type: 'string', value: 'image' }],
    help: 'Multiple image selection rendered as a gallery.' },

  /* ----- Relations ----- */
  { type: 'page_selection', label: 'Page Selection', category: 'Relations', icon: I.pages, baseName: 'pages', preview: 'input',
    help: 'Select multiple pages.' },
  { type: 'single_page_selection', label: 'Single Page', category: 'Relations', icon: I.page, baseName: 'page', preview: 'input',
    help: 'Select one page.' },
  { type: 'snippet_selection', label: 'Snippet Selection', category: 'Relations', icon: I.snippet, baseName: 'snippets', preview: 'input',
    help: 'Select multiple snippets. Optional param: types (snippet keys).' },
  { type: 'single_snippet_selection', label: 'Single Snippet', category: 'Relations', icon: I.snippet, baseName: 'snippet', preview: 'input',
    help: 'Select one snippet.' },
  { type: 'link', label: 'Link', category: 'Relations', icon: I.link, baseName: 'link', preview: 'input',
    params: [
      { name: 'types', type: 'collection', value: '', children: [
        { name: 'page', value: '' }, { name: 'external', value: '' },
      ] },
      { name: 'enable_anchor', type: 'string', value: 'true' },
    ],
    help: 'Internal or external link with target/anchor options.' },
  { type: 'contact_account_selection', label: 'Contacts', category: 'Relations', icon: I.contact, baseName: 'contacts', preview: 'input',
    help: 'Select contacts and accounts.' },
  { type: 'teaser_selection', label: 'Teaser Selection', category: 'Relations', icon: I.teaser, baseName: 'teasers', preview: 'media',
    help: 'Mixed teaser list (pages, articles…) with manual sorting.' },

  /* ----- Editor ----- */
  { type: 'text_editor', label: 'Text Editor', category: 'Editor', icon: I.editor, baseName: 'description', preview: 'area',
    help: 'Rich text (CKEditor). Params: table, link, height, max_height…' },

  /* ----- Blocks ----- */
  { type: 'block', label: 'Block', category: 'Blocks', icon: I.block, kind: 'block', baseName: 'blocks', preview: null,
    help: 'Repeatable content blocks. Editors add any number of entries, choosing a type per entry. Blocks can be nested.' },

  /* ----- Structure ----- */
  { type: 'section', label: 'Section', category: 'Structure', icon: I.section, kind: 'section', baseName: 'section', preview: null,
    help: 'Visual grouping of properties in the admin form. Sections are allowed at template root level only and do not nest.' },
  { type: 'resource_locator', label: 'Resource Locator', category: 'Structure', icon: I.rlp, baseName: 'url', preview: 'input',
    tags: [{ name: 'sulu.rlp', priority: '' }],
    help: 'URL of the page. Every page template needs exactly one property tagged sulu.rlp.' },

  /* ----- Custom ----- */
  { type: 'custom', label: 'Custom Type', category: 'Custom', icon: I.custom, baseName: 'custom', preview: 'input',
    help: 'Any property type string, e.g. a type registered by one of your bundles.' },
];

export const CATEGORY_ORDER = [
  'Basic Fields', 'Selectors', 'Media', 'Relations', 'Editor', 'Blocks', 'Structure', 'Custom',
];

export function findComponent(paletteType) {
  return COMPONENTS.find((c) => c.type === paletteType) || null;
}

/** Best-matching palette entry for a real Sulu type (used on XML import). */
export function componentForRealType(type) {
  return COMPONENTS.find((c) => (c.realType || c.type) === type && !c.type.includes('#'))
    || COMPONENTS.find((c) => (c.realType || c.type) === type)
    || findComponent('custom');
}

/* ---------------------------------------------------------- node factory */

function cloneParams(params) {
  return (params || []).map((p) => ({
    name: p.name,
    type: p.type || 'string',
    value: p.value || '',
    children: (p.children || []).map((c) => ({ name: c.name, value: c.value || '', title: c.title || '' })),
  }));
}

/**
 * Creates a canvas node from a palette component definition.
 * Node shape is shared by properties, blocks and sections; unused keys stay empty.
 */
export function createNode(def, opts = {}) {
  const kind = def.kind || 'property';
  const node = {
    id: newId(),
    kind,
    type: def.realType || (def.type === 'custom' ? 'text_line' : def.type),
    paletteType: def.type,
    name: opts.name || '',
    label: { en: opts.label || def.label },
    colspan: 12,
    mandatory: false,
    multilingual: true,
    minOccurs: '',
    maxOccurs: '',
    cssClass: '',
    size: '',
    visibleCondition: '',
    disabledCondition: '',
    defaultValue: '',
    params: cloneParams(def.params),
    tags: (def.tags || []).map((t) => ({ name: t.name, priority: t.priority || '' })),
    collapsed: false,
    // List-column settings, only used when the project type is "list".
    list: defaultListSettings(),
  };

  if (kind === 'block') {
    node.defaultType = 'default';
    node.types = [{ name: 'default', title: { en: 'Default' }, children: [] }];
    node.minOccurs = '0';
  }
  if (kind === 'section') {
    node.children = [];
  }
  return node;
}

/** Deep-clones a node assigning fresh ids throughout (for duplicate / paste). */
export function cloneNodeDeep(node) {
  const copy = JSON.parse(JSON.stringify(node));
  (function reId(n) {
    n.id = newId();
    if (n.types) n.types.forEach((t) => t.children.forEach(reId));
    if (n.children) n.children.forEach(reId);
  })(copy);
  return copy;
}

/* --------------------------------------------------------------- helpers */

// Combining diacritical marks range (U+0300–U+036F), built from char codes
// so the source file stays plain ASCII.
const DIACRITICS_RE = new RegExp('[' + String.fromCharCode(0x300) + '-' + String.fromCharCode(0x36f) + ']', 'g');

export function labelToName(label) {
  const cleaned = (label || '')
    .normalize('NFD').replace(DIACRITICS_RE, '')
    .replace(/[^a-zA-Z0-9]+(.)?/g, (_, ch) => (ch ? ch.toUpperCase() : ''))
    .replace(/^[0-9]+/, '');
  if (!cleaned) return 'field';
  return cleaned.charAt(0).toLowerCase() + cleaned.slice(1);
}

export const COLSPANS = [3, 4, 6, 8, 9, 12];
export function colspanToPercent(colspan) {
  return Math.round((colspan / 12) * 1000) / 10 + '%';
}

/* --------------------------------------------------------- list columns */

export function defaultListSettings() {
  return {
    visibility: '',     // '', always, yes, no, never
    searchability: '',  // '', yes, no, never
    sortable: true,
    translation: '',    // translation key, e.g. sulu_admin.title
    fieldName: '',      // defaults to the property name
    entityName: '',     // defaults to the project-level entity class
    type: '',           // explicit list column type; '' = derive from content type
  };
}

/** Node.list with defaults filled in (older saves may miss the object). */
export function listSettings(node) {
  return { ...defaultListSettings(), ...(node.list || {}) };
}

export const LIST_COLUMN_TYPES = [
  '', 'string', 'number', 'date', 'datetime', 'time', 'bool', 'thumbnails', 'bytes',
];

/** Derives a sensible list column type from a content type. */
export function contentTypeToListType(type) {
  switch (type) {
    case 'number': return 'number';
    case 'date': return 'date';
    case 'datetime': return 'datetime';
    case 'time': return 'time';
    case 'checkbox': return 'bool';
    case 'media_selection':
    case 'single_media_selection': return 'thumbnails';
    default: return ''; // string is the list-builder default
  }
}

/** Best palette/content type to represent an imported list column on the canvas. */
export function listTypeToContentType(listType) {
  switch (listType) {
    case 'number': case 'bytes': return 'number';
    case 'date': return 'date';
    case 'datetime': return 'date';
    case 'time': return 'time';
    case 'bool': return 'checkbox';
    case 'thumbnails': return 'single_media_selection';
    default: return 'text_line';
  }
}
