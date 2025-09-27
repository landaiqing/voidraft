import type { CacheItem, CacheConfig, CacheStats, DisposableCacheItem } from './types';

export class LRUCache<T extends CacheItem> {
  private items = new Map<string | number, T>();
  private accessOrder: (string | number)[] = [];
  private config: CacheConfig;
  private stats = {
    hits: 0,
    misses: 0
  };

  constructor(config: CacheConfig) {
    this.config = config;
  }

  /**
   * 获取缓存项
   */
  get(id: string | number): T | null {
    const item = this.items.get(id);
    
    if (!item) {
      this.stats.misses++;
      return null;
    }

    // 检查是否过期
    if (this.isExpired(item)) {
      this.remove(id);
      this.stats.misses++;
      return null;
    }

    // 更新访问时间和顺序
    item.lastAccessed = new Date();
    this.updateAccessOrder(id);
    this.stats.hits++;
    
    return item;
  }

  /**
   * 设置缓存项
   */
  set(id: string | number, item: T): void {
    // 如果已存在，先移除旧的
    if (this.items.has(id)) {
      this.remove(id);
    }

    // 检查容量，必要时驱逐最旧的项
    while (this.items.size >= this.config.maxSize) {
      const oldestId = this.accessOrder.shift();
      if (oldestId !== undefined) {
        this.evict(oldestId);
      }
    }

    // 添加新项
    this.items.set(id, item);
    this.accessOrder.push(id);
  }

  /**
   * 移除缓存项
   */
  remove(id: string | number): boolean {
    const item = this.items.get(id);
    if (!item) return false;

    this.items.delete(id);
    const index = this.accessOrder.indexOf(id);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }

    // 调用清理逻辑
    this.disposeItem(item);
    return true;
  }

  /**
   * 检查是否存在
   */
  has(id: string | number): boolean {
    const item = this.items.get(id);
    if (!item) return false;
    
    if (this.isExpired(item)) {
      this.remove(id);
      return false;
    }
    
    return true;
  }

  /**
   * 清空缓存
   */
  clear(): void {
    for (const item of this.items.values()) {
      this.disposeItem(item);
    }
    this.items.clear();
    this.accessOrder = [];
    this.stats.hits = 0;
    this.stats.misses = 0;
  }

  /**
   * 获取所有项
   */
  getAll(): T[] {
    return Array.from(this.items.values());
  }

  /**
   * 获取缓存大小
   */
  size(): number {
    return this.items.size;
  }

  /**
   * 获取统计信息
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      size: this.items.size,
      maxSize: this.config.maxSize,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? this.stats.hits / total : 0
    };
  }

  /**
   * 清理过期项
   */
  cleanup(): number {
    let cleanedCount = 0;
    const now = Date.now();
    
    if (!this.config.ttl) return cleanedCount;

    for (const [id, item] of this.items.entries()) {
      if (now - item.lastAccessed.getTime() > this.config.ttl) {
        this.remove(id);
        cleanedCount++;
      }
    }
    
    return cleanedCount;
  }

  // 私有方法

  private isExpired(item: T): boolean {
    if (!this.config.ttl) return false;
    return Date.now() - item.lastAccessed.getTime() > this.config.ttl;
  }

  private updateAccessOrder(id: string | number): void {
    const index = this.accessOrder.indexOf(id);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(id);
  }

  private evict(id: string | number): void {
    const item = this.items.get(id);
    if (item) {
      if (this.config.onEvict) {
        this.config.onEvict(item);
      }
      this.remove(id);
    }
  }

  private disposeItem(item: T): void {
    if (this.isDisposable(item)) {
      try {
        const result = item.dispose();
        if (result instanceof Promise) {
          result.catch(error => {
            console.warn('Failed to dispose cache item:', error);
          });
        }
      } catch (error) {
        console.warn('Failed to dispose cache item:', error);
      }
    }
  }

  private isDisposable(item: T): item is T & DisposableCacheItem {
    return 'dispose' in item && typeof (item as any).dispose === 'function';
  }
}