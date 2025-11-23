import type { EditorView } from '@codemirror/view';
import { readonly, shallowRef, type ShallowRef } from 'vue';

interface TranslatorPosition {
  x: number;
  y: number;
}

interface TranslatorState {
  visible: boolean;
  position: TranslatorPosition;
  sourceText: string;
  view: EditorView | null;
}

class TranslatorManager {
  private state: ShallowRef<TranslatorState> = shallowRef({
    visible: false,
    position: { x: 0, y: 0 },
    sourceText: '',
    view: null
  });

  useState() {
    return readonly(this.state);
  }

  show(view: EditorView, clientX: number, clientY: number, text: string): void {
    this.state.value = {
      visible: true,
      position: { x: clientX, y: clientY },
      sourceText: text,
      view
    };
  }

  hide(): void {
    if (!this.state.value.visible) {
      return;
    }

    const view = this.state.value.view;
    this.state.value = {
      visible: false,
      position: { x: 0, y: 0 },
      sourceText: '',
      view: null
    };

    if (view) {
      view.focus();
    }
  }

  destroy(): void {
    this.state.value = {
      visible: false,
      position: { x: 0, y: 0 },
      sourceText: '',
      view: null
    };
  }
}

export const translatorManager = new TranslatorManager();

