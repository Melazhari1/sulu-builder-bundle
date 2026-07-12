// @flow
/**
 * Runtime configuration of the bundle's frontend.
 *
 * The endpoints are filled at admin boot time from BuilderAdmin::getConfig()
 * (see index.js), so the admin URL prefix is never hard-coded here. The values
 * below are only fallbacks matching a default Sulu installation.
 */
const builderConfig = {
    endpoints: {
        templates: '/admin/api/builder/templates',
    },
    // Embedded visual builder, published by "bin/console assets:install".
    builderUrl: '/bundles/sulubuilder/builder/index.html',
};

export function templateUrl(type: string, key: string): string {
    return builderConfig.endpoints.templates
        + '/' + encodeURIComponent(type)
        + '/' + encodeURIComponent(key);
}

export default builderConfig;
