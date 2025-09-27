import type { CacheItem } from './types';

/**
 * 生成缓存键
 */
export function generateCacheKey(...parts: (string | number)[]): string {
  return parts.join(':');
}

/**
 * 创建基础缓存项
 */
export function createCacheItem<T extends Record<string, any>>(
  id: string | number,
  data: T
): CacheItem & T {
  const now = new Date();
  return {
    id,
    lastAccessed: now,
    createdAt: now,
    ...data
  };
}

/**
 * 计算缓存命中率
 */
export function calculateHitRate(hits: number, misses: number): number {
  const total = hits + misses;
  return total > 0 ? hits / total : 0;
}

/**
 * 格式化缓存大小
 */
export function formatCacheSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * 检查项是否过期
 */
export function isExpired(item: CacheItem, ttl: number): boolean {
  return Date.now() - item.lastAccessed.getTime() > ttl;
}

/**
 * 创建内容哈希（简单实现）
 */
export function createContentHash(content: string): string {
  let hash = 0;
  if (content.length === 0) return hash.toString();
  
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 转换为 32 位整数
  }
  
  return Math.abs(hash).toString(36);
}

/**
 * 防抖函数，用于缓存操作
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: number | undefined;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = window.setTimeout(() => func(...args), wait);
  };
}

/**
 * 节流函数，用于缓存清理
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}