# SuluBuilderBundle

A production-ready Sulu CMS bundle that adds a **"Sulu Builder"** top-level item to the
Sulu Administration navigation. The view lists the XML templates of your project
(pages, snippets, … — configurable) through a native Sulu Admin React view, and ships a
JSON admin API to read and write those templates, ready to be extended into a full
visual template builder.

- Compatible with **Sulu 2.4 – 2.6**, PHP >= 7.2, Symfony 5.4 / 6.x
- PSR-4 / PSR-12 compliant
- Uses only the Sulu Admin React ecosystem (no extra UI framework)
- Permissions integrated with Sulu's security contexts (Settings → User roles)

---

## 1. Bundle structure — where each file belongs

```
SuluBuilderBundle/
├── composer.json                              Package definition (type: symfony-bundle, PSR-4: Xxp\SuluBuilderBundle\)
├── SuluBuilderBundle.php                      Bundle class (entry point registered in config/bundles.php)
│
├── Admin/
│   └── BuilderAdmin.php                       Sulu Admin class: navigation item, admin view ("/builder"),
│                                              security context. Tagged with "sulu.admin" in services.xml.
├── Controller/
│   └── Admin/
│       └── TemplateController.php             JSON admin API (list / get / save XML templates), served
│                                              below /admin/api behind the Sulu admin firewall.
├── Service/
│   └── TemplateXmlManager.php                 Domain service: scans the configured directories, reads and
│                                              writes template files, validates XML, prevents path traversal.
├── Exception/
│   ├── TemplateNotFoundException.php          Thrown for unknown type/key → 404
│   └── InvalidTemplateException.php           Thrown for malformed XML / invalid key → 400
├── DependencyInjection/
│   ├── SuluBuilderExtension.php               Loads services.xml, exposes bundle configuration
│   └── Configuration.php                      Config tree: sulu_builder.template_directories
│
└── Resources/
    ├── config/
    │   ├── services.xml                       Service definitions & DI wiring (admin, service, controller)
    │   └── routing_api.yml                    API routes, imported by the project with the /admin/api prefix
    ├── translations/
    │   ├── admin.en.json                      Admin UI translations (Symfony "admin" domain — picked up
    │   └── admin.fr.json                      automatically by the Sulu admin translation endpoint)
    └── js/                                    Frontend package compiled by the Sulu admin webpack build
        ├── package.json                       npm package manifest ("sulu-builder-bundle")
        ├── index.js                           Registers the view in Sulu's viewRegistry
        └── views/
            ├── Builder.js                     React view (mobx + Sulu components: Breadcrumb, Table,
            │                                  Loader, withToolbar) — the "Sulu Builder" page
            └── builder.scss                   View styles (CSS modules, native Sulu spacing)
```

How the pieces connect:

1. `BuilderAdmin::configureViews()` registers the admin route `/builder` with the view
   type `sulu_builder.builder`.
2. `Resources/js/index.js` registers the React component under that same key in the
   `viewRegistry` — this is how Sulu knows which component to render.
3. `BuilderAdmin::configureNavigationItems()` adds the navigation entry pointing at the view.
4. The React view calls `GET /admin/api/builder/templates`, handled by
   `TemplateController` → `TemplateXmlManager`.

---

## 2. Installation (PHP side)

### 2.1 Require the bundle

The bundle is not on Packagist, so add it as a *path repository*. Copy the
`SuluBuilderBundle/` directory into your Sulu project (e.g. `bundles/SuluBuilderBundle`)
and add to the **project's** `composer.json`:

```json
{
    "repositories": [
        { "type": "path", "url": "bundles/SuluBuilderBundle" }
    ]
}
```

Then:

```bash
composer require melazhari/sulu-builder-bundle:"*@dev"
```

### 2.2 Register the bundle

In `config/bundles.php`:

```php
return [
    // ...
    Xxp\SuluBuilderBundle\SuluBuilderBundle::class => ['all' => true],
];
```

### 2.3 Register the API routes

Create `config/routes/sulu_builder_admin.yaml`:

```yaml
sulu_builder_api:
    resource: "@SuluBuilderBundle/Resources/config/routing_api.yml"
    prefix: /admin/api
```

(The `/builder` admin view route itself needs **no** Symfony route — Sulu's admin SPA
router creates it from `BuilderAdmin`.)

### 2.4 Optional configuration

Defaults scan `config/templates/pages` and `config/templates/snippets`. Override in
`config/packages/sulu_builder.yaml`:

```yaml
sulu_builder:
    template_directories:
        page: config/templates/pages
        snippet: config/templates/snippets
        form: config/templates/forms
```

### 2.5 Clear the cache

```bash
bin/console cache:clear
```

---

## 3. Building the Administration frontend

Sulu's admin UI is a single webpack build living in `assets/admin` of your project.

### 3.1 Register the JS package

In `assets/admin/package.json` add the dependency (path relative to `assets/admin`):

```json
{
    "dependencies": {
        "sulu-builder-bundle": "file:../../vendor/melazhari/sulu-builder-bundle/Resources/js"
    }
}
```

### 3.2 Import it in the admin entry point

In `assets/admin/app.js` (or `index.js`, depending on your skeleton version):

```js
// existing imports…
import 'sulu-builder-bundle';
```

> Alternative without npm package: skip 3.1 and import by relative path instead:
> `import '../../vendor/melazhari/sulu-builder-bundle/Resources/js';`

### 3.3 Build

```bash
cd assets/admin
npm install
npm run build        # production build
# or during development:
npm run watch
```

> Note: once you customize the admin UI you must build it yourself —
> `bin/adminconsole sulu:admin:update-build` (which downloads the pre-built default
> bundle) can no longer be used.

---

## 4. Permissions

The bundle registers the security context `sulu.builder.templates` under the
**"Sulu Builder"** group. After installation, go to
**Settings → User roles** in the Administration and grant *View* (and *Edit* if you
want saving) to the relevant roles. The navigation item is hidden for users without
the *View* permission.

---

## 5. API

| Method | URL                                        | Description                                |
|--------|--------------------------------------------|--------------------------------------------|
| GET    | `/admin/api/builder/templates`             | List all templates of all configured types |
| GET    | `/admin/api/builder/templates/{type}/{key}`| Get the raw XML content of one template    |
| PUT    | `/admin/api/builder/templates/{type}/{key}`| Save content: `{"content": "<template>…"}` — validates well-formed XML |

---

## 6. Extending

- **New template types**: add a directory to `sulu_builder.template_directories`.
- **New views** (e.g. an edit view): add a `createViewBuilder()` call in
  `BuilderAdmin::configureViews()` and register the matching React component in
  `Resources/js/index.js`.
- **Visual builder**: the existing standalone XML builder UI can be ported into
  `Resources/js/views/` as additional React components; the load/save API is already
  in place.

## Theming & responsiveness

The view reuses Sulu Admin components (`Table`, `Breadcrumb`, `Loader`, toolbar via
`withToolbar`), so typography, colors, icons and spacing are inherited from the Sulu
admin theme. Sulu ≤ 2.6 ships a single (light) theme; because no colors are hard-coded
in the components used, a future Sulu dark theme will apply automatically. The layout
is fluid and adds reduced padding below 700px.
