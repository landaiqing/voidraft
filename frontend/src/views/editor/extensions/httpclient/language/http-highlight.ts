import { styleTags, tags as t } from '@lezer/highlight';

/**
 * HTTP Client 语法高亮配置
 */
export const httpHighlighting = styleTags({
  // 注释
  LineComment: t.lineComment,
  
  // HTTP 方法关键字
  "GET POST PUT DELETE PATCH HEAD OPTIONS": t.keyword,
  
  // 关键字
  "HEADER BODY VARIABLES RESPONSE": t.keyword,
  
  // Body 类型
  "TEXT JSON XML FORM URLENCODED GRAPHQL BINARY": t.keyword,
  
  // 变量名
  VariableName: t.variableName,
  VariableValue: t.string,
  
  // URL 和版本
  Url: t.url,
  UrlText: t.url,
  HttpVersion: t.literal,
  
  // Header
  HeaderName: t.propertyName,
  HeaderValue: t.string,
  
  // Body 内容
  BodyContent: t.content,
  
  // Variables 内容
  VariablesContent: t.content,
  
  // 响应
  StatusCode: t.number,
  StatusText: t.string,
  Duration: t.literal,
  Size: t.literal,
  Timestamp: t.literal,
  
  // 文件引用
  FilePath: t.string,
  
  // 模板表达式
  "{{ }}": t.special(t.brace),
  "TemplateExpression/VariableName": t.variableName,
  
  // 成员访问
  "MemberExpression/VariableName": t.variableName,
  "MemberExpression/PropertyName": t.propertyName,
  PropertyName: t.propertyName,
  
  // 函数调用
  FunctionName: t.function(t.variableName),
  
  // 基础类型
  Number: t.number,
  String: t.string,
  
  // 符号
  ": Spread": t.punctuation,
  "( )": t.paren,
  "[ ]": t.squareBracket,
  "{ }": t.brace,
  ".": t.derefOperator,
  ", ;": t.separator,
  "@": t.meta,
  "$": t.meta,
  "=": t.definitionOperator,
});

