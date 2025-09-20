import {EditorView} from '@codemirror/view';
import {HighlightStyle, syntaxHighlighting} from '@codemirror/language';
import {tags} from '@lezer/highlight';

// 默认浅色主题颜色
export const defaultLightColors = {
    // 基础色调
    background: '#ffffff',        // 主背景色
    backgroundSecondary: '#f1faf1', // 次要背景色
    surface: '#f5f5f5',           // 面板背景

    // 文本颜色
    foreground: '#444d56',        // 主文本色
    foregroundSecondary: '#6a737d', // 次要文本色
    comment: '#6a737d',           // 注释色

    // 语法高亮色
    keyword: '#d73a49',           // 关键字
    string: '#032f62',            // 字符串
    function: '#005cc5',          // 函数名
    number: '#005cc5',            // 数字
    operator: '#d73a49',          // 操作符
    variable: '#24292e',          // 变量
    type: '#6f42c1',             // 类型

    // 界面元素
    cursor: '#000000',               // 光标
    selection: '#77baff',       // 选中背景
    selectionBlur: '#b2c2ca',   // 失焦选中背景
    activeLine: '#0000000a', // 当前行高亮
    lineNumber: '#00000040', // 行号
    activeLineNumber: '#000000aa', // 活动行号

    // 边框和分割线
    borderColor: '#dfdfdf',            // 边框色
    borderLight: '#0000000c', // 浅色边框

    // 搜索和匹配
    searchMatch: '#005cc5',       // 搜索匹配
    matchingBracket: '#00000019', // 匹配括号
};

// 创建浅色主题
export function createLightTheme(colors = defaultLightColors) {
    const lightTheme = EditorView.theme({
        '&': {
            color: colors.foreground,
            backgroundColor: colors.background,
        },

        // 确保编辑器容器背景一致
        '.cm-editor': {
            backgroundColor: colors.background,
        },

        // 确保滚动区域背景一致
        '.cm-scroller': {
            backgroundColor: colors.background,
        },

        // 编辑器内容
        '.cm-content': {
            caretColor: colors.cursor,
            paddingTop: '4px',
        },

        // 光标
        '.cm-cursor, .cm-dropCursor': {
            borderLeftColor: colors.cursor,
            borderLeftWidth: '2px',
            paddingTop: '4px',
            marginTop: '-2px',
        },

        // 选择
        '.cm-selectionBackground': {
            backgroundColor: colors.selectionBlur,
        },
        '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground': {
            backgroundColor: colors.selection,
        },
        '.cm-activeLine.code-empty-block-selected': {
            backgroundColor: colors.selection,
        },

        // 当前行高亮
        '.cm-activeLine': {
            backgroundColor: colors.activeLine
        },

        // 行号区域
        '.cm-gutters': {
            backgroundColor: 'rgba(0,0,0, 0.04)',
            color: colors.lineNumber,
            border: 'none',
            borderRight: `1px solid ${colors.borderLight}`,
            padding: '0 2px 0 4px',
            userSelect: 'none',
        },
        '.cm-activeLineGutter': {
            backgroundColor: 'transparent',
            color: colors.activeLineNumber,
        },

        // 折叠功能
        '.cm-foldGutter': {
            marginLeft: '0px',
        },
        '.cm-foldGutter .cm-gutterElement': {
            opacity: 0,
            transition: 'opacity 400ms',
        },
        '.cm-gutters:hover .cm-gutterElement': {
            opacity: 1,
        },
        '.cm-foldPlaceholder': {
            backgroundColor: 'transparent',
            border: 'none',
            color: colors.comment,
        },


        // 搜索匹配
        '.cm-searchMatch': {
            backgroundColor: 'transparent',
            outline: `1px solid ${colors.searchMatch}`,
        },
        '.cm-searchMatch.cm-searchMatch-selected': {
            backgroundColor: colors.searchMatch,
            color: colors.background,
        },
        '.cm-selectionMatch': {
            backgroundColor: '#e6f3ff',
        },

        // 括号匹配
        '&.cm-focused .cm-matchingBracket, &.cm-focused .cm-nonmatchingBracket': {
            outline: `0.5px solid ${colors.searchMatch}`,
        },
        '&.cm-focused .cm-matchingBracket': {
            backgroundColor: colors.matchingBracket,
            color: 'inherit',
        },
        '&.cm-focused .cm-nonmatchingBracket': {
            outline: '0.5px solid #d73a49',
        },

        // 编辑器焦点
        '&.cm-editor.cm-focused': {
            outline: 'none',
        },

        // 工具提示
        '.cm-tooltip': {
            border: 'none',
            backgroundColor: colors.surface,
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        },
        '.cm-tooltip .cm-tooltip-arrow:before': {
            borderTopColor: 'transparent',
            borderBottomColor: 'transparent',
        },
        '.cm-tooltip .cm-tooltip-arrow:after': {
            borderTopColor: colors.surface,
            borderBottomColor: colors.surface,
        },
        '.cm-tooltip-autocomplete': {
            '& > ul > li[aria-selected]': {
                backgroundColor: colors.activeLine,
                color: colors.foreground,
            },
        },

        // 代码块层
        '.code-blocks-layer': {
            width: '100%',
        },
        '.code-blocks-layer .block-even, .code-blocks-layer .block-odd': {
            width: '100%',
            boxSizing: 'content-box',
        },
        '.code-blocks-layer .block-even': {
            background: colors.background,
            borderTop: `1px solid ${colors.borderColor}`,
        },
        '.code-blocks-layer .block-even:first-child': {
            borderTop: 'none',
        },
        '.code-blocks-layer .block-odd': {
            background: colors.backgroundSecondary,
            borderTop: `1px solid ${colors.borderColor}`,
        },
        '.code-blocks-math-result': {
            paddingLeft: "12px",
            position: "relative",
        },
        '.code-blocks-math-result .inner': {
            background: '#48b57e',
            color: '#fff',
            padding: '0px 4px',
            borderRadius: '2px',
            boxShadow: '0 0 3px rgba(0,0,0, 0.1)',
            cursor: 'pointer',
            whiteSpace: "nowrap",
        },
        '.code-blocks-math-result-copied': {
            position: "absolute",
            top: "0px",
            left: "0px",
            marginLeft: "calc(100% + 10px)",
            width: "60px",
            transition: "opacity 500ms",
            transitionDelay: "1000ms",
            color: "rgba(0,0,0, 0.8)",
        },
        '.code-blocks-math-result-copied.fade-out': {
            opacity: 0,
        },

        // 代码块开始标记
        '.code-block-start': {
            height: '12px',
        },
        '.code-block-start.first': {
            height: '0px',
        },
    }, {dark: false});

    // 语法高亮样式
    const lightHighlightStyle = HighlightStyle.define([
        {tag: tags.keyword, color: colors.keyword},
        {tag: [tags.name, tags.deleted, tags.character, tags.propertyName, tags.macroName], color: colors.variable},
        {tag: [tags.variableName], color: colors.variable},
        {tag: [tags.function(tags.variableName)], color: colors.function},
        {tag: [tags.labelName], color: colors.operator},
        {tag: [tags.color, tags.constant(tags.name), tags.standard(tags.name)], color: colors.keyword},
        {tag: [tags.definition(tags.name), tags.separator], color: colors.function},
        {tag: [tags.brace], color: colors.variable},
        {tag: [tags.annotation], color: '#d73a49'},
        {
            tag: [tags.number, tags.changed, tags.annotation, tags.modifier, tags.self, tags.namespace],
            color: colors.number
        },
        {tag: [tags.typeName, tags.className], color: colors.type},
        {tag: [tags.operator, tags.operatorKeyword], color: colors.operator},
        {tag: [tags.tagName], color: colors.type},
        {tag: [tags.squareBracket], color: colors.keyword},
        {tag: [tags.angleBracket], color: colors.operator},
        {tag: [tags.attributeName], color: colors.variable},
        {tag: [tags.regexp], color: colors.string},
        {tag: [tags.quote], color: colors.comment},
        {tag: [tags.string], color: colors.string},
        {tag: tags.link, color: colors.function, textDecoration: 'underline'},
        {tag: [tags.url, tags.escape, tags.special(tags.string)], color: colors.string},
        {tag: [tags.meta], color: colors.comment},
        {tag: [tags.comment], color: colors.comment, fontStyle: 'italic'},
        {tag: tags.strong, fontWeight: 'bold'},
        {tag: tags.emphasis, fontStyle: 'italic'},
        {tag: tags.strikethrough, textDecoration: 'line-through'},
        {tag: tags.heading, fontWeight: 'bold', color: colors.keyword},
        {tag: [tags.heading1, tags.heading2], fontSize: '1.4em'},
        {tag: [tags.heading3, tags.heading4], fontSize: '1.2em'},
        {tag: [tags.heading5, tags.heading6], fontSize: '1.1em'},
    ]);

    return [
        lightTheme,
        syntaxHighlighting(lightHighlightStyle),
    ];
}

// 默认浅色主题
export const light = createLightTheme(defaultLightColors); 