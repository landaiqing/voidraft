import {Extension} from '@codemirror/state'
import {createBaseTheme} from '../base'
import type {ThemeColors} from '../types'

export const config: ThemeColors = {
  name: 'github-dark',
  dark: true,
  
  // 基础色调
  background: '#24292e',
  backgroundSecondary: '#24292e',
  surface: '#24292e',
  dropdownBackground: '#24292e',
  dropdownBorder: '#1b1f23',
  
  // 文本颜色
  foreground: '#d1d5da',
  foregroundSecondary: '#d1d5da',
  comment: '#6a737d',
  
  // 语法高亮色 - 核心
  keyword: '#f97583',
  string: '#9ecbff',
  function: '#79b8ff',
  number: '#79b8ff',
  operator: '#f97583',
  variable: '#ffab70',
  type: '#79b8ff',
  
  // 语法高亮色 - 扩展
  constant: '#79b8ff',
  storage: '#f97583',
  parameter: '#e1e4e8',
  class: '#b392f0',
  heading: '#79b8ff',
  invalid: '#f97583',
  regexp: '#9ecbff',
  
  // 界面元素
  cursor: '#c8e1ff',
  selection: '#3392FF44',
  selectionBlur: '#3392FF44',
  activeLine: '#4d566022',
  lineNumber: '#444d56',
  activeLineNumber: '#e1e4e8',
  
  // 边框和分割线
  borderColor: '#1b1f23',
  borderLight: '#d1d5da19',
  
  // 搜索和匹配
  searchMatch: '#79b8ff',
  matchingBracket: '#17E5E650',
}

// 使用通用主题工厂函数创建 GitHub Dark 主题
export const githubDark: Extension = createBaseTheme(config)
