import {Extension} from '@codemirror/state'
import {createBaseTheme} from '../base'
import type {ThemeColors} from '../types'

export const config: ThemeColors = {
  name: 'solarized-dark',
  dark: true,
  
  // 基础色调
  background: '#002B36',
  backgroundSecondary: '#002B36',
  surface: '#002B36',
  dropdownBackground: '#002B36',
  dropdownBorder: '#2AA19899',
  
  // 文本颜色
  foreground: '#93A1A1',
  foregroundSecondary: '#93A1A1',
  comment: '#586E75',
  
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
  storage: '#93A1A1',
  parameter: '#268BD2',
  class: '#CB4B16',
  heading: '#268BD2',
  invalid: '#DC322F',
  regexp: '#DC322F',
  
  // 界面元素
  cursor: '#D30102',
  selection: '#274642',
  selectionBlur: '#274642',
  activeLine: '#005b7022',
  lineNumber: '#93A1A1',
  activeLineNumber: '#949494',
  
  // 边框和分割线
  borderColor: '#073642',
  borderLight: '#93A1A119',
  
  // 搜索和匹配
  searchMatch: '#2AA198',
  matchingBracket: '#073642',
}

// 使用通用主题工厂函数创建 Solarized Dark 主题
export const solarizedDark: Extension = createBaseTheme(config)
