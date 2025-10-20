import {Extension} from '@codemirror/state'
import {createBaseTheme} from '../base'
import type {ThemeColors} from '../types'

export const config: ThemeColors = {
  name: 'dracula',
  dark: true,
  
  // 基础色调
  background: '#282A36',
  backgroundSecondary: '#323543FF',
  surface: '#282A36',
  dropdownBackground: '#282A36',
  dropdownBorder: '#191A21',
  
  // 文本颜色
  foreground: '#F8F8F2',
  foregroundSecondary: '#F8F8F2',
  comment: '#6272A4',
  
  // 语法高亮色 - 核心
  keyword: '#FF79C6',
  string: '#F1FA8C',
  function: '#50FA7B',
  number: '#BD93F9',
  operator: '#FF79C6',
  variable: '#F8F8F2',
  type: '#8BE9FD',
  
  // 语法高亮色 - 扩展
  constant: '#BD93F9',
  storage: '#FF79C6',
  parameter: '#F8F8F2',
  class: '#8BE9FD',
  heading: '#BD93F9',
  invalid: '#FF5555',
  regexp: '#F1FA8C',
  
  // 界面元素
  cursor: '#F8F8F2',
  selection: '#44475A',
  selectionBlur: '#44475A',
  activeLine: '#53576c22',
  lineNumber: '#6272A4',
  activeLineNumber: '#F8F8F2',
  
  // 边框和分割线
  borderColor: '#191A21',
  borderLight: '#F8F8F219',
  
  // 搜索和匹配
  searchMatch: '#50FA7B',
  matchingBracket: '#44475A',
}

// 使用通用主题工厂函数创建 Dracula 主题
export const dracula: Extension = createBaseTheme(config)
