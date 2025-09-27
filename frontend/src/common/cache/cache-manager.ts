import type { CacheItem, CacheConfig, CacheStats } from './types';
import { LRUCache } from './lru-cache';

export class CacheManager {
  private caches = new Map<string, LRUCache<any>>();
  private cleanupInterval?: number;

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
   */
  getCache<T extends CacheItem>(name: string, config?: CacheConfig): LRUCache<T> {
    if (!this.caches.has(name)) {
      if (!config) {
        throw new Error(`Cache "${name}" does not exist and no config provided`);
      }
      this.caches.set(name, new LRUCache<T>(config));
    }
    return this.caches.get(name)!;
  }

  /**
   * 创建新的缓存实例
   */
  createCache<T extends CacheItem>(name: string, config: CacheConfig): LRUCache<T> {
    if (this.caches.has(name)) {
      throw new Error(`Cache "${name}" already exists`);
    }
    const cache = new LRUCache<T>(config);
    this.caches.set(name, cache);
    return cache;
  }

  /**
   * 删除缓存实例
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
   */
  hasCache(name: string): boolean {
    return this.caches.has(name);
  }

  /**
   * 获取所有缓存名称
   */
  getCacheNames(): string[] {
    return Array.from(this.caches.keys());
  }

  /**
   * 清空所有缓存
   */
  clearAll(): void {
    for (const cache of this.caches.values()) {
      cache.clear();
    }
  }

  /**
   * 获取所有缓存的统计信息
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
   */
  startAutoCleanup(interval: number): void {
    this.stopAutoCleanup();
    this.cleanupInterval = window.setInterval(() => {
      this.cleanupAll();
    }, interval);
  }

  /**
   * 停止自动清理
   */
  stopAutoCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }

  /**
   * 销毁管理器
   */
  destroy(): void {
    this.stopAutoCleanup();
    this.clearAll();
    this.caches.clear();
  }
}

// 全局缓存管理器实例
export const globalCacheManager = new CacheManager({
  cleanupInterval: 5 * 60 * 1000 // 5 分钟
});