import {Extension} from '@codemirror/state'
import {createBaseTheme} from '../base'
import type {ThemeColors} from '../types'

export const config: ThemeColors = {
  name: 'material-dark',
  dark: true,
  
  // 基础色调
  background: '#263238',
  backgroundSecondary: '#263238',
  surface: '#263238',
  dropdownBackground: '#263238',
  dropdownBorder: '#FFFFFF10',
  
  // 文本颜色
  foreground: '#EEFFFF',
  foregroundSecondary: '#EEFFFF',
  comment: '#546E7A',
  
  // 语法高亮色 - 核心
  keyword: '#C792EA',
  string: '#C3E88D',
  function: '#82AAFF',
  number: '#F78C6C',
  operator: '#C792EA',
  variable: '#EEFFFF',
  type: '#B2CCD6',
  
  // 语法高亮色 - 扩展
  constant: '#F78C6C',
  storage: '#C792EA',
  parameter: '#EEFFFF',
  class: '#FFCB6B',
  heading: '#C3E88D',
  invalid: '#FF5370',
  regexp: '#89DDFF',
  
  // 界面元素
  cursor: '#FFCC00',
  selection: '#80CBC420',
  selectionBlur: '#80CBC420',
  activeLine: '#4c616c22',
  lineNumber: '#37474F',
  activeLineNumber: '#607a86',
  
  // 边框和分割线
  borderColor: '#FFFFFF10',
  borderLight: '#EEFFFF19',
  
  // 搜索和匹配
  searchMatch: '#82AAFF',
  matchingBracket: '#263238',
}

// 使用通用主题工厂函数创建 Material Dark 主题
export const materialDark: Extension = createBaseTheme(config)
