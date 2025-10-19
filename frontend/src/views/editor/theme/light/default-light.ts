import {createBaseTheme} from '../base';
import type {ThemeColors} from '../types';

// 默认浅色主题颜色
export const defaultLightColors: ThemeColors = {
    // 主题信息
    name: 'default-light',
    dark: false,

    // 基础色调
    background: '#ffffff',        // 主背景色
    backgroundSecondary: '#f1faf1', // 次要背景色
    surface: '#f5f5f5',           // 面板背景
    dropdownBackground: '#ffffff', // 下拉菜单背景
    dropdownBorder: '#e1e4e8',    // 下拉菜单边框

    // 文本颜色
    foreground: '#444d56',        // 主文本色
    foregroundSecondary: '#6a737d', // 次要文本色
    comment: '#6a737d',           // 注释色

    // 语法高亮色 - 核心
    keyword: '#d73a49',           // 关键字
    string: '#032f62',            // 字符串
    function: '#005cc5',          // 函数名
    number: '#005cc5',            // 数字
    operator: '#d73a49',          // 操作符
    variable: '#24292e',          // 变量
    type: '#6f42c1',             // 类型

    // 语法高亮色 - 扩展
    constant: '#005cc5',          // 常量
    storage: '#d73a49',           // 存储类型
    parameter: '#24292e',         // 参数
    class: '#6f42c1',             // 类名
    heading: '#d73a49',           // 标题
    invalid: '#cb2431',           // 无效内容
    regexp: '#032f62',            // 正则表达式

    // 界面元素
    cursor: '#000000',            // 光标
    selection: '#77baff',         // 选中背景
    selectionBlur: '#b2c2ca',     // 失焦选中背景
    activeLine: '#0000000a',      // 当前行高亮
    lineNumber: '#00000040',      // 行号
    activeLineNumber: '#000000aa', // 活动行号

    // 边框和分割线
    borderColor: '#dfdfdf',       // 边框色
    borderLight: '#0000000c',     // 浅色边框

    // 搜索和匹配
    searchMatch: '#005cc5',       // 搜索匹配
    matchingBracket: '#00000019', // 匹配括号
};

// 创建浅色主题
export function createLightTheme(colors: ThemeColors = defaultLightColors) {
    return createBaseTheme({...colors, dark: false});
}

// 默认浅色主题
export const defaultLight = createLightTheme(defaultLightColors);