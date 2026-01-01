import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Toast, ToastOptions } from './types';

export const useToastStore = defineStore('toast', () => {
  const toasts = ref<Toast[]>([]);
  let idCounter = 0;

  /**
   * 添加一个 Toast
   */
  const add = (options: ToastOptions): string => {
    const id = `toast-${Date.now()}-${idCounter++}`;
    
    const toast: Toast = {
      id,
      message: options.message,
      type: options.type || 'info',
      title: options.title,
      duration: options.duration ?? 4000,
      position: options.position || 'top-right',
      closable: options.closable ?? true,
      createdAt: Date.now(),
    };

    toasts.value.push(toast);
    
    return id;
  };

  /**
   * 移除指定 Toast
   */
  const remove = (id: string) => {
    const index = toasts.value.findIndex(t => t.id === id);
    if (index > -1) {
      toasts.value.splice(index, 1);
    }
  };

  /**
   * 清空所有 Toast
   */
  const clear = () => {
    toasts.value = [];
  };

  return {
    toasts,
    add,
    remove,
    clear,
  };
});

