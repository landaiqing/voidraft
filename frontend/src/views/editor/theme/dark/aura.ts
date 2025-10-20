import {Extension} from '@codemirror/state'
import {createBaseTheme} from '../base'
import type {ThemeColors} from '../types'

export const config: ThemeColors = {
  name: 'aura',
  dark: true,
  
  // 基础色调
  background: '#21202e',
  backgroundSecondary: '#2B2A3BFF',
  surface: '#21202e',
  dropdownBackground: '#21202e',
  dropdownBorder: '#3b334b',
  
  // 文本颜色
  foreground: '#edecee',
  foregroundSecondary: '#edecee',
  comment: '#6d6d6d',
  
  // 语法高亮色 - 核心
  keyword: '#a277ff',
  string: '#61ffca',
  function: '#ffca85',
  number: '#61ffca',
  operator: '#a277ff',
  variable: '#edecee',
  type: '#82e2ff',
  
  // 语法高亮色 - 扩展
  constant: '#61ffca',
  storage: '#a277ff',
  parameter: '#edecee',
  class: '#82e2ff',
  heading: '#a277ff',
  invalid: '#ff6767',
  regexp: '#61ffca',
  
  // 界面元素
  cursor: '#a277ff',
  selection: '#3d375e7f',
  selectionBlur: '#3d375e7f',
  activeLine: '#4d4b6622',
  lineNumber: '#a394f033',
  activeLineNumber: '#cdccce',
  
  // 边框和分割线
  borderColor: '#3b334b',
  borderLight: '#edecee19',
  
  // 搜索和匹配
  searchMatch: '#61ffca',
  matchingBracket: '#a394f033',
}

// 使用通用主题工厂函数创建 Aura 主题
export const aura: Extension = createBaseTheme(config)
