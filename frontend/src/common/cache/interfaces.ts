/**
 * 缓存项基础接口
 */
export interface CacheItem {
  /** 缓存项的唯一标识 */
  id: string | number;
  /** 最后访问时间 */
  lastAccessed: Date;
  /** 创建时间 */
  createdAt: Date;
}

/**
 * 可清理的缓存项接口
 */
export interface DisposableCacheItem extends CacheItem {
  /** 清理资源的方法 */
  dispose(): void | Promise<void>;
}

/**
 * 缓存配置接口
 */
export interface CacheConfig {
  /** 最大缓存数量 */
  maxSize: number;
  /** 生存时间（毫秒），可选 */
  ttl?: number;
  /** 驱逐回调函数，可选 */
  onEvict?: (item: any) => void | Promise<void>;
}

/**
 * 缓存统计信息接口
 */
export interface CacheStats {
  /** 当前缓存项数量 */
  size: number;
  /** 最大容量 */
  maxSize: number;
  /** 命中次数 */
  hits: number;
  /** 未命中次数 */
  misses: number;
  /** 命中率 */
  hitRate: number;
}

/**
 * 通用缓存策略接口
 * 所有缓存实现都应该实现这个接口
 */
export interface CacheStrategy<T extends CacheItem> {
  /**
   * 获取缓存项
   * @param id 缓存项ID
   * @returns 缓存项或null
   */
  get(id: string | number): T | null;

  /**
   * 设置缓存项
   * @param id 缓存项ID
   * @param item 缓存项
   */
  set(id: string | number, item: T): void;

  /**
   * 移除缓存项
   * @param id 缓存项ID
   * @returns 是否成功移除
   */
  remove(id: string | number): boolean;

  /**
   * 检查是否存在
   * @param id 缓存项ID
   * @returns 是否存在
   */
  has(id: string | number): boolean;

  /**
   * 清空缓存
   */
  clear(): void;

  /**
   * 获取所有项
   * @returns 所有缓存项
   */
  getAll(): T[];

  /**
   * 获取缓存大小
   * @returns 当前缓存项数量
   */
  size(): number;

  /**
   * 获取统计信息
   * @returns 缓存统计信息
   */
  getStats(): CacheStats;

  /**
   * 清理过期项
   * @returns 清理的项数量
   */
  cleanup(): number;
}

/**
 * 双向链表节点接口
 */
export interface DoublyLinkedNode<T> {
  /** 节点值 */
  value: T;
  /** 节点键 */
  key: string | number;
  /** 前一个节点 */
  prev: DoublyLinkedNode<T> | null;
  /** 下一个节点 */
  next: DoublyLinkedNode<T> | null;
}