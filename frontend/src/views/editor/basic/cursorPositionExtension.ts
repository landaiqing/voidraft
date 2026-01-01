import {EditorView, ViewPlugin, ViewUpdate} from '@codemirror/view';
import {useEditorStateStore} from '@/stores/editorStateStore';
import {createDebounce} from '@/common/utils/debounce';

/**
 * 光标位置持久化扩展
 * 实时监听光标位置变化并持久化到 editorStateStore
 */
export function createCursorPositionExtension(documentId: number) {
    return ViewPlugin.fromClass(
        class CursorPositionPlugin {
            private readonly editorStateStore = useEditorStateStore();
            private readonly debouncedSave;

            constructor(private view: EditorView) {
                const {debouncedFn, flush} = createDebounce(
                    () => this.saveCursorPosition(),
                    {delay: 1000}
                );
                this.debouncedSave = {fn: debouncedFn, flush};

                // 初始化时保存一次光标位置
                this.saveCursorPosition();
            }

            update(update: ViewUpdate) {
                // 只在选择变化时触发
                if (!update.selectionSet) {
                    return;
                }

                // 防抖保存光标位置
                this.debouncedSave.fn();
            }

            destroy() {
                // 销毁时立即执行待保存的操作
                this.debouncedSave.flush();
                // 再保存一次确保最新状态
                this.saveCursorPosition();
            }

            private saveCursorPosition() {
                const cursorPos = this.view.state.selection.main.head;
                this.editorStateStore.saveCursorPosition(documentId, cursorPos);
            }
        }
    );
}

/**
 * 滚动到当前光标位置（视口中心）
 * @param view 编辑器视图
 */
export function scrollToCursor(view: EditorView) {
    const cursorPos = view.state.selection.main.head;
    view.dispatch({
        effects: EditorView.scrollIntoView(cursorPos, {
            y: 'center',
            x: 'center'
        })
    });
}

