import {Extension} from '@codemirror/state'
import {createBaseTheme} from '../base'
import type {ThemeColors} from '../types'

export const config: ThemeColors = {
  name: 'solarized-light',
  dark: false,
  
  // 基础色调
  background: '#FDF6E3',
  backgroundSecondary: '#FDF6E3',
  surface: '#FDF6E3',
  dropdownBackground: '#FDF6E3',
  dropdownBorder: '#D3AF86',
  
  // 文本颜色
  foreground: '#586E75',
  foregroundSecondary: '#586E75',
  comment: '#93A1A1',
  
  // 语法高亮色 - 核心
  keyword: '#859900',
  string: '#2AA198',
  function: '#268BD2',
  number: '#D33682',
  operator: '#859900',
  variable: '#268BD2',
  type: '#CB4B16',
  
  // 语法高亮色 - 扩展
  constant: '#CB4B16',
  storage: '#586E75',
  parameter: '#268BD2',
  class: '#CB4B16',
  heading: '#268BD2',
  invalid: '#DC322F',
  regexp: '#DC322F',
  
  // 界面元素
  cursor: '#657B83',
  selection: '#EEE8D5',
  selectionBlur: '#EEE8D5',
  activeLine: '#d5bd5c22',
  lineNumber: '#586E75',
  activeLineNumber: '#567983',
  
  // 边框和分割线
  borderColor: '#EEE8D5',
  borderLight: '#586E7519',
  
  // 搜索和匹配
  searchMatch: '#268BD2',
  matchingBracket: '#EEE8D5',
}

// 使用通用主题工厂函数创建 Solarized Light 主题
export const solarizedLight: Extension = createBaseTheme(config)
