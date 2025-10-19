import {createBaseTheme} from '../base';
import type {ThemeColors} from '../types';

// 默认深色主题颜色
export const defaultDarkColors: ThemeColors = {
  // 主题信息
  name: 'default-dark',
  dark: true,

  // 基础色调
  background: '#252B37',        // 主背景色
  backgroundSecondary: '#213644', // 次要背景色
  surface: '#474747',           // 面板背景
  dropdownBackground: '#252B37', // 下拉菜单背景
  dropdownBorder: '#ffffff19',  // 下拉菜单边框

  // 文本颜色
  foreground: '#9BB586',        // 主文本色
  foregroundSecondary: '#9c9c9c', // 次要文本色
  comment: '#6272a4',           // 注释色

  // 语法高亮色 - 核心
  keyword: '#ff79c6',           // 关键字
  string: '#f1fa8c',            // 字符串
  function: '#50fa7b',          // 函数名
  number: '#bd93f9',            // 数字
  operator: '#ff79c6',          // 操作符
  variable: '#8fbcbb',          // 变量
  type: '#8be9fd',             // 类型

  // 语法高亮色 - 扩展
  constant: '#bd93f9',          // 常量
  storage: '#ff79c6',           // 存储类型
  parameter: '#8fbcbb',         // 参数
  class: '#8be9fd',             // 类名
  heading: '#ff79c6',           // 标题
  invalid: '#d30102',           // 无效内容
  regexp: '#f1fa8c',            // 正则表达式

  // 界面元素
  cursor: '#ffffff',            // 光标
  selection: '#0865a9',         // 选中背景
  selectionBlur: '#225377',     // 失焦选中背景
  activeLine: '#ffffff0a',      // 当前行高亮
  lineNumber: '#ffffff26',      // 行号
  activeLineNumber: '#ffffff99', // 活动行号

  // 边框和分割线
  borderColor: '#1e222a',       // 边框色
  borderLight: '#ffffff19',     // 浅色边框

  // 搜索和匹配
  searchMatch: '#8fbcbb',       // 搜索匹配
  matchingBracket: '#ffffff19', // 匹配括号
};

// 创建深色主题
export function createDarkTheme(colors: ThemeColors = defaultDarkColors) {
  return createBaseTheme({...colors, dark: true});
}

// 默认深色主题
export const defaultDark = createDarkTheme(defaultDarkColors);