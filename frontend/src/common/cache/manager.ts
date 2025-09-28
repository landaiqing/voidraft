import type { CacheItem, CacheConfig, CacheStats, CacheStrategy } from './interfaces';
import { LruCache } from './lruCache';

/**
 * 缓存管理器
 * 统一管理多个缓存实例，提供全局缓存操作和自动清理功能
 * 支持不同的缓存策略，默认使用LRU缓存
 */
export class CacheManager {
  /** 存储所有缓存实例的Map */
  private caches = new Map<string, CacheStrategy<any>>();
  
  /** 自动清理定时器ID */
  private cleanupInterval?: number;

  /**
   * 构造函数
   * 
   * @param options 配置选项
   * @param options.cleanupInterval 自动清理间隔（毫秒），默认不启用
   */
  constructor(options?: {
    /** 自动清理间隔（毫秒），默认 5 分钟 */
    cleanupInterval?: number;
  }) {
    if (options?.cleanupInterval) {
      this.startAutoCleanup(options.cleanupInterval);
    }
  }

  /**
   * 创建或获取缓存实例
   * 如果缓存不存在且提供了配置，则创建新的缓存实例
   * 
   * @template T 缓存项类型
   * @param name 缓存名称
   * @param config 缓存配置（仅在创建新缓存时需要）
   * @param strategy 缓存策略构造函数，默认使用LruCache
   * @returns 缓存实例
   * @throws 如果缓存不存在且未提供配置
   * @example
   * ```typescript
   * const userCache = manager.getCache<UserCacheItem>('users', {
   *   maxSize: 100,
   *   ttl: 5 * 60 * 1000 // 5分钟
   * });
   * ```
   */
  getCache<T extends CacheItem>(
    name: string, 
    config?: CacheConfig,
    strategy: new (config: CacheConfig) => CacheStrategy<T> = LruCache
  ): CacheStrategy<T> {
    if (!this.caches.has(name)) {
      if (!config) {
        throw new Error(`Cache "${name}" does not exist and no config provided`);
      }
      this.caches.set(name, new strategy(config));
    }
    return this.caches.get(name)!;
  }

  /**
   * 创建新的缓存实例
   * 如果同名缓存已存在，则抛出错误
   * 
   * @template T 缓存项类型
   * @param name 缓存名称
   * @param config 缓存配置
   * @param strategy 缓存策略构造函数，默认使用LruCache
   * @returns 新创建的缓存实例
   * @throws 如果同名缓存已存在
   * @example
   * ```typescript
   * const productCache = manager.createCache<ProductCacheItem>('products', {
   *   maxSize: 200,
   *   ttl: 10 * 60 * 1000 // 10分钟
   * });
   * ```
   */
  createCache<T extends CacheItem>(
    name: string, 
    config: CacheConfig,
    strategy: new (config: CacheConfig) => CacheStrategy<T> = LruCache
  ): CacheStrategy<T> {
    if (this.caches.has(name)) {
      throw new Error(`Cache "${name}" already exists`);
    }
    const cache = new strategy(config);
    this.caches.set(name, cache);
    return cache;
  }

  /**
   * 删除缓存实例
   * 会先清空缓存内容，然后从管理器中移除
   * 
   * @param name 缓存名称
   * @returns 是否成功删除
   * @example
   * ```typescript
   * const removed = manager.removeCache('temp-cache');
   * console.log(removed); // true 或 false
   * ```
   */
  removeCache(name: string): boolean {
    const cache = this.caches.get(name);
    if (cache) {
      cache.clear();
      this.caches.delete(name);
      return true;
    }
    return false;
  }

  /**
   * 检查缓存是否存在
   * 
   * @param name 缓存名称
   * @returns 是否存在
   * @example
   * ```typescript
   * if (manager.hasCache('users')) {
   *   const userCache = manager.getCache('users');
   * }
   * ```
   */
  hasCache(name: string): boolean {
    return this.caches.has(name);
  }

  /**
   * 获取所有缓存名称
   * 
   * @returns 缓存名称数组
   * @example
   * ```typescript
   * const cacheNames = manager.getCacheNames();
   * console.log('Active caches:', cacheNames);
   * ```
   */
  getCacheNames(): string[] {
    return Array.from(this.caches.keys());
  }

  /**
   * 清空所有缓存
   * 清空所有缓存实例的内容，但不删除缓存实例本身
   * 
   * @example
   * ```typescript
   * manager.clearAll(); // 清空所有缓存内容
   * ```
   */
  clearAll(): void {
    for (const cache of this.caches.values()) {
      cache.clear();
    }
  }

  /**
   * 获取所有缓存的统计信息
   * 
   * @returns 包含所有缓存统计信息的对象
   * @example
   * ```typescript
   * const stats = manager.getAllStats();
   * console.log('Cache stats:', stats);
   * // 输出: { users: { size: 50, hits: 100, ... }, products: { ... } }
   * ```
   */
  getAllStats(): Record<string, CacheStats> {
    const stats: Record<string, CacheStats> = {};
    for (const [name, cache] of this.caches.entries()) {
      stats[name] = cache.getStats();
    }
    return stats;
  }

  /**
   * 清理所有缓存中的过期项
   * 
   * @returns 包含每个缓存清理项数量的对象
   * @example
   * ```typescript
   * const results = manager.cleanupAll();
   * console.log('Cleanup results:', results);
   * // 输出: { users: 5, products: 2 } // 表示清理的项数量
   * ```
   */
  cleanupAll(): Record<string, number> {
    const results: Record<string, number> = {};
    for (const [name, cache] of this.caches.entries()) {
      results[name] = cache.cleanup();
    }
    return results;
  }

  /**
   * 启动自动清理
   * 定期清理所有缓存中的过期项
   * 
   * @param interval 清理间隔（毫秒）
   * @example
   * ```typescript
   * manager.startAutoCleanup(5 * 60 * 1000); // 每5分钟清理一次
   * ```
   */
  startAutoCleanup(interval: number): void {
    this.stopAutoCleanup();
    this.cleanupInterval = window.setInterval(() => {
      this.cleanupAll();
    }, interval);
  }

  /**
   * 停止自动清理
   * 
   * @example
   * ```typescript
   * manager.stopAutoCleanup();
   * ```
   */
  stopAutoCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }

  /**
   * 销毁管理器
   * 停止自动清理，清空所有缓存，并移除所有缓存实例
   * 
   * @example
   * ```typescript
   * manager.destroy(); // 完全清理管理器
   * ```
   */
  destroy(): void {
    this.stopAutoCleanup();
    this.clearAll();
    this.caches.clear();
  }
}

/**
 * 全局缓存管理器实例
 * 提供开箱即用的缓存管理功能，默认启用5分钟自动清理
 * 
 * @example
 * ```typescript
 * import { globalCacheManager } from './cache';
 * 
 * const userCache = globalCacheManager.getCache('users', {
 *   maxSize: 100,
 *   ttl: 5 * 60 * 1000
 * });
 * ```
 */
export const globalCacheManager = new CacheManager({
  cleanupInterval: 5 * 60 * 1000 // 5 分钟
});