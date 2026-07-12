/**
 * suluBridge.js
 * postMessage bridge used when the builder runs embedded (iframe) in the
 * Sulu Administration via the SuluBuilderBundle. Does nothing when the app
 * is opened standalone.
 *
 * Protocol (same-origin only):
 *   parent -> builder:
 *     {type: 'sulu-builder:load', xml}   load a template XML into the builder
 *     {type: 'sulu-builder:new'}         start from the starter project
 *     {type: 'sulu-builder:request-xml'} ask for the current XML
 *   builder -> parent:
 *     {type: 'sulu-builder:ready'}
 *     {type: 'sulu-builder:xml', xml, key, templateType}
 *     {type: 'sulu-builder:error', message}
 */
import { store, starterProject } from './state.js';
import { generateXml, importXml } from './xmlGenerator.js';

if (window.parent !== window) {
  const origin = window.location.origin;
  const post = (message) => window.parent.postMessage(message, origin);

  window.addEventListener('message', (event) => {
    if (event.origin !== origin) return;
    const data = event.data;
    if (!data || typeof data !== 'object') return;

    switch (data.type) {
      case 'sulu-builder:load':
        try {
          store.loadProject(importXml(data.xml), { resetHistory: true });
        } catch (e) {
          post({ type: 'sulu-builder:error', message: e.message });
        }
        break;

      case 'sulu-builder:new':
        store.loadProject(starterProject(), { resetHistory: true });
        break;

      case 'sulu-builder:request-xml':
        try {
          post({
            type: 'sulu-builder:xml',
            xml: generateXml(store.project),
            key: store.project.key,
            templateType: store.project.templateType,
          });
        } catch (e) {
          post({ type: 'sulu-builder:error', message: e.message });
        }
        break;
    }
  });

  post({ type: 'sulu-builder:ready' });
}
