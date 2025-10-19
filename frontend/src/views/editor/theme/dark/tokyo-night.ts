import {Extension} from '@codemirror/state'
import {createBaseTheme} from '../base'
import type {ThemeColors} from '../types'

export const config: ThemeColors = {
  name: 'tokyo-night',
  dark: true,
  
  // 基础色调
  background: '#1a1b26',
  backgroundSecondary: '#1a1b26',
  surface: '#1a1b26',
  dropdownBackground: '#1a1b26',
  dropdownBorder: '#787c99',
  
  // 文本颜色
  foreground: '#787c99',
  foregroundSecondary: '#787c99',
  comment: '#444b6a',
  
  // 语法高亮色 - 核心
  keyword: '#bb9af7',
  string: '#9ece6a',
  function: '#7aa2f7',
  number: '#ff9e64',
  operator: '#bb9af7',
  variable: '#c0caf5',
  type: '#0db9d7',
  
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
  selection: '#515c7e40',
  selectionBlur: '#515c7e40',
  activeLine: '#43455c22',
  lineNumber: '#363b54',
  activeLineNumber: '#737aa2',
  
  // 边框和分割线
  borderColor: '#16161e',
  borderLight: '#787c9919',
  
  // 搜索和匹配
  searchMatch: '#7aa2f7',
  matchingBracket: '#16161e',
}

// 使用通用主题工厂函数创建 Tokyo Night 主题
export const tokyoNight: Extension = createBaseTheme(config)
