import {Extension} from "@codemirror/state"
import {createBaseTheme} from '../base'
import type {ThemeColors} from '../types'

// Using https://github.com/one-dark/vscode-one-dark-theme/ as reference for the colors

const chalky = "#e5c07b",
    coral = "#e06c75",
    cyan = "#56b6c2",
    invalid = "#ffffff",
    ivory = "#abb2bf",
    stone = "#7d8799", // Brightened compared to original to increase contrast
    malibu = "#61afef",
    sage = "#98c379",
    whiskey = "#d19a66",
    violet = "#c678dd",
    darkBackground = "#21252b",
    highlightBackground = "#313949FF",
    background = "#282c34",
    tooltipBackground = "#353a42",
    selection = "#3E4451",
    cursor = "#528bff"

export const config: ThemeColors = {
  name: 'one-dark',
  dark: true,
  
  // 基础色调
  background: background,
  backgroundSecondary: highlightBackground,
  surface: tooltipBackground,
  dropdownBackground: darkBackground,
  dropdownBorder: stone,
  
  // 文本颜色
  foreground: ivory,
  foregroundSecondary: stone,
  comment: stone,
  
  // 语法高亮色 - 核心
  keyword: violet,
  string: sage,
  function: malibu,
  number: chalky,
  operator: cyan,
  variable: coral,
  type: chalky,
  
  // 语法高亮色 - 扩展
  constant: whiskey,
  storage: violet,
  parameter: coral,
  class: chalky,
  heading: coral,
  invalid: invalid,
  regexp: cyan,
  
  // 界面元素
  cursor: cursor,
  selection: selection,
  selectionBlur: selection,
  activeLine: '#6699ff0b',
  lineNumber: stone,
  activeLineNumber: ivory,
  
  // 边框和分割线
  borderColor: darkBackground,
  borderLight: ivory + '19',
  
  // 搜索和匹配
  searchMatch: malibu,
  matchingBracket: '#bad0f847',
}

// 使用通用主题工厂函数创建 One Dark 主题
export const oneDark: Extension = createBaseTheme(config)