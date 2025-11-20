import {EditorView} from '@codemirror/view';
import {HighlightStyle, syntaxHighlighting} from '@codemirror/language';
import {tags} from '@lezer/highlight';
import {Extension} from '@codemirror/state';
import type {ThemeColors} from './types';

const MONO_FONT_FALLBACK = 'var(--voidraft-font-mono, SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace)';

/**
 * 创建通用主题
 * @param colors 主题颜色配置
 * @returns CodeMirror Extension数组
 */
export function createBaseTheme(colors: ThemeColors): Extension {
    // 编辑器主题样式
    const theme = EditorView.theme({

        '&': {
            backgroundColor: colors.background,
        },

        '.cm-editor': {
            backgroundColor: colors.background,
        },

        // 光标
        '.cm-cursor, .cm-dropCursor': {
            borderLeftColor: colors.cursor,
            borderLeftWidth: '2px',
            paddingTop: '4px',
            marginTop: '-2px',
        },

        // 选择背景
        '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground': {
            backgroundColor: colors.selection,
        },


        // 当前行高亮
        '.cm-activeLine': {
            backgroundColor: colors.activeLine
        },

        // 行号区域
        '.cm-gutters': {
            backgroundColor: colors.dark ? 'rgba(0,0,0, 0.1)' : 'rgba(0,0,0, 0.04)',
            color: colors.lineNumber,
            border: 'none',
            padding: '0 2px 0 4px',
            userSelect: 'none',
        },
        '.cm-activeLineGutter': {
            backgroundColor: 'transparent',
            color: colors.activeLineNumber,
        },



        // 括号匹配
        '&.cm-focused .cm-matchingBracket, &.cm-focused .cm-nonmatchingBracket': {
            outline: `0.5px solid ${colors.matchingBracket}`,
        },

        // 代码块层（自定义）
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
        '.code-block-empty-selected': {
            backgroundColor: colors.selection,
        },
        // 代码块开始标记
        '.code-block-start': {
            height: '12px',
            position: 'relative',
        },
        '.code-block-start.first': {
            height: '0px',
        },

        // 数学计算结果
        '.code-blocks-math-result': {
            paddingLeft: "12px",
            position: "relative",
        },
        ".code-blocks-math-result .inner": {
            background: colors.dark ? '#0e1217' : '#48b57e',
            color: colors.dark ? '#a0e7c7' : '#fff',
            padding: '0px 4px',
            borderRadius: '2px',
            boxShadow: colors.dark ? '0 0 3px rgba(0,0,0, 0.3)' : '0 0 3px rgba(0,0,0, 0.1)',
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
            color: colors.dark ? 'rgba(220,240,230, 1.0)' : 'rgba(0,0,0, 0.8)',
        },
        '.code-blocks-math-result-copied.fade-out': {
            opacity: 0,
        },
    }, {dark: colors.dark});

    const highlightStyle = HighlightStyle.define([
        {tag: tags.comment, color: colors.comment, fontStyle: 'italic'},
        {tag: tags.lineComment, color: colors.lineComment, fontStyle: 'italic'},
        {tag: tags.blockComment, color: colors.blockComment, fontStyle: 'italic'},
        {tag: tags.docComment, color: colors.docComment, fontStyle: 'italic'},

        {tag: tags.name, color: colors.name},
        {tag: tags.variableName, color: colors.variableName},
        {tag: tags.typeName, color: colors.typeName},
        {tag: tags.tagName, color: colors.tagName},
        {tag: tags.propertyName, color: colors.propertyName},
        {tag: tags.attributeName, color: colors.attributeName},
        {tag: tags.className, color: colors.className},
        {tag: tags.labelName, color: colors.labelName},
        {tag: tags.namespace, color: colors.namespace},
        {tag: tags.macroName, color: colors.macroName},

        {tag: tags.literal, color: colors.literal},
        {tag: tags.string, color: colors.string},
        {tag: tags.docString, color: colors.docString},
        {tag: tags.character, color: colors.character},
        {tag: tags.attributeValue, color: colors.attributeValue},
        {tag: tags.number, color: colors.number},
        {tag: tags.integer, color: colors.integer},
        {tag: tags.float, color: colors.float},
        {tag: tags.bool, color: colors.bool},
        {tag: tags.regexp, color: colors.regexp},
        {tag: tags.escape, color: colors.escape},
        {tag: tags.color, color: colors.color},
        {tag: tags.url, color: colors.url},

        {tag: tags.keyword, color: colors.keyword},
        {tag: tags.self, color: colors.self},
        {tag: tags.null, color: colors.null},
        {tag: tags.atom, color: colors.atom},
        {tag: tags.unit, color: colors.unit},
        {tag: tags.modifier, color: colors.modifier},
        {tag: tags.operatorKeyword, color: colors.operatorKeyword},
        {tag: tags.controlKeyword, color: colors.controlKeyword},
        {tag: tags.definitionKeyword, color: colors.definitionKeyword},
        {tag: tags.moduleKeyword, color: colors.moduleKeyword},

        {tag: tags.operator, color: colors.operator},
        {tag: tags.derefOperator, color: colors.derefOperator},
        {tag: tags.arithmeticOperator, color: colors.arithmeticOperator},
        {tag: tags.logicOperator, color: colors.logicOperator},
        {tag: tags.bitwiseOperator, color: colors.bitwiseOperator},
        {tag: tags.compareOperator, color: colors.compareOperator},
        {tag: tags.updateOperator, color: colors.updateOperator},
        {tag: tags.definitionOperator, color: colors.definitionOperator},
        {tag: tags.typeOperator, color: colors.typeOperator},
        {tag: tags.controlOperator, color: colors.controlOperator},

        {tag: tags.punctuation, color: colors.punctuation},
        {tag: tags.separator, color: colors.separator},
        {tag: tags.bracket, color: colors.bracket},
        {tag: tags.angleBracket, color: colors.angleBracket},
        {tag: tags.squareBracket, color: colors.squareBracket},
        {tag: tags.paren, color: colors.paren},
        {tag: tags.brace, color: colors.brace},

        {tag: tags.content, color: colors.content},
        {tag: tags.heading, color: colors.heading, fontWeight: 'bold'},
        {tag: tags.heading1, color: colors.heading1, fontWeight: 'bold', fontSize: '1.4em'},
        {tag: tags.heading2, color: colors.heading2, fontWeight: 'bold', fontSize: '1.3em'},
        {tag: tags.heading3, color: colors.heading3, fontWeight: 'bold', fontSize: '1.2em'},
        {tag: tags.heading4, color: colors.heading4, fontWeight: 'bold', fontSize: '1.1em'},
        {tag: tags.heading5, color: colors.heading5, fontWeight: 'bold'},
        {tag: tags.heading6, color: colors.heading6, fontWeight: 'bold'},
        {tag: tags.contentSeparator, color: colors.contentSeparator},
        {tag: tags.list, color: colors.list},
        {tag: tags.quote, color: colors.quote, fontStyle: 'italic'},
        {tag: tags.emphasis, color: colors.emphasis, fontStyle: 'italic'},
        {tag: tags.strong, color: colors.strong, fontWeight: 'bold'},
        {tag: tags.link, color: colors.link, textDecoration: 'underline'},
        {tag: tags.monospace, color: colors.monospace, fontFamily: MONO_FONT_FALLBACK},
        {tag: tags.strikethrough, color: colors.strikethrough, textDecoration: 'line-through'},

        {tag: tags.inserted, color: colors.inserted},
        {tag: tags.deleted, color: colors.deleted},
        {tag: tags.changed, color: colors.changed},

        {tag: tags.meta, color: colors.meta, fontStyle: 'italic'},
        {tag: tags.documentMeta, color: colors.documentMeta},
        {tag: tags.annotation, color: colors.annotation},
        {tag: tags.processingInstruction, color: colors.processingInstruction},

        {tag: tags.definition(tags.variableName), color: colors.definition},
        {tag: tags.definition(tags.propertyName), color: colors.definition},
        {tag: tags.definition(tags.name), color: colors.definition},
        {tag: tags.constant(tags.variableName), color: colors.constant},
        {tag: tags.constant(tags.propertyName), color: colors.constant},
        {tag: tags.constant(tags.name), color: colors.constant},
        {tag: tags.function(tags.variableName), color: colors.function},
        {tag: tags.function(tags.propertyName), color: colors.function},
        {tag: tags.function(tags.name), color: colors.function},
        {tag: tags.standard(tags.variableName), color: colors.standard},
        {tag: tags.standard(tags.name), color: colors.standard},
        {tag: tags.local(tags.variableName), color: colors.local},
        {tag: tags.local(tags.name), color: colors.local},
        {tag: tags.special(tags.variableName), color: colors.special},
        {tag: tags.special(tags.name), color: colors.special},
        {tag: tags.special(tags.string), color: colors.special},

        {tag: tags.invalid, color: colors.invalid},
    ]);
    return [
        theme,
        syntaxHighlighting(highlightStyle),
    ];
}
