/**
 * Toast 通知类型定义
 */

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export type ToastPosition = 
  | 'top-right' 
  | 'top-left' 
  | 'bottom-right' 
  | 'bottom-left'
  | 'top-center'
  | 'bottom-center';

export interface ToastOptions {
  /**
   * Toast 消息内容
   */
  message: string;
  
  /**
   * Toast 类型
   */
  type?: ToastType;
  
  /**
   * 标题（可选）
   */
  title?: string;
  
  /**
   * 持续时间（毫秒），0 表示不自动关闭
   */
  duration?: number;
  
  /**
   * 显示位置
   */
  position?: ToastPosition;
  
  /**
   * 是否可关闭
   */
  closable?: boolean;
}

export interface Toast extends Required<Omit<ToastOptions, 'title'>> {
  id: string;
  title?: string;
  createdAt: number;
}

