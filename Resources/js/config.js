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
};

export default builderConfig;
