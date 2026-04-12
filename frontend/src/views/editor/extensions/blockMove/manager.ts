import type { EditorView } from "@codemirror/view";
import { readonly, shallowRef, type ShallowRef } from "vue";
import type { Block } from "../codeblock/types";

interface MoveBlockState {
    visible: boolean;
    sourceView: EditorView | null;
    sourceBlock: Block | null;
    sourceDocumentId: number | null;
    position: { x: number; y: number } | null;
}

class MoveBlockManager {
    private state: ShallowRef<MoveBlockState> = shallowRef({
        visible: false,
        sourceView: null,
        sourceBlock: null,
        sourceDocumentId: null,
        position: null,
    });

    useState() {
        return readonly(this.state);
    }

    show(
        sourceView: EditorView,
        sourceBlock: Block,
        sourceDocumentId: number,
        position: { x: number; y: number } | null = null,
    ): void {
        this.state.value = {
            visible: true,
            sourceView,
            sourceBlock,
            sourceDocumentId,
            position,
        };
    }

    hide(options: { focusSourceView?: boolean } = {}): void {
        const view = this.state.value.sourceView;
        this.state.value = {
            visible: false,
            sourceView: null,
            sourceBlock: null,
            sourceDocumentId: null,
            position: null,
        };

        if (options.focusSourceView !== false) {
            view?.focus();
        }
    }

    destroy(): void {
        this.state.value = {
            visible: false,
            sourceView: null,
            sourceBlock: null,
            sourceDocumentId: null,
            position: null,
        };
    }
}

export const moveBlockManager = new MoveBlockManager();
