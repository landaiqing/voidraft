export interface ThemeColors {
  // 主题基本信息
  name: string;                     // 主题名称
  dark: boolean;                    // 是否为深色主题标识

  // 基础色调
  background: string;               // 主背景色
  backgroundSecondary: string;      // 次要背景色（用于代码块交替背景）
  surface: string;                  // 面板背景
  dropdownBackground: string;       // 下拉菜单背景
  dropdownBorder: string;           // 下拉菜单边框

  // 文本颜色
  foreground: string;               // 主文本色
  foregroundSecondary: string;      // 次要文本色
  comment: string;                  // 注释色

  // 语法高亮色 - 核心
  keyword: string;                  // 关键字
  string: string;                   // 字符串
  function: string;                 // 函数名
  number: string;                   // 数字
  operator: string;                 // 操作符
  variable: string;                 // 变量
  type: string;                     // 类型

  // 语法高亮色 - 扩展
  constant: string;                 // 常量
  storage: string;                  // 存储类型（如 static, const）
  parameter: string;                // 参数
  class: string;                    // 类名
  heading: string;                  // 标题（Markdown等）
  invalid: string;                  // 无效内容/错误
  regexp: string;                   // 正则表达式

  // 界面元素
  cursor: string;                   // 光标
  selection: string;                // 选中背景
  selectionBlur: string;            // 失焦选中背景
  activeLine: string;               // 当前行高亮
  lineNumber: string;               // 行号
  activeLineNumber: string;         // 活动行号颜色

  // 边框和分割线
  borderColor: string;              // 边框色
  borderLight: string;              // 浅色边框

  // 搜索和匹配
  searchMatch: string;              // 搜索匹配
  matchingBracket: string;          // 匹配括号
}

