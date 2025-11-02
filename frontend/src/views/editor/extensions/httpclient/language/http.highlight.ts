import { styleTags, tags as t } from "@lezer/highlight"

/**
 * HTTP Client 语法高亮配置
 */
export const httpHighlighting = styleTags({
  // ========== HTTP 方法（使用不同的强调程度）==========
  // 查询方法 - 使用普通关键字
  "GET HEAD OPTIONS": t.keyword,
  
  // 修改方法 - 使用控制关键字
  "POST PUT PATCH": t.controlKeyword,
  
  // 删除方法 - 使用操作符
  "DELETE": t.operatorKeyword,
  
  // 其他方法 - 使用修饰关键字
  "TRACE CONNECT": t.modifier,
  
  // ========== @ 规则（请求体格式和变量声明）==========
  // @json, @formdata, @urlencoded - 使用类型名
  "JsonKeyword FormDataKeyword UrlEncodedKeyword": t.typeName,
  
  // @text - 使用特殊类型
  "TextKeyword": t.special(t.typeName),
  
  // @var - 变量声明关键字
  "VarKeyword": t.definitionKeyword,
  
  // @response - 响应关键字
  "ResponseKeyword": t.keyword,
  
  // @ 符号本身 - 使用元标记
  "AtKeyword": t.meta,
  
  // ========== 变量引用 ==========
  // {{variableName}} - 使用特殊变量名
  "VariableRef": t.special(t.definitionKeyword),
  
  // ========== URL（特殊处理）==========
  // URL 节点 - 使用链接颜色
  "Url": t.link,
  
  // ========== 属性和值 ==========
  // 属性名 - 使用定义名称
  "PropertyName": t.definition(t.attributeName),
  
  // 普通标识符值 - 使用常量名
  "identifier": t.constant(t.variableName),
  
  // ========== 字面量 ==========
  // 数字 - 数字颜色
  "NumberLiteral": t.number,
  
  // 字符串 - 字符串颜色
  "StringLiteral": t.string,
  
  // 单位 - 单位颜色
  "Unit": t.unit,
  
  // ========== 响应相关 ==========
  // 响应状态码 - 数字颜色
  "StatusCode": t.number,
  "ResponseStatus/StatusCode": t.number,
  
  // 响应错误状态 - 关键字
  "ErrorStatus": t.operatorKeyword,
  
  // 响应时间 - 数字颜色
  "TimeValue": t.number,
  "ResponseTime": t.number,
  
  // 时间戳 - 字符串颜色
  "Timestamp": t.string,
  "ResponseTimestamp": t.string,
  
  // ========== 注释 ==========
  // # 单行注释 - 行注释颜色
  "LineComment": t.lineComment,
  
  // ========== JSON 语法（独立 JSON 块）==========
  // JSON 对象和数组
  "JsonObject": t.brace,
  "JsonArray": t.squareBracket,
  
  // JSON 属性名 - 使用属性名颜色
  "JsonProperty/PropertyName": t.propertyName,
  "JsonProperty/StringLiteral": t.propertyName,
  
  // JSON 成员（属性名）- 使用属性名颜色（适用于独立 JSON 对象）
  "JsonMember/StringLiteral": t.propertyName,
  "JsonMember/identifier": t.propertyName,
  
  // JSON 字面量值
  "True False": t.bool,
  "Null": t.null,
  
  // JSON 值（确保字符串和数字正确高亮）
  "JsonValue/StringLiteral": t.string,
  "JsonValue/NumberLiteral": t.number,
  
  // ========== 标点符号 ==========
  // 冒号 - 分隔符
  ":": t.separator,
  
  // 逗号 - 分隔符
  ",": t.separator,
  
  // 花括号 - 大括号
  "{ }": t.brace,
  
  // 方括号 - 方括号
  "[ ]": t.squareBracket,
})
