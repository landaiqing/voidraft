import type { Directive, DirectiveBinding } from 'vue';

type ClickOutsideHandler = (event: MouseEvent) => void;

interface ClickOutsideElement extends HTMLElement {
  _clickOutsideHandler?: (event: MouseEvent) => void;
}

/**
 * v-click-outside directive
 * Triggers a callback when clicking outside the element
 *
 * Usage:
 * <div v-click-outside="handleClickOutside">...</div>
 */
export const clickOutside: Directive<ClickOutsideElement, ClickOutsideHandler> = {
  mounted(el: ClickOutsideElement, binding: DirectiveBinding<ClickOutsideHandler>) {
    const handler = (event: MouseEvent) => {
      const target = event.target as Node;
      if (el && !el.contains(target)) {
        binding.value(event);
      }
    };

    el._clickOutsideHandler = handler;
    document.addEventListener('click', handler);
  },

  unmounted(el: ClickOutsideElement) {
    if (el._clickOutsideHandler) {
      document.removeEventListener('click', el._clickOutsideHandler);
      delete el._clickOutsideHandler;
    }
  }
};

export default clickOutside;
