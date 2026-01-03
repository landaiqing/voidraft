import { useToastStore } from './toastStore';
import type { ToastOptions } from './types';

class ToastService {
  private getStore() {
    return useToastStore();
  }

  /**
   * 显示一个通知
   */
  show(options: ToastOptions): string {
    return this.getStore().add(options);
  }

  /**
   * 显示成功通知
   */
  success(message: string, title?: string, options?: Partial<ToastOptions>): string {
    return this.show({
      message,
      title,
      type: 'success',
      ...options,
    });
  }

  /**
   * 显示错误通知
   */
  error(message: string, title?: string, options?: Partial<ToastOptions>): string {
    return this.show({
      message,
      title,
      type: 'error',
      ...options,
    });
  }

  /**
   * 显示警告通知
   */
  warning(message: string, title?: string, options?: Partial<ToastOptions>): string {
    return this.show({
      message,
      title,
      type: 'warning',
      ...options,
    });
  }

  /**
   * 显示信息通知
   */
  info(message: string, title?: string, options?: Partial<ToastOptions>): string {
    return this.show({
      message,
      title,
      type: 'info',
      ...options,
    });
  }

  /**
   * 关闭指定的通知
   */
  close(id: string): void {
    this.getStore().remove(id);
  }

  /**
   * 清空所有通知
   */
  clear(): void {
    this.getStore().clear();
  }
}
export const toast = new ToastService();
export default toast;

