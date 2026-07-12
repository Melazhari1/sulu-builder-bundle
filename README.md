# SuluBuilderBundle

A production-ready Sulu CMS bundle that adds a **"Sulu Builder"** top-level item to the
Sulu Administration navigation. It lists the XML templates of your project (pages,
snippets, … — configurable), lets you **edit and save them** in a native Sulu Admin
editor view (with well-formed-XML validation on save), and ships the underlying JSON
admin API — ready to be extended into a full visual template builder.

- Compatible with **Sulu 2.4 – 2.6**, PHP >= 7.2, Symfony 5.4 / 6.x
- PSR-4 / PSR-12 compliant
- Uses only the Sulu Admin React ecosystem (no extra UI framework)
- Permissions integrated with Sulu's security contexts (Settings → User roles)

---

## 1. Bundle structure — where each file belongs

```
SuluBuilderBundle/
├── composer.json                              Package definition (type: symfony-bundle, PSR-4: Xxp\SuluBuilderBundle\)
├── INSTALL.md                                 Step-by-step installation instructions
├── install.php                                CLI installer: configures a Sulu project automatically (idempotent)
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
        ├── index.js                           Registers the view in Sulu's viewRegistry and the config hook
        ├── config.js                          Endpoint config, filled at boot from BuilderAdmin::getConfig()
        └── views/
            ├── Builder.js                     List view (mobx + Sulu components: Breadcrumb, Table,
            │                                  Icon, Loader, withToolbar) — the "Sulu Builder" page
            ├── BuilderEdit.js                 XML editor view ("/builder/:type/:key"): load, edit and
            │                                  save a template via the admin API (toolbar Save button)
            └── builder.scss                   View styles (CSS modules, native Sulu spacing)
```

How the pieces connect:

1. `BuilderAdmin::configureViews()` registers the admin route `/builder` with the view
   type `sulu_builder.builder`.
2. `Resources/js/index.js` registers the React component under that same key in the
   `viewRegistry` — this is how Sulu knows which component to render.
3. `BuilderAdmin::configureNavigationItems()` adds the navigation entry pointing at the view.
4. `BuilderAdmin::getConfig()` generates the API URLs from the named routes and hands
   them to the frontend at boot time (`initializer.addUpdateConfigHook` in
   `Resources/js/index.js`) — so the admin prefix (`/admin` by default) is **dynamic**,
   never hard-coded in JavaScript.
5. The React view calls the templates endpoint, handled by
   `TemplateController` → `TemplateXmlManager`.

---

## 2. Installation

Full step-by-step instructions (composer, bundle registration, routing, frontend
build, permissions, troubleshooting) live in **[INSTALL.md](INSTALL.md)**.

Most of the configuration can be done automatically — after `composer require`, run:

```bash
php vendor/melazhari/sulu-builder-bundle/install.php   # add --dry-run to preview
```

It registers the bundle, auto-detects the admin prefix, creates the routing/config
files and adds a relative import of the frontend sources to the admin entry point
(no npm linking — use `--npm` if you prefer a `file:` dependency). Only
`npm run build`, `cache:clear` and the permission grant remain manual.

The admin URL prefix is **dynamic**: the API routes take whatever prefix you choose
when importing `Resources/config/routing_api.yml` (default `/admin/api`), and the
React view receives the resulting URLs at runtime via `BuilderAdmin::getConfig()`.
Projects mounting the Administration on a custom path only adjust the routing prefix.

---

## 3. Permissions

The bundle registers the security context `sulu.builder.templates` under the
**"Sulu Builder"** group. After installation, go to
**Settings → User roles** in the Administration and grant *View* (and *Edit* if you
want saving) to the relevant roles. The navigation item is hidden for users without
the *View* permission.

---

## 4. API

URLs below assume the default `/admin/api` prefix — they follow whatever prefix your
project uses for the routing import.

| Method | URL                                        | Description                                |
|--------|--------------------------------------------|--------------------------------------------|
| GET    | `/admin/api/builder/templates`             | List all templates of all configured types |
| GET    | `/admin/api/builder/templates/{type}/{key}`| Get the raw XML content of one template    |
| PUT    | `/admin/api/builder/templates/{type}/{key}`| Save content: `{"content": "<template>…"}` — validates well-formed XML |

---

## 5. Extending

- **New template types**: add a directory to `sulu_builder.template_directories`.
- **New views**: add a `createViewBuilder()` call in
  `BuilderAdmin::configureViews()` and register the matching React component in
  `Resources/js/index.js` — the list ("/builder") and editor ("/builder/:type/:key")
  views show the pattern.
- **Visual builder**: the XML editor in `BuilderEdit.js` is a plain (dependency-free)
  code textarea; it can be swapped for a richer editor or a drag-and-drop builder —
  the load/save API and the view wiring stay the same.

## Theming & responsiveness

The view reuses Sulu Admin components (`Table`, `Breadcrumb`, `Loader`, toolbar via
`withToolbar`), so typography, colors, icons and spacing are inherited from the Sulu
admin theme. Sulu ≤ 2.6 ships a single (light) theme; because no colors are hard-coded
in the components used, a future Sulu dark theme will apply automatically. The layout
is fluid and adds reduced padding below 700px.
