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
    foldKeymap,
    indentOnInput,
    syntaxHighlighting,
} from '@codemirror/language';
import {defaultKeymap, history, historyKeymap,} from '@codemirror/commands';
import {highlightSelectionMatches, searchKeymap} from '@codemirror/search';
import {autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap} from '@codemirror/autocomplete';
import {lintKeymap} from '@codemirror/lint';
import {customHighlightActiveLine, defaultDark} from '@/editor/theme/default-dark';

// 基本编辑器设置，包含常用扩展
export const createBasicSetup = (): Extension[] => {
    return [
        // 主题相关
        defaultDark,

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
        customHighlightActiveLine,
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
            ...defaultKeymap,
            ...searchKeymap,
            ...historyKeymap,
            ...foldKeymap,
            ...completionKeymap,
            ...lintKeymap
        ]),
    ];
}; 