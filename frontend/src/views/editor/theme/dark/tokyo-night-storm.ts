import {Extension} from '@codemirror/state'
import {createBaseTheme} from '../base'
import type {ThemeColors} from '../types'

export const config: ThemeColors = {
  name: 'tokyo-night-storm',
  dark: true,
  
  // 基础色调
  background: '#24283b',
  backgroundSecondary: '#24283b',
  surface: '#24283b',
  dropdownBackground: '#24283b',
  dropdownBorder: '#7982a9',
  
  // 文本颜色
  foreground: '#7982a9',
  foregroundSecondary: '#7982a9',
  comment: '#565f89',
  
  // 语法高亮色 - 核心
  keyword: '#bb9af7',
  string: '#9ece6a',
  function: '#7aa2f7',
  number: '#ff9e64',
  operator: '#bb9af7',
  variable: '#c0caf5',
  type: '#2ac3de',
  
  // 语法高亮色 - 扩展
  constant: '#bb9af7',
  storage: '#bb9af7',
  parameter: '#c0caf5',
  class: '#c0caf5',
  heading: '#89ddff',
  invalid: '#ff5370',
  regexp: '#b4f9f8',
  
  // 界面元素
  cursor: '#c0caf5',
  selection: '#6f7bb630',
  selectionBlur: '#6f7bb630',
  activeLine: '#4d547722',
  lineNumber: '#3b4261',
  activeLineNumber: '#737aa2',
  
  // 边框和分割线
  borderColor: '#1f2335',
  borderLight: '#7982a919',
  
  // 搜索和匹配
  searchMatch: '#7aa2f7',
  matchingBracket: '#1f2335',
}

// 使用通用主题工厂函数创建 Tokyo Night Storm 主题
export const tokyoNightStorm: Extension = createBaseTheme(config)
