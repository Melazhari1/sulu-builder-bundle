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

namespace Xxp\SuluBuilderBundle\DependencyInjection;

use Symfony\Component\Config\Definition\Builder\TreeBuilder;
use Symfony\Component\Config\Definition\ConfigurationInterface;

class Configuration implements ConfigurationInterface
{
    public function getConfigTreeBuilder(): TreeBuilder
    {
        $treeBuilder = new TreeBuilder('sulu_builder');

        $treeBuilder->getRootNode()
            ->children()
                ->arrayNode('template_directories')
                    ->info('Map of template type => directory (relative to kernel.project_dir) scanned for XML templates.')
                    ->useAttributeAsKey('type')
                    ->scalarPrototype()->end()
                    ->defaultValue([
                        'page' => 'config/templates/pages',
                        'snippet' => 'config/templates/snippets',
                    ])
                ->end()
            ->end();

        return $treeBuilder;
    }
}
