import type { CacheItem } from './interfaces';

/**
 * 简单哈希函数
 * 使用FNV-1a算法生成哈希值，提供良好的分布性
 * 
 * @param content 要哈希的内容
 * @returns 哈希值字符串
 * @example
 * ```typescript
 * const hash = createHash('some content');
 * // 结果: 类似 '1a2b3c4d'
 * ```
 */
export function createHash(content: string): string {
  const FNV_OFFSET_BASIS = 2166136261;
  const FNV_PRIME = 16777619;
  
  let hash = FNV_OFFSET_BASIS;
  
  for (let i = 0; i < content.length; i++) {
    hash ^= content.charCodeAt(i);
    hash = (hash * FNV_PRIME) >>> 0; // 无符号32位整数
  }
  
  return hash.toString(36);
}

/**
 * 生成缓存键
 * 将多个部分组合成一个缓存键
 * 
 * @param parts 键的各个部分
 * @returns 组合后的缓存键
 * @example
 * ```typescript
 * const key = generateCacheKey('user', 123, 'profile');
 * // 结果: 'user:123:profile'
 * ```
 */
export function generateCacheKey(...parts: (string | number)[]): string {
  return parts.join(':');
}

/**
 * 创建基础缓存项
 * 为任意数据创建符合CacheItem接口的缓存项
 * 
 * @template T 数据类型
 * @param id 缓存项的唯一标识
 * @param data 要缓存的数据
 * @returns 包含缓存元数据的缓存项
 * @example
 * ```typescript
 * const cacheItem = createCacheItem('user:123', { name: 'John', age: 30 });
 * // 结果包含 id, lastAccessed, createdAt 以及原始数据
 * ```
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
 * 根据命中次数和未命中次数计算命中率
 * 
 * @param hits 命中次数
 * @param misses 未命中次数
 * @returns 命中率（0-1之间的数值）
 * @example
 * ```typescript
 * const hitRate = calculateHitRate(80, 20);
 * // 结果: 0.8 (80% 命中率)
 * ```
 */
export function calculateHitRate(hits: number, misses: number): number {
  const total = hits + misses;
  return total > 0 ? hits / total : 0;
}

/**
 * 格式化缓存大小
 * 将字节数格式化为人类可读的大小字符串
 * 
 * @param size 大小（字节）
 * @returns 格式化后的大小字符串
 * @example
 * ```typescript
 * formatCacheSize(1024);      // '1.0 KB'
 * formatCacheSize(1048576);   // '1.0 MB'
 * formatCacheSize(500);       // '500 B'
 * ```
 */
export function formatCacheSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * 检查项是否过期
 * 根据最后访问时间和TTL判断缓存项是否过期
 * 
 * @param item 缓存项
 * @param ttl 生存时间（毫秒）
 * @returns 是否过期
 * @example
 * ```typescript
 * const item = createCacheItem('test', { data: 'value' });
 * const expired = isExpired(item, 5000); // 5秒TTL
 * ```
 */
export function isExpired(item: CacheItem, ttl: number): boolean {
  return Date.now() - item.lastAccessed.getTime() > ttl;
}

/**
 * 防抖函数，用于缓存操作
 * 在指定时间内多次调用只执行最后一次
 * 
 * @template T 函数类型
 * @param func 要防抖的函数
 * @param wait 等待时间（毫秒）
 * @returns 防抖后的函数
 * @example
 * ```typescript
 * const debouncedSave = debounce(saveToCache, 300);
 * debouncedSave(data); // 只有在300ms内没有新调用时才执行
 * ```
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
 * 在指定时间内最多执行一次
 * 
 * @template T 函数类型
 * @param func 要节流的函数
 * @param limit 限制时间间隔（毫秒）
 * @returns 节流后的函数
 * @example
 * ```typescript
 * const throttledCleanup = throttle(cleanupCache, 1000);
 * throttledCleanup(); // 1秒内最多执行一次
 * ```
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