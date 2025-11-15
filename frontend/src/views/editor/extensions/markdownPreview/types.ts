/**
 * Markdown 预览面板相关类型定义
 */

// 预览面板状态
export interface PreviewState {
  documentId: number; // 预览所属的文档ID
  blockFrom: number;
  blockTo: number;
  closing?: boolean; // 标记面板正在关闭
}

