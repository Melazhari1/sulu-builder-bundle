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

namespace Xxp\SuluBuilderBundle\Controller\Admin;

use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Xxp\SuluBuilderBundle\Exception\InvalidTemplateException;
use Xxp\SuluBuilderBundle\Exception\TemplateNotFoundException;
use Xxp\SuluBuilderBundle\Service\TemplateXmlManager;

/**
 * Admin API for the "Sulu Builder" view. Served below /admin/api and protected
 * by the Sulu admin firewall.
 */
class TemplateController
{
    private TemplateXmlManager $templateXmlManager;

    public function __construct(TemplateXmlManager $templateXmlManager)
    {
        $this->templateXmlManager = $templateXmlManager;
    }

    public function cgetAction(): Response
    {
        $templates = $this->templateXmlManager->listTemplates();

        return new JsonResponse([
            '_embedded' => [
                'templates' => $templates,
            ],
            'total' => \count($templates),
        ]);
    }

    public function getAction(string $type, string $key): Response
    {
        try {
            $content = $this->templateXmlManager->getTemplateContent($type, $key);
        } catch (TemplateNotFoundException $exception) {
            return new JsonResponse(['message' => $exception->getMessage()], Response::HTTP_NOT_FOUND);
        } catch (InvalidTemplateException $exception) {
            return new JsonResponse(['message' => $exception->getMessage()], Response::HTTP_BAD_REQUEST);
        }

        return new JsonResponse([
            'id' => $type . '/' . $key,
            'type' => $type,
            'key' => $key,
            'content' => $content,
        ]);
    }

    public function putAction(Request $request, string $type, string $key): Response
    {
        $data = \json_decode($request->getContent(), true);

        if (!\is_array($data) || !isset($data['content']) || !\is_string($data['content'])) {
            return new JsonResponse(
                ['message' => 'The request body must be a JSON object with a string "content" property.'],
                Response::HTTP_BAD_REQUEST
            );
        }

        try {
            $this->templateXmlManager->saveTemplateContent($type, $key, $data['content']);
        } catch (TemplateNotFoundException $exception) {
            return new JsonResponse(['message' => $exception->getMessage()], Response::HTTP_NOT_FOUND);
        } catch (InvalidTemplateException $exception) {
            return new JsonResponse(['message' => $exception->getMessage()], Response::HTTP_BAD_REQUEST);
        }

        return new JsonResponse([
            'id' => $type . '/' . $key,
            'type' => $type,
            'key' => $key,
            'content' => $data['content'],
        ]);
    }
}
