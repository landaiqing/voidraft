import type { App } from 'vue';
import { clickOutside } from './clickOutside';

export { clickOutside };

/**
 * Register all custom directives
 */
export function registerDirectives(app: App) {
  app.directive('click-outside', clickOutside);
}

export default registerDirectives;
