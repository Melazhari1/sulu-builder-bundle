<?php

declare(strict_types=1);

/*
 * This file is part of the SuluBuilderBundle.
 *
 * (c) XXP
 *
 * This source file is subject to the MIT license that is bundled
 * with this source code in the file LICENSE.
 */

namespace Xxp\SuluBuilderBundle\Service;

use Xxp\SuluBuilderBundle\Exception\InvalidTemplateException;
use Xxp\SuluBuilderBundle\Exception\TemplateNotFoundException;

/**
 * Reads and writes Sulu XML template files inside the configured directories.
 */
class TemplateXmlManager
{
    /**
     * @var string
     */
    private $projectDir;

    /**
     * @var array<string, string> Map of template type => directory relative to the project dir.
     */
    private $templateDirectories;

    /**
     * @param array<string, string> $templateDirectories
     */
    public function __construct(string $projectDir, array $templateDirectories)
    {
        $this->projectDir = \rtrim($projectDir, '/\\');
        $this->templateDirectories = $templateDirectories;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function listTemplates(): array
    {
        $templates = [];

        foreach ($this->templateDirectories as $type => $relativeDirectory) {
            $directory = $this->projectDir . \DIRECTORY_SEPARATOR . $relativeDirectory;

            if (!\is_dir($directory)) {
                continue;
            }

            $files = \glob($directory . \DIRECTORY_SEPARATOR . '*.xml') ?: [];

            foreach ($files as $file) {
                $key = \basename($file, '.xml');

                $templates[] = [
                    'id' => $type . '/' . $key,
                    'key' => $key,
                    'type' => $type,
                    'path' => $relativeDirectory . '/' . \basename($file),
                    'size' => \filesize($file),
                    'modified' => \date('c', (int) \filemtime($file)),
                ];
            }
        }

        \usort(
            $templates,
            static function (array $a, array $b) {
                return [$a['type'], $a['key']] <=> [$b['type'], $b['key']];
            }
        );

        return $templates;
    }

    public function getTemplateContent(string $type, string $key): string
    {
        $path = $this->resolvePath($type, $key);

        if (!\is_file($path)) {
            throw new TemplateNotFoundException($type, $key);
        }

        $content = \file_get_contents($path);

        if (false === $content) {
            throw new TemplateNotFoundException($type, $key);
        }

        return $content;
    }

    public function saveTemplateContent(string $type, string $key, string $content): void
    {
        $path = $this->resolvePath($type, $key);

        $this->assertWellFormedXml($content);

        $directory = \dirname($path);
        if (!\is_dir($directory)) {
            \mkdir($directory, 0775, true);
        }

        if (false === \file_put_contents($path, $content)) {
            throw new InvalidTemplateException(\sprintf('Template "%s/%s" could not be written.', $type, $key));
        }
    }

    /**
     * Resolves and validates the absolute file path for a template, preventing path traversal.
     */
    private function resolvePath(string $type, string $key): string
    {
        if (!isset($this->templateDirectories[$type])) {
            throw new TemplateNotFoundException($type, $key);
        }

        if (!\preg_match('/^[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+)*$/', $key)) {
            throw new InvalidTemplateException(\sprintf('"%s" is not a valid template key.', $key));
        }

        return $this->projectDir
            . \DIRECTORY_SEPARATOR . $this->templateDirectories[$type]
            . \DIRECTORY_SEPARATOR . $key . '.xml';
    }

    private function assertWellFormedXml(string $content): void
    {
        $previousUseInternalErrors = \libxml_use_internal_errors(true);

        $document = new \DOMDocument();
        $valid = $document->loadXML($content);

        $errors = \libxml_get_errors();
        \libxml_clear_errors();
        \libxml_use_internal_errors($previousUseInternalErrors);

        if (!$valid) {
            $firstError = $errors[0] ?? null;

            throw new InvalidTemplateException(
                $firstError
                    ? \sprintf('Invalid XML on line %d: %s', $firstError->line, \trim($firstError->message))
                    : 'The given content is not well-formed XML.'
            );
        }
    }
}
