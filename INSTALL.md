# Installing SuluBuilderBundle

Step-by-step installation into a Sulu 2.x project (Sulu 2.4 – 2.6, PHP >= 7.2,
Symfony 5.4 / 6.x).

> **About the admin prefix:** nothing in this bundle hard-codes `/admin`. The API
> routes take whatever prefix you choose in step 3, and the React view receives the
> final URLs at boot time from `BuilderAdmin::getConfig()`. If your project mounts the
> Sulu Administration somewhere else (e.g. `/backend`), just adjust the prefix in
> step 3 — no code change needed.

## Quick install (automatic)

After requiring the bundle with composer (step 1 below), run the bundled installer
from your project root:

```bash
php vendor/melazhari/sulu-builder-bundle/install.php
```

It performs steps 2–4 and the configuration edits of step 6 automatically:
registers the bundle in `config/bundles.php`, **auto-detects the admin prefix** from
`config/routes/sulu_admin.yaml`, creates the routes and package config files, adds the
npm dependency to `assets/admin/package.json` and the import to the admin entry point.
It is idempotent (safe to re-run; existing entries are skipped) and supports:

```bash
php vendor/melazhari/sulu-builder-bundle/install.php --dry-run              # preview only
php vendor/melazhari/sulu-builder-bundle/install.php --project-dir=/path    # explicit project root
php vendor/melazhari/sulu-builder-bundle/install.php --admin-prefix=/backend # override detection
```

Afterwards only steps 5 (cache), 6's build commands (`npm install && npm run build`)
and 7 (permissions) remain — the installer prints them as a reminder. If you prefer to
configure everything by hand, follow the steps below and skip the installer.

## 1. Require the bundle

**Option A — from GitHub (recommended):** add to your project's `composer.json`:

```json
{
    "repositories": [
        { "type": "vcs", "url": "https://github.com/Melazhari1/sulu-builder-bundle" }
    ]
}
```

```bash
composer require melazhari/sulu-builder-bundle:^1.0
```

**Option B — local path:** copy the `SuluBuilderBundle/` directory into your project
(e.g. `bundles/SuluBuilderBundle`) and add:

```json
{
    "repositories": [
        { "type": "path", "url": "bundles/SuluBuilderBundle" }
    ]
}
```

```bash
composer require melazhari/sulu-builder-bundle:"*@dev"
```

## 2. Register the bundle

In `config/bundles.php`:

```php
return [
    // ...
    Xxp\SuluBuilderBundle\SuluBuilderBundle::class => ['all' => true],
];
```

## 3. Register the API routes

Create `config/routes/sulu_builder_admin.yaml`. Use the **same prefix as your Sulu
Administration** followed by `/api` — look at the `prefix` used for `sulu_admin` in
`config/routes/sulu_admin.yaml` of your project (default: `/admin`):

```yaml
sulu_builder_api:
    resource: "@SuluBuilderBundle/Resources/config/routing_api.yml"
    prefix: /admin/api   # administration mounted on /admin (default)
    # prefix: /backend/api   # example: administration mounted on /backend
```

The `/builder` view route itself needs **no** entry here — Sulu's admin SPA router
creates it from `Admin/BuilderAdmin.php`, relative to wherever the administration is
mounted.

## 4. Optional configuration

Defaults scan `config/templates/pages` and `config/templates/snippets`. Override in
`config/packages/sulu_builder.yaml`:

```yaml
sulu_builder:
    template_directories:
        page: config/templates/pages
        snippet: config/templates/snippets
        form: config/templates/forms
```

## 5. Clear the cache

```bash
bin/console cache:clear
```

## 6. Build the Administration frontend

In `assets/admin/package.json` add the dependency (path relative to `assets/admin`;
adapt it if you installed via Option B):

```json
{
    "dependencies": {
        "sulu-builder-bundle": "file:../../vendor/melazhari/sulu-builder-bundle/Resources/js"
    }
}
```

In `assets/admin/app.js` (or `index.js`, depending on your skeleton version):

```js
// existing imports…
import 'sulu-builder-bundle';
```

Then build:

```bash
cd assets/admin
npm install
npm run build        # production build
# or during development:
npm run watch
```

> Once you customize the admin UI you must build it yourself —
> `bin/adminconsole sulu:admin:update-build` (which downloads the pre-built default
> bundle) can no longer be used.

## 7. Grant permissions

In the Administration go to **Settings → User roles** and grant *View* (and *Edit*
for saving) on the **"Sulu Builder"** context to the relevant roles. The navigation
item stays hidden for users without *View*.

## 8. Verify

1. Log into the Administration — a **"Sulu Builder"** item appears in the main navigation.
2. Clicking it opens the view at `<admin-prefix>/#/builder` and lists your XML templates.
3. `GET <admin-prefix>/api/builder/templates` (logged in) returns JSON.

## Troubleshooting

- **Menu item missing** → permission not granted (step 7) or cache not cleared (step 5).
- **Blank view / "view not found" in console** → frontend not rebuilt (step 6) or the
  `import 'sulu-builder-bundle';` line is missing.
- **404 on the API** → routes file missing or wrong prefix (step 3).
