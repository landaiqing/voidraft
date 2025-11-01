/**
 * HTTP Client 语言支持
 * 
 * 基于 CSS 语法结构的简化 HTTP 请求语言
 * 
 * 语法示例：
 * ```http
 * POST http://127.0.0.1:80/api/create {
 *   host: "https://api.example.com";
 *   content-type: "application/json";
 *   
 *   @json {
 *     name: "xxx";
 *   }
 *   
 *   @res {
 *     code: 200;
 *     status: "ok";
 *   }
 * }
 * ```
 */

export { http, httpLanguage, httpHighlighting } from './http-language';
export { parser } from './http.parser';

// 类型定义
export type { LRLanguage } from '@codemirror/language';
