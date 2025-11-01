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
  
  // ========== @ 规则（请求体格式）==========
  // @json, @formdata, @urlencoded - 使用类型名
  "JsonKeyword FormDataKeyword UrlEncodedKeyword": t.typeName,
  
  // @text - 使用特殊类型
  "TextKeyword": t.special(t.typeName),
  
  // @res - 使用命名空间（紫色系）
  "ResKeyword": t.namespace,
  
  // @ 符号本身 - 使用元标记
  "AtKeyword": t.meta,
  
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
  
  // ========== 注释 ==========
  // # 单行注释 - 行注释颜色
  "LineComment": t.lineComment,
  
  // ========== 标点符号 ==========
  // 冒号 - 分隔符
  ":": t.separator,
  
  // 逗号 - 分隔符
  ",": t.separator,
  
  // 花括号 - 大括号
  "{ }": t.brace,
})
