import {EditorView} from '@codemirror/view';
import {HighlightStyle, syntaxHighlighting} from '@codemirror/language';
import {tags} from '@lezer/highlight';
import {Extension} from '@codemirror/state';
import type {ThemeColors} from './types';

/**
 * 创建通用主题
 * @param colors 主题颜色配置
 * @returns CodeMirror Extension数组
 */
export function createBaseTheme(colors: ThemeColors): Extension {
  // 编辑器主题样式
  const theme = EditorView.theme({
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
    '.cm-content ::selection': {
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
      backgroundColor: colors.dark ? 'rgba(0,0,0, 0.1)' : 'rgba(0,0,0, 0.04)',
      color: colors.lineNumber,
      border: 'none',
      borderRight: colors.dark ? 'none' : `1px solid ${colors.borderLight}`,
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

    // 面板
    '.cm-panels': {
      backgroundColor: colors.dropdownBackground,
      color: colors.foreground
    },
    '.cm-panels.cm-panels-top': {
      borderBottom: '2px solid black'
    },
    '.cm-panels.cm-panels-bottom': {
      borderTop: '2px solid black'
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
      backgroundColor: colors.dark ? '#50606D' : '#e6f3ff',
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
      outline: colors.dark ? '0.5px solid #bc8f8f' : '0.5px solid #d73a49',
    },

    // 编辑器焦点
    '&.cm-editor.cm-focused': {
      outline: 'none',
    },

    // 工具提示
    '.cm-tooltip': {
      border: colors.dark ? 'none' : `1px solid ${colors.dropdownBorder}`,
      backgroundColor: colors.surface,
      color: colors.foreground,
      boxShadow: colors.dark ? 'none' : '0 2px 8px rgba(0,0,0,0.1)',
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

    // 数学计算结果（自定义）
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

    // 代码块开始标记（自定义）
    '.code-block-start': {
      height: '12px',
      position: 'relative',
    },
    '.code-block-start.first': {
      height: '0px',
    },
  }, {dark: colors.dark});

  // 语法高亮样式
  const highlightStyle = HighlightStyle.define([
    // 关键字
    {tag: tags.keyword, color: colors.keyword},
    
    // 操作符
    {tag: [tags.operator, tags.operatorKeyword], color: colors.operator},
    
    // 名称、变量
    {tag: [tags.name, tags.deleted, tags.character, tags.macroName], color: colors.variable},
    {tag: [tags.variableName], color: colors.variable},
    {tag: [tags.labelName], color: colors.operator},
    {tag: [tags.atom, tags.bool, tags.special(tags.variableName)], color: colors.variable},
    
    // 函数
    {tag: [tags.function(tags.variableName)], color: colors.function},
    {tag: [tags.propertyName], color: colors.function},
    
    // 类型、类
    {tag: [tags.typeName], color: colors.type},
    {tag: [tags.className], color: colors.class},
    
    // 常量
    {tag: [tags.color, tags.constant(tags.name), tags.standard(tags.name)], color: colors.constant},
    
    // 字符串
    {tag: [tags.processingInstruction, tags.string, tags.inserted], color: colors.string},
    {tag: [tags.special(tags.string)], color: colors.string},
    {tag: [tags.quote], color: colors.comment},
    
    // 数字
    {tag: [tags.number, tags.changed, tags.annotation, tags.modifier, tags.self, tags.namespace], color: colors.number},
    
    // 正则表达式
    {tag: [tags.url, tags.escape, tags.regexp, tags.link], color: colors.regexp},
    
    // 注释
    {tag: [tags.meta, tags.comment], color: colors.comment, fontStyle: 'italic'},
    
    // 分隔符、括号
    {tag: [tags.definition(tags.name), tags.separator], color: colors.variable},
    {tag: [tags.brace], color: colors.variable},
    {tag: [tags.squareBracket], color: colors.dark ? '#bf616a' : colors.keyword},
    {tag: [tags.angleBracket], color: colors.dark ? '#d08770' : colors.operator},
    {tag: [tags.attributeName], color: colors.variable},
    
    // 标签
    {tag: [tags.tagName], color: colors.number},
    
    // 注解
    {tag: [tags.annotation], color: colors.invalid},
    
    // 特殊样式
    {tag: tags.strong, fontWeight: 'bold'},
    {tag: tags.emphasis, fontStyle: 'italic'},
    {tag: tags.strikethrough, textDecoration: 'line-through'},
    {tag: tags.link, color: colors.variable, textDecoration: 'underline'},
    
    // 标题
    {tag: tags.heading, fontWeight: 'bold', color: colors.heading},
    {tag: [tags.heading1, tags.heading2], fontSize: '1.4em'},
    {tag: [tags.heading3, tags.heading4], fontSize: '1.2em'},
    {tag: [tags.heading5, tags.heading6], fontSize: '1.1em'},
    
    // 无效内容
    {tag: tags.invalid, color: colors.invalid},
  ]);

  return [
    theme,
    syntaxHighlighting(highlightStyle),
  ];
}

