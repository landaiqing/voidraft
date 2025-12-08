import type { EditorView } from '@codemirror/view';
import { readonly, shallowRef, type ShallowRef } from 'vue';
import type { RenderMenuItem } from './menuSchema';

interface MenuPosition {
  x: number;
  y: number;
}

interface ContextMenuState {
  visible: boolean;
  position: MenuPosition;
  items: RenderMenuItem[];
  view: EditorView | null;
}

class ContextMenuManager {
  private state: ShallowRef<ContextMenuState> = shallowRef({
    visible: false,
    position: { x: 0, y: 0 },
    items: [] as RenderMenuItem[],
    view: null as EditorView | null
  });

  useState() {
    return readonly(this.state);
  }

  show(view: EditorView, clientX: number, clientY: number, items: RenderMenuItem[]): void {
    const currentState = this.state.value;
    
    // 如果菜单已经显示，且位置很接近（20px范围内），则只更新内容，避免闪烁
    if (currentState.visible) {
      const dx = Math.abs(currentState.position.x - clientX);
      const dy = Math.abs(currentState.position.y - clientY);
      const isSamePosition = dx < 20 && dy < 20;
      
      if (isSamePosition) {
        // 只更新items和view，保持visible状态和位置
        this.state.value = {
          ...currentState,
          items,
          view
        };
        return;
      }
    }
    
    // 否则正常显示菜单
    this.state.value = {
      visible: true,
      position: { x: clientX, y: clientY },
      items,
      view
    };
  }

  hide(): void {
    if (!this.state.value.visible) {
      return;
    }

    const previousPosition = this.state.value.position;
    const view = this.state.value.view;
    this.state.value = {
      visible: false,
      position: previousPosition,
      items: [],
      view: null
    };

    if (view) {
      view.focus();
    }
  }

  runCommand(item: RenderMenuItem): void {
    if (item.type !== "action" || item.disabled) {
      return;
    }

    const { view } = this.state.value;
    if (item.command && view) {
      item.command(view);
    }
    this.hide();
  }

  destroy(): void {
    this.state.value = {
      visible: false,
      position: { x: 0, y: 0 },
      items: [],
      view: null
    };
  }
}

export const contextMenuManager = new ContextMenuManager();

export function showContextMenu(
  view: EditorView,
  clientX: number,
  clientY: number,
  items: RenderMenuItem[]
): void {
  contextMenuManager.show(view, clientX, clientY, items);
}
