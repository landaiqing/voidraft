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
import {highlightSelectionMatches} from '@codemirror/search';
import {autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap} from '@codemirror/autocomplete';
import {lintKeymap} from '@codemirror/lint';
import {searchVisibilityField, vscodeSearch, customSearchKeymap} from './vscodeSearch';

import {hyperLink} from './hyperlink';
import {color} from './colorSelector';
import {textHighlighter} from './textHighlightExtension';
import {minimap} from './minimap';

// 基本编辑器设置
export const createBasicSetup = (): Extension[] => {
    return [
        vscodeSearch,
        searchVisibilityField,

        hyperLink,
        color,
        textHighlighter,
        minimap({
            displayText: 'characters',
            showOverlay: 'always',
            autohide: false,
        }),

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
            ...customSearchKeymap,
            ...closeBracketsKeymap,
            ...defaultKeymap,
            ...historyKeymap,
            ...foldKeymap,
            ...completionKeymap,
            ...lintKeymap
        ]),
    ];
};