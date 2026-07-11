// @flow
import {viewRegistry} from 'sulu-admin-bundle/containers';
import Builder from './views/Builder';

// The key must match the third argument of createViewBuilder() in Admin/BuilderAdmin.php.
viewRegistry.add('sulu_builder.builder', Builder);
