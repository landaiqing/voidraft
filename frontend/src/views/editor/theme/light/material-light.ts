import {Extension} from '@codemirror/state'
import {createBaseTheme} from '../base'
import type {ThemeColors} from '../types'

export const config: ThemeColors = {
  name: 'material-light',
  dark: false,
  
  // 基础色调
  background: '#FAFAFA',
  backgroundSecondary: '#FAFAFA',
  surface: '#FAFAFA',
  dropdownBackground: '#FAFAFA',
  dropdownBorder: '#00000010',
  
  // 文本颜色
  foreground: '#90A4AE',
  foregroundSecondary: '#90A4AE',
  comment: '#90A4AE',
  
  // 语法高亮色 - 核心
  keyword: '#7C4DFF',
  string: '#91B859',
  function: '#6182B8',
  number: '#F76D47',
  operator: '#7C4DFF',
  variable: '#90A4AE',
  type: '#8796B0',
  
  // 语法高亮色 - 扩展
  constant: '#F76D47',
  storage: '#7C4DFF',
  parameter: '#90A4AE',
  class: '#FFB62C',
  heading: '#91B859',
  invalid: '#E53935',
  regexp: '#39ADB5',
  
  // 界面元素
  cursor: '#272727',
  selection: '#80CBC440',
  selectionBlur: '#80CBC440',
  activeLine: '#c2c2c222',
  lineNumber: '#CFD8DC',
  activeLineNumber: '#7E939E',
  
  // 边框和分割线
  borderColor: '#00000010',
  borderLight: '#90A4AE19',
  
  // 搜索和匹配
  searchMatch: '#6182B8',
  matchingBracket: '#FAFAFA',
}

// 使用通用主题工厂函数创建 Material Light 主题
export const materialLight: Extension = createBaseTheme(config)
