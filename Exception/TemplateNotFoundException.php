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

namespace Xxp\SuluBuilderBundle\Exception;

class TemplateNotFoundException extends \RuntimeException
{
    public function __construct(string $type, string $key)
    {
        parent::__construct(\sprintf('Template "%s" of type "%s" was not found.', $key, $type));
    }
}
