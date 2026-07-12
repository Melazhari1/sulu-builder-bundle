// @flow
import {viewRegistry} from 'sulu-admin-bundle/containers';
import {initializer} from 'sulu-admin-bundle/services';
import builderConfig from './config';
import Builder from './views/Builder';
import BuilderEdit from './views/BuilderEdit';

// The keys must match the third argument of createViewBuilder() in Admin/BuilderAdmin.php.
viewRegistry.add('sulu_builder.builder', Builder);
viewRegistry.add('sulu_builder.builder_edit', BuilderEdit);

// Receives BuilderAdmin::getConfig() at admin boot time. The key must match
// BuilderAdmin::getConfigKey(). This keeps the admin URL prefix dynamic:
// whatever prefix the project mounts routing_api.yml under is used as-is.
initializer.addUpdateConfigHook('sulu_builder', (config) => {
    if (config && config.endpoints) {
        builderConfig.endpoints = {...builderConfig.endpoints, ...config.endpoints};
    }
    if (config && config.builderUrl) {
        builderConfig.builderUrl = config.builderUrl;
    }
});
