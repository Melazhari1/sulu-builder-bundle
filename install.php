#!/usr/bin/env php
<?php

/*
 * This file is part of the SuluBuilderBundle.
 *
 * (c) XXP
 *
 * This source file is subject to the MIT license that is bundled
 * with this source code in the file LICENSE.
 *
 * Automated installer: configures a Sulu 2.x project for the bundle.
 * Run it from the root of your Sulu project:
 *
 *     php vendor/melazhari/sulu-builder-bundle/install.php
 *
 * Options:
 *     --project-dir=<path>   Sulu project root (default: current directory)
 *     --admin-prefix=<path>  Admin URL prefix (default: auto-detected, "/admin")
 *     --dry-run              Show what would be changed without writing anything
 *     --help                 Show this help
 *
 * What it does (idempotent — safe to re-run):
 *   1. Registers the bundle in config/bundles.php
 *   2. Detects the admin prefix from config/routes/sulu_admin.yaml
 *   3. Creates config/routes/sulu_builder_admin.yaml with "<prefix>/api"
 *   4. Creates config/packages/sulu_builder.yaml (commented defaults)
 *   5. Adds the "sulu-builder-bundle" dependency to assets/admin/package.json
 *   6. Adds the import to the admin entry point (assets/admin/app.js or index.js)
 *
 * Remaining manual steps are printed at the end (npm build, cache:clear, permissions).
 */

if ('cli' !== \PHP_SAPI) {
    echo "install.php must be run from the command line.\n";
    exit(1);
}

\error_reporting(\E_ALL);

$options = [
    'project-dir' => \getcwd(),
    'admin-prefix' => null,
    'dry-run' => false,
];

foreach (\array_slice($argv, 1) as $argument) {
    if ('--help' === $argument || '-h' === $argument) {
        echo "Usage: php install.php [--project-dir=<path>] [--admin-prefix=/admin] [--dry-run]\n";
        echo "Configures a Sulu 2.x project for the SuluBuilderBundle (see INSTALL.md).\n";
        exit(0);
    }

    if ('--dry-run' === $argument) {
        $options['dry-run'] = true;
        continue;
    }

    if (0 === \strpos($argument, '--project-dir=')) {
        $options['project-dir'] = \substr($argument, 14);
        continue;
    }

    if (0 === \strpos($argument, '--admin-prefix=')) {
        $options['admin-prefix'] = '/' . \trim(\substr($argument, 15), '/');
        continue;
    }

    fail(\sprintf('Unknown option "%s". Use --help.', $argument));
}

/**
 * @return void
 */
function fail($message)
{
    \fwrite(\STDERR, '[ERROR] ' . $message . "\n");
    exit(1);
}

/**
 * @return void
 */
function info($status, $message)
{
    echo \sprintf("[%s] %s\n", $status, $message);
}

/**
 * @return void
 */
function writeFileChecked($path, $content, $dryRun)
{
    if ($dryRun) {
        info('DRY', \sprintf('Would write %s', $path));

        return;
    }

    $directory = \dirname($path);
    if (!\is_dir($directory) && !\mkdir($directory, 0775, true)) {
        fail(\sprintf('Could not create directory "%s".', $directory));
    }

    if (false === \file_put_contents($path, $content)) {
        fail(\sprintf('Could not write "%s".', $path));
    }
}

/**
 * Computes a relative path from one directory to another (both must exist).
 *
 * @return string
 */
function relativePath($from, $to)
{
    $normalize = static function ($path) {
        $real = \realpath($path);

        return \str_replace('\\', '/', false !== $real ? $real : $path);
    };

    $fromParts = \explode('/', \rtrim($normalize($from), '/'));
    $toParts = \explode('/', \rtrim($normalize($to), '/'));

    while (\count($fromParts) && \count($toParts) && $fromParts[0] === $toParts[0]) {
        \array_shift($fromParts);
        \array_shift($toParts);
    }

    $relative = \str_repeat('../', \count($fromParts)) . \implode('/', $toParts);

    return '' !== $relative ? \rtrim($relative, '/') : '.';
}

$projectDir = \rtrim(\str_replace('\\', '/', $options['project-dir']), '/');
$bundleDir = \str_replace('\\', '/', __DIR__);
$dryRun = $options['dry-run'];

$bundlesFile = $projectDir . '/config/bundles.php';

if (!\is_file($bundlesFile)) {
    fail(\sprintf(
        '"%s" not found — "%s" does not look like a Sulu/Symfony project root. Use --project-dir=<path>.',
        $bundlesFile,
        $projectDir
    ));
}

echo "SuluBuilderBundle installer\n";
echo \sprintf("Project: %s%s\n\n", $projectDir, $dryRun ? ' (dry run)' : '');

/*
 * 1. Register the bundle in config/bundles.php
 */
$bundlesContent = (string) \file_get_contents($bundlesFile);

if (false !== \strpos($bundlesContent, 'SuluBuilderBundle::class')) {
    info('SKIP', 'config/bundles.php — bundle already registered');
} else {
    $registration = "    Xxp\\SuluBuilderBundle\\SuluBuilderBundle::class => ['all' => true],\n";
    $position = \strrpos($bundlesContent, '];');

    if (false === $position) {
        fail('config/bundles.php has an unexpected format — register the bundle manually (see INSTALL.md step 2).');
    }

    writeFileChecked(
        $bundlesFile,
        \substr($bundlesContent, 0, $position) . $registration . \substr($bundlesContent, $position),
        $dryRun
    );
    info($dryRun ? 'DRY' : 'OK', 'config/bundles.php — bundle registered');
}

/*
 * 2. Detect the admin prefix (unless given via --admin-prefix)
 */
$adminPrefix = $options['admin-prefix'];

if (null === $adminPrefix) {
    $adminPrefix = '/admin';
    $suluAdminRoutes = $projectDir . '/config/routes/sulu_admin.yaml';

    if (\is_file($suluAdminRoutes)
        && \preg_match('/^\s*prefix:\s*([^\s#]+)/m', (string) \file_get_contents($suluAdminRoutes), $matches)
    ) {
        $adminPrefix = '/' . \trim(\trim($matches[1], '"\''), '/');
    }
}

info('INFO', \sprintf('Admin prefix: %s', $adminPrefix));

/*
 * 3. Create config/routes/sulu_builder_admin.yaml
 */
$routesFile = $projectDir . '/config/routes/sulu_builder_admin.yaml';

if (\is_file($routesFile)) {
    info('SKIP', 'config/routes/sulu_builder_admin.yaml — already exists');
} else {
    writeFileChecked(
        $routesFile,
        "sulu_builder_api:\n"
        . "    resource: \"@SuluBuilderBundle/Resources/config/routing_api.yml\"\n"
        . \sprintf("    prefix: %s/api\n", $adminPrefix),
        $dryRun
    );
    info($dryRun ? 'DRY' : 'OK', \sprintf('config/routes/sulu_builder_admin.yaml — created (prefix %s/api)', $adminPrefix));
}

/*
 * 4. Create config/packages/sulu_builder.yaml with commented defaults
 */
$packageFile = $projectDir . '/config/packages/sulu_builder.yaml';

if (\is_file($packageFile)) {
    info('SKIP', 'config/packages/sulu_builder.yaml — already exists');
} else {
    writeFileChecked(
        $packageFile,
        "# SuluBuilderBundle configuration. Defaults shown below — uncomment to customize.\n"
        . "# sulu_builder:\n"
        . "#     template_directories:\n"
        . "#         page: config/templates/pages\n"
        . "#         snippet: config/templates/snippets\n",
        $dryRun
    );
    info($dryRun ? 'DRY' : 'OK', 'config/packages/sulu_builder.yaml — created (commented defaults)');
}

/*
 * 5. Add the npm dependency to assets/admin/package.json
 */
$adminAssetsDir = $projectDir . '/assets/admin';
$packageJsonFile = $adminAssetsDir . '/package.json';

if (!\is_file($packageJsonFile)) {
    info('WARN', 'assets/admin/package.json not found — add the npm dependency manually (INSTALL.md step 6)');
} else {
    $packageJson = \json_decode((string) \file_get_contents($packageJsonFile), true);

    if (!\is_array($packageJson)) {
        fail('assets/admin/package.json contains invalid JSON.');
    }

    if (isset($packageJson['dependencies']['sulu-builder-bundle'])) {
        info('SKIP', 'assets/admin/package.json — dependency already present');
    } else {
        $jsPath = relativePath($adminAssetsDir, $bundleDir . '/Resources/js');
        $packageJson['dependencies']['sulu-builder-bundle'] = 'file:' . $jsPath;
        \ksort($packageJson['dependencies']);

        writeFileChecked(
            $packageJsonFile,
            \json_encode($packageJson, \JSON_PRETTY_PRINT | \JSON_UNESCAPED_SLASHES) . "\n",
            $dryRun
        );
        info($dryRun ? 'DRY' : 'OK', \sprintf('assets/admin/package.json — added "sulu-builder-bundle": "file:%s"', $jsPath));
    }
}

/*
 * 6. Add the import to the admin entry point
 */
$entryPoint = null;
foreach (['app.js', 'index.js'] as $candidate) {
    if (\is_file($adminAssetsDir . '/' . $candidate)) {
        $entryPoint = $adminAssetsDir . '/' . $candidate;
        break;
    }
}

if (null === $entryPoint) {
    info('WARN', 'assets/admin/app.js (or index.js) not found — add the import manually (INSTALL.md step 6)');
} else {
    $entryContent = (string) \file_get_contents($entryPoint);
    $entryName = 'assets/admin/' . \basename($entryPoint);

    if (false !== \strpos($entryContent, 'sulu-builder-bundle')) {
        info('SKIP', \sprintf('%s — import already present', $entryName));
    } else {
        $importLine = "import 'sulu-builder-bundle';";

        if (\preg_match_all('/^import\s.*$/m', $entryContent, $matches, \PREG_OFFSET_CAPTURE) > 0) {
            $lastImport = \end($matches[0]);
            $insertAt = $lastImport[1] + \strlen($lastImport[0]);
            $entryContent = \substr($entryContent, 0, $insertAt) . "\n" . $importLine . \substr($entryContent, $insertAt);
        } else {
            $entryContent = $importLine . "\n" . $entryContent;
        }

        writeFileChecked($entryPoint, $entryContent, $dryRun);
        info($dryRun ? 'DRY' : 'OK', \sprintf('%s — import added', $entryName));
    }
}

/*
 * Summary
 */
echo "\nDone. Remaining manual steps:\n";
echo "  1. Build the admin frontend:   cd assets/admin && npm install && npm run build\n";
echo "  2. Clear the cache:            bin/console cache:clear\n";
echo "  3. Grant permissions:          Administration > Settings > User roles > \"Sulu Builder\"\n";

if ($dryRun) {
    echo "\n(dry run — no files were changed)\n";
}
