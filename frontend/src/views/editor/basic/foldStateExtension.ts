import {EditorView, ViewPlugin, ViewUpdate} from '@codemirror/view';
import {foldedRanges, foldEffect, unfoldEffect} from '@codemirror/language';
import {StateEffect} from '@codemirror/state';
import {useEditorStateStore, type FoldRange} from '@/stores/editorStateStore';
import {createDebounce} from '@/common/utils/debounce';

/**
 * 折叠状态持久化扩展
 */
export function createFoldStateExtension(documentId: number) {
    return ViewPlugin.fromClass(
        class FoldStatePlugin {
            private readonly editorStateStore = useEditorStateStore();
            private readonly debouncedSave;

            constructor(private view: EditorView) {
                const {debouncedFn, flush} = createDebounce(
                    () => this.saveFoldState(),
                    {delay: 500}
                );
                this.debouncedSave = {fn: debouncedFn, flush};
            }

            update(update: ViewUpdate) {
                // 检查是否有折叠/展开操作
                const hasFoldChange = update.transactions.some(tr =>
                    tr.effects.some(effect =>
                        effect.is(foldEffect) || effect.is(unfoldEffect)
                    )
                );

                if (hasFoldChange) {
                    this.debouncedSave.fn();
                }
            }

            destroy() {
                // 销毁时立即执行待保存的操作
                this.debouncedSave.flush();
                // 再保存一次确保最新状态
                this.saveFoldState();
            }

            private saveFoldState() {
                const foldRanges: FoldRange[] = [];
                const foldCursor = foldedRanges(this.view.state).iter();
                const doc = this.view.state.doc;

                // 遍历所有折叠区间
                while (foldCursor.value !== null) {
                    const from = foldCursor.from;
                    const to = foldCursor.to;
                    
                    // 同时记录字符偏移和行号
                    const fromLine = doc.lineAt(from).number;
                    const toLine = doc.lineAt(to).number;
                    
                    foldRanges.push({
                        from,
                        to,
                        fromLine,
                        toLine
                    });
                    
                    foldCursor.next();
                }

                this.editorStateStore.saveFoldState(documentId, foldRanges);
            }
        }
    );
}

/**
 * 恢复折叠状态（基于行号，更稳定）
 * @param view 编辑器视图
 * @param foldRanges 要恢复的折叠区间
 */
export function restoreFoldState(view: EditorView, foldRanges: FoldRange[]) {
    if (foldRanges.length === 0) return;

    const doc = view.state.doc;
    const effects: StateEffect<any>[] = [];

    for (const range of foldRanges) {
        try {
            // 优先使用行号恢复
            if (range.fromLine && range.toLine) {
                // 确保行号在有效范围内
                if (range.fromLine >= 1 && range.toLine <= doc.lines && range.fromLine <= range.toLine) {
                    const fromPos = doc.line(range.fromLine).from;
                    const toPos = doc.line(range.toLine).to;
                    
                    effects.push(foldEffect.of({from: fromPos, to: toPos}));
                    continue;
                }
            }
            
            // 使用字符偏移
            if (range.from >= 0 && range.to <= doc.length && range.from < range.to) {
                effects.push(foldEffect.of({from: range.from, to: range.to}));
            }
        } catch (error) {
            // 忽略无效的折叠区间
            console.warn('Failed to restore fold range:', range, error);
        }
    }

    if (effects.length > 0) {
        view.dispatch({effects});
    }
}

