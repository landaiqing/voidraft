import {Extension} from '@codemirror/state';
import {
    crosshairCursor,
    drawSelection,
    dropCursor,
    EditorView,
    highlightActiveLine,
    highlightActiveLineGutter,
    highlightSpecialChars,
    keymap,
    lineNumbers,
    rectangularSelection,
} from '@codemirror/view';
import {
    bracketMatching,
    defaultHighlightStyle,
    foldGutter,
    indentOnInput,
    syntaxHighlighting,
} from '@codemirror/language';
import {history} from '@codemirror/commands';
import {highlightSelectionMatches} from '@codemirror/search';
import {autocompletion, closeBrackets, closeBracketsKeymap} from '@codemirror/autocomplete';
// 基本编辑器设置
export const createBasicSetup = (): Extension[] => {
    return [
        // 基础UI
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        dropCursor(),
        EditorView.lineWrapping,

        // 历史记录
        history(),

        // 代码折叠
        foldGutter(),

        // 选择与高亮
        drawSelection(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        rectangularSelection(),
        crosshairCursor(),

        // 缩进和编辑辅助
        indentOnInput(),
        syntaxHighlighting(defaultHighlightStyle, {fallback: true}),
        bracketMatching(),
        closeBrackets(),

        // 自动完成
        autocompletion(),

        // 键盘映射
        keymap.of([
            ...closeBracketsKeymap,
        ]),
    ];
};