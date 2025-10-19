import {Extension} from '@codemirror/state'
import {createBaseTheme} from '../base'
import type {ThemeColors} from '../types'

export const config: ThemeColors = {
  name: 'github-light',
  dark: false,
  
  // 基础色调
  background: '#fff',
  backgroundSecondary: '#fff',
  surface: '#fff',
  dropdownBackground: '#fff',
  dropdownBorder: '#e1e4e8',
  
  // 文本颜色
  foreground: '#444d56',
  foregroundSecondary: '#444d56',
  comment: '#6a737d',
  
  // 语法高亮色 - 核心
  keyword: '#d73a49',
  string: '#032f62',
  function: '#005cc5',
  number: '#005cc5',
  operator: '#d73a49',
  variable: '#e36209',
  type: '#005cc5',
  
  // 语法高亮色 - 扩展
  constant: '#005cc5',
  storage: '#d73a49',
  parameter: '#24292e',
  class: '#6f42c1',
  heading: '#005cc5',
  invalid: '#cb2431',
  regexp: '#032f62',
  
  // 界面元素
  cursor: '#044289',
  selection: '#0366d625',
  selectionBlur: '#0366d625',
  activeLine: '#c6c6c622',
  lineNumber: '#1b1f234d',
  activeLineNumber: '#24292e',
  
  // 边框和分割线
  borderColor: '#e1e4e8',
  borderLight: '#444d5619',
  
  // 搜索和匹配
  searchMatch: '#005cc5',
  matchingBracket: '#34d05840',
}

// 使用通用主题工厂函数创建 GitHub Light 主题
export const githubLight: Extension = createBaseTheme(config)
