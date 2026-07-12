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

namespace Xxp\SuluBuilderBundle\Admin;

use Sulu\Bundle\AdminBundle\Admin\Admin;
use Sulu\Bundle\AdminBundle\Admin\Navigation\NavigationItem;
use Sulu\Bundle\AdminBundle\Admin\Navigation\NavigationItemCollection;
use Sulu\Bundle\AdminBundle\Admin\View\ViewBuilderFactoryInterface;
use Sulu\Bundle\AdminBundle\Admin\View\ViewCollection;
use Sulu\Component\Security\Authorization\PermissionTypes;
use Sulu\Component\Security\Authorization\SecurityCheckerInterface;
use Symfony\Component\Routing\Exception\RouteNotFoundException;
use Symfony\Component\Routing\Generator\UrlGeneratorInterface;

/**
 * Registers the "Sulu Builder" navigation item and its Administration view.
 */
class BuilderAdmin extends Admin
{
    public const SECURITY_CONTEXT = 'sulu.builder.templates';

    public const BUILDER_VIEW = 'sulu_builder.builder';

    /**
     * @var ViewBuilderFactoryInterface
     */
    private $viewBuilderFactory;

    /**
     * @var SecurityCheckerInterface
     */
    private $securityChecker;

    /**
     * @var UrlGeneratorInterface
     */
    private $urlGenerator;

    public function __construct(
        ViewBuilderFactoryInterface $viewBuilderFactory,
        SecurityCheckerInterface $securityChecker,
        UrlGeneratorInterface $urlGenerator
    ) {
        $this->viewBuilderFactory = $viewBuilderFactory;
        $this->securityChecker = $securityChecker;
        $this->urlGenerator = $urlGenerator;
    }

    public function configureNavigationItems(NavigationItemCollection $navigationItemCollection): void
    {
        if (!$this->securityChecker->hasPermission(static::SECURITY_CONTEXT, PermissionTypes::VIEW)) {
            return;
        }

        $navigationItem = new NavigationItem('sulu_builder.title');
        $navigationItem->setPosition(45);
        $navigationItem->setIcon('su-pen');
        $navigationItem->setView(static::BUILDER_VIEW);

        $navigationItemCollection->add($navigationItem);
    }

    public function configureViews(ViewCollection $viewCollection): void
    {
        if (!$this->securityChecker->hasPermission(static::SECURITY_CONTEXT, PermissionTypes::VIEW)) {
            return;
        }

        $viewCollection->add(
            $this->viewBuilderFactory
                ->createViewBuilder(static::BUILDER_VIEW, '/builder', static::BUILDER_VIEW)
        );
    }

    public function getConfigKey(): ?string
    {
        return 'sulu_builder';
    }

    /**
     * Exposes the API endpoints to the frontend so that no URL (including the
     * admin prefix, "/admin" by default) has to be hard-coded in JavaScript.
     *
     * @return mixed[]
     */
    public function getConfig(): ?array
    {
        try {
            $templatesUrl = $this->urlGenerator->generate('sulu_builder.cget_templates');
        } catch (RouteNotFoundException $exception) {
            // The project has not imported Resources/config/routing_api.yml yet
            // (INSTALL.md step 3). Degrade gracefully instead of breaking the
            // whole administration: the frontend falls back to its default
            // endpoint, and the missing routes surface as a warning.
            @\trigger_error(
                'SuluBuilderBundle: route "sulu_builder.cget_templates" is not registered.'
                . ' Import "@SuluBuilderBundle/Resources/config/routing_api.yml" in config/routes/'
                . ' (see INSTALL.md step 3) and clear the cache.',
                \E_USER_WARNING
            );

            return null;
        }

        return [
            'endpoints' => [
                'templates' => $templatesUrl,
            ],
        ];
    }

    /**
     * @return mixed[]
     */
    public function getSecurityContexts()
    {
        return [
            self::SULU_ADMIN_SECURITY_SYSTEM => [
                'Sulu Builder' => [
                    static::SECURITY_CONTEXT => [
                        PermissionTypes::VIEW,
                        PermissionTypes::ADD,
                        PermissionTypes::EDIT,
                        PermissionTypes::DELETE,
                    ],
                ],
            ],
        ];
    }
}
