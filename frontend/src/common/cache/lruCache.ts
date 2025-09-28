import type { CacheItem, CacheConfig, CacheStats, DisposableCacheItem, CacheStrategy, DoublyLinkedNode } from './interfaces';
import { DoublyLinkedList } from './doublyLinkedList';

/**
 * 高性能LRU缓存实现
 * 使用双向链表 + Map 的组合，所有核心操作都是O(1)时间复杂度
 * 
 * @template T 缓存项类型，必须继承自CacheItem
 */
export class LruCache<T extends CacheItem> implements CacheStrategy<T> {
  /** 存储缓存项的Map，提供O(1)的查找性能 */
  private items = new Map<string | number, DoublyLinkedNode<T>>();
  
  /** 双向链表，管理访问顺序，提供O(1)的插入/删除性能 */
  private accessList = new DoublyLinkedList<T>();
  
  /** 缓存配置 */
  private config: CacheConfig;
  
  /** 统计信息 */
  private stats = {
    hits: 0,
    misses: 0
  };

  /**
   * 构造函数
   * 
   * @param config 缓存配置
   */
  constructor(config: CacheConfig) {
    this.config = config;
  }

  /**
   * 获取缓存项
   * 时间复杂度: O(1)
   * 
   * @param id 缓存项ID
   * @returns 缓存项或null
   */
  get(id: string | number): T | null {
    const node = this.items.get(id);
    
    if (!node) {
      this.stats.misses++;
      return null;
    }

    // 检查是否过期
    if (this.isExpired(node.value)) {
      this.remove(id);
      this.stats.misses++;
      return null;
    }

    // 更新访问时间
    node.value.lastAccessed = new Date();
    
    // 将节点移动到链表头部（最近访问）
    this.accessList.moveToHead(node);
    
    this.stats.hits++;
    return node.value;
  }

  /**
   * 设置缓存项
   * 时间复杂度: O(1)
   * 
   * @param id 缓存项ID
   * @param item 缓存项
   */
  set(id: string | number, item: T): void {
    const existingNode = this.items.get(id);
    
    // 如果已存在，更新值并移动到头部
    if (existingNode) {
      existingNode.value = item;
      this.accessList.moveToHead(existingNode);
      return;
    }

    // 检查容量，必要时驱逐最旧的项
    while (this.items.size >= this.config.maxSize) {
      this.evictLeastRecentlyUsed();
    }

    // 创建新节点并添加到头部
    const newNode = this.accessList.createNode(id, item);
    this.accessList.addToHead(newNode);
    this.items.set(id, newNode);
  }

  /**
   * 移除缓存项
   * 时间复杂度: O(1)
   * 
   * @param id 缓存项ID
   * @returns 是否成功移除
   */
  remove(id: string | number): boolean {
    const node = this.items.get(id);
    if (!node) return false;

    // 从链表中移除
    this.accessList.removeNode(node);
    
    // 从Map中移除
    this.items.delete(id);

    // 调用清理逻辑
    this.disposeItem(node.value);
    
    return true;
  }

  /**
   * 检查是否存在
   * 时间复杂度: O(1)
   * 
   * @param id 缓存项ID
   * @returns 是否存在
   */
  has(id: string | number): boolean {
    const node = this.items.get(id);
    if (!node) return false;
    
    if (this.isExpired(node.value)) {
      this.remove(id);
      return false;
    }
    
    return true;
  }

  /**
   * 清空缓存
   */
  clear(): void {
    // 清理所有项
    for (const node of this.items.values()) {
      this.disposeItem(node.value);
    }
    
    this.items.clear();
    this.accessList.clear();
    this.stats.hits = 0;
    this.stats.misses = 0;
  }

  /**
   * 获取所有项
   * 按访问顺序返回（最近访问的在前）
   * 
   * @returns 所有缓存项
   */
  getAll(): T[] {
    return this.accessList.toArray();
  }

  /**
   * 获取缓存大小
   * 
   * @returns 当前缓存项数量
   */
  size(): number {
    return this.items.size;
  }

  /**
   * 获取统计信息
   * 
   * @returns 缓存统计信息
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
   * 
   * @returns 清理的项数量
   */
  cleanup(): number {
    let cleanedCount = 0;
    
    if (!this.config.ttl) return cleanedCount;

    // 收集过期的键
    const expiredKeys: (string | number)[] = [];
    for (const [id, node] of this.items.entries()) {
      if (this.isExpired(node.value)) {
        expiredKeys.push(id);
      }
    }
    
    // 移除过期项
    for (const key of expiredKeys) {
      if (this.remove(key)) {
        cleanedCount++;
      }
    }
    
    return cleanedCount;
  }

  // 私有方法

  /**
   * 检查项是否过期
   * 
   * @param item 缓存项
   * @returns 是否过期
   */
  private isExpired(item: T): boolean {
    if (!this.config.ttl) return false;
    return Date.now() - item.lastAccessed.getTime() > this.config.ttl;
  }

  /**
   * 驱逐最近最少使用的项
   */
  private evictLeastRecentlyUsed(): void {
    const tailNode = this.accessList.removeTail();
    if (tailNode) {
      // 调用驱逐回调
      if (this.config.onEvict) {
        this.config.onEvict(tailNode.value);
      }
      
      // 从Map中移除
      this.items.delete(tailNode.key);
      
      // 清理资源
      this.disposeItem(tailNode.value);
    }
  }

  /**
   * 清理缓存项资源
   * 
   * @param item 要清理的缓存项
   */
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

  /**
   * 检查项是否可清理
   * 
   * @param item 缓存项
   * @returns 是否可清理
   */
  private isDisposable(item: T): item is T & DisposableCacheItem {
    return 'dispose' in item && typeof (item as any).dispose === 'function';
  }
}