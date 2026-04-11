import type {EditorView} from '@codemirror/view';
import {shallowReadonly, shallowRef, type ShallowRef} from 'vue';

interface InlineImageDrawState {
  visible: boolean;
  tagId: string;
  assetRef: string;
  imageUrl: string;
  view: EditorView | null;
}

class InlineImageDrawManager {
  private state: ShallowRef<InlineImageDrawState> = shallowRef({
    visible: false,
    tagId: '',
    assetRef: '',
    imageUrl: '',
    view: null,
  });

  useState() {
    return shallowReadonly(this.state);
  }

  show(view: EditorView, tagId: string, assetRef: string, imageUrl: string): void {
    this.state.value = {
      visible: true,
      tagId,
      assetRef,
      imageUrl,
      view,
    };
  }

  hide(): void {
    if (!this.state.value.visible) {
      return;
    }

    const view = this.state.value.view;
    this.state.value = {
      visible: false,
      tagId: '',
      assetRef: '',
      imageUrl: '',
      view: null,
    };

    if (view) {
      view.focus();
    }
  }

  destroy(): void {
    this.state.value = {
      visible: false,
      tagId: '',
      assetRef: '',
      imageUrl: '',
      view: null,
    };
  }
}

export const inlineImageDrawManager = new InlineImageDrawManager();
