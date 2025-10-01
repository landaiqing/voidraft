/**
 * 编辑器相关常量配置
 */

// 编辑器实例管理
export const EDITOR_CONFIG = {
  /** 最多缓存的编辑器实例数量 */
  MAX_INSTANCES: 5,
  /** 语法树缓存过期时间（毫秒） */
  SYNTAX_TREE_CACHE_TIMEOUT: 30000,
  /** 加载状态延迟时间（毫秒） */
  LOADING_DELAY: 800,
} as const;