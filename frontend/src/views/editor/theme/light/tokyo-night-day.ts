import {Extension} from '@codemirror/state'
import {createBaseTheme} from '../base'
import type {ThemeColors} from '../types'

export const config: ThemeColors = {
  name: 'tokyo-night-day',
  dark: false,
  
  // 基础色调
  background: '#e1e2e7',
  backgroundSecondary: '#e1e2e7',
  surface: '#e1e2e7',
  dropdownBackground: '#e1e2e7',
  dropdownBorder: '#6a6f8e',
  
  // 文本颜色
  foreground: '#6a6f8e',
  foregroundSecondary: '#6a6f8e',
  comment: '#9da3c2',
  
  // 语法高亮色 - 核心
  keyword: '#9854f1',
  string: '#587539',
  function: '#2e7de9',
  number: '#b15c00',
  operator: '#9854f1',
  variable: '#3760bf',
  type: '#07879d',
  
  // 语法高亮色 - 扩展
  constant: '#9854f1',
  storage: '#9854f1',
  parameter: '#3760bf',
  class: '#3760bf',
  heading: '#006a83',
  invalid: '#ff3e64',
  regexp: '#2e5857',
  
  // 界面元素
  cursor: '#3760bf',
  selection: '#8591b840',
  selectionBlur: '#8591b840',
  activeLine: '#a7aaba22',
  lineNumber: '#b3b6cd',
  activeLineNumber: '#68709a',
  
  // 边框和分割线
  borderColor: '#e9e9ec',
  borderLight: '#6a6f8e19',
  
  // 搜索和匹配
  searchMatch: '#2e7de9',
  matchingBracket: '#e9e9ec',
}

// 使用通用主题工厂函数创建 Tokyo Night Day 主题
export const tokyoNightDay: Extension = createBaseTheme(config)
