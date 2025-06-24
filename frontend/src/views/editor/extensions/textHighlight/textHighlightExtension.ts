import { EditorState, StateEffect, StateField, Transaction, Range } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { keymap } from "@codemirror/view";

// 全局高亮存储 - 以文档ID为键，高亮范围数组为值
interface HighlightInfo {
  from: number;
  to: number;
}

class GlobalHighlightStore {
  private static instance: GlobalHighlightStore;
  private highlightMap: Map<string, HighlightInfo[]> = new Map();
  
  private constructor() {}
  
  public static getInstance(): GlobalHighlightStore {
    if (!GlobalHighlightStore.instance) {
      GlobalHighlightStore.instance = new GlobalHighlightStore();
    }
    return GlobalHighlightStore.instance;
  }
  
  // 保存文档的高亮
  saveHighlights(documentId: string, highlights: HighlightInfo[]): void {
    this.highlightMap.set(documentId, [...highlights]);
  }
  
  // 获取文档的高亮
  getHighlights(documentId: string): HighlightInfo[] {
    return this.highlightMap.get(documentId) || [];
  }
  
  // 添加高亮
  addHighlight(documentId: string, highlight: HighlightInfo): void {
    const highlights = this.getHighlights(documentId);
    highlights.push(highlight);
    this.saveHighlights(documentId, highlights);
  }
  
  // 移除高亮
  removeHighlights(documentId: string, from: number, to: number): void {
    const highlights = this.getHighlights(documentId);
    const filtered = highlights.filter(h => !(h.from < to && h.to > from));
    this.saveHighlights(documentId, filtered);
  }
  
  // 清除文档的所有高亮
  clearHighlights(documentId: string): void {
    this.highlightMap.delete(documentId);
  }
}

// 获取全局高亮存储实例
const highlightStore = GlobalHighlightStore.getInstance();

// 定义添加和移除高亮的状态效果
const addHighlight = StateEffect.define<{from: number, to: number, documentId: string}>({
  map: ({from, to, documentId}, change) => ({
    from: change.mapPos(from),
    to: change.mapPos(to),
    documentId
  })
});

const removeHighlight = StateEffect.define<{from: number, to: number, documentId: string}>({
  map: ({from, to, documentId}, change) => ({
    from: change.mapPos(from),
    to: change.mapPos(to),
    documentId
  })
});

// 初始化高亮效果 - 用于页面加载时恢复高亮
const initHighlights = StateEffect.define<{highlights: HighlightInfo[], documentId: string}>();

// 高亮样式
const highlightMark = Decoration.mark({
  attributes: {style: `background-color: rgba(255, 215, 0, 0.3)`}
});

// 存储高亮范围的状态字段
const highlightState = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decorations, tr) {
    // 先映射现有的装饰，以适应文档变化
    decorations = decorations.map(tr.changes);
    
    // 处理添加和移除高亮的效果
    for (const effect of tr.effects) {
      if (effect.is(addHighlight)) {
        const { from, to, documentId } = effect.value;
        decorations = decorations.update({
          add: [highlightMark.range(from, to)]
        });
        // 同步到全局存储
        highlightStore.addHighlight(documentId, { from, to });
      } 
      else if (effect.is(removeHighlight)) {
        const { from, to, documentId } = effect.value;
        decorations = decorations.update({
          filter: (rangeFrom, rangeTo) => {
            // 移除与指定范围重叠的装饰
            return !(rangeFrom < to && rangeTo > from);
          }
        });
        // 同步到全局存储
        highlightStore.removeHighlights(documentId, from, to);
      }
      else if (effect.is(initHighlights)) {
        const { highlights } = effect.value;
        const ranges = highlights.map(h => highlightMark.range(h.from, h.to));
        if (ranges.length > 0) {
          decorations = decorations.update({ add: ranges });
        }
      }
    }
    
    return decorations;
  },
  provide: field => EditorView.decorations.from(field)
});

// 定义高亮范围接口
interface HighlightRange {
  from: number;
  to: number;
  decoration: Decoration;
}

// 查找指定位置包含的高亮
function findHighlightsAt(state: EditorState, pos: number): HighlightRange[] {
  const highlights: HighlightRange[] = [];
  
  state.field(highlightState).between(pos, pos, (from, to, deco) => {
    highlights.push({ from, to, decoration: deco });
  });
  
  return highlights;
}

// 查找与给定范围重叠的所有高亮
function findHighlightsInRange(state: EditorState, from: number, to: number): HighlightRange[] {
  const highlights: HighlightRange[] = [];
  
  state.field(highlightState).between(from, to, (rangeFrom, rangeTo, deco) => {
    // 只添加与指定范围有重叠的高亮
    if (rangeFrom < to && rangeTo > from) {
      highlights.push({ from: rangeFrom, to: rangeTo, decoration: deco });
    }
  });
  
  return highlights;
}

// 收集当前所有高亮信息
function collectAllHighlights(state: EditorState): HighlightInfo[] {
  const highlights: HighlightInfo[] = [];
  
  state.field(highlightState).between(0, state.doc.length, (from, to) => {
    highlights.push({ from, to });
  });
  
  return highlights;
}

// 添加高亮
function addHighlightRange(view: EditorView, from: number, to: number, documentId: string): boolean {
  if (from === to) return false; // 不高亮空选择
  
  // 检查是否已经完全高亮
  const overlappingHighlights = findHighlightsInRange(view.state, from, to);
  const isFullyHighlighted = overlappingHighlights.some(range => 
    range.from <= from && range.to >= to
  );
  
  if (isFullyHighlighted) return false;
  
  view.dispatch({
    effects: addHighlight.of({from, to, documentId})
  });
  
  return true;
}

// 移除高亮
function removeHighlightRange(view: EditorView, from: number, to: number, documentId: string): boolean {
  const highlights = findHighlightsInRange(view.state, from, to);
  
  if (highlights.length === 0) return false;
  
  view.dispatch({
    effects: removeHighlight.of({from, to, documentId})
  });
  
  return true;
}

// 切换高亮状态
function toggleHighlight(view: EditorView, documentId: string): boolean {
  const selection = view.state.selection.main;
  
  // 如果有选择文本
  if (!selection.empty) {
    const {from, to} = selection;
    
    // 检查选择范围内是否已经有高亮
    const highlights = findHighlightsInRange(view.state, from, to);
    
    if (highlights.length > 0) {
      // 如果已有高亮，则移除
      return removeHighlightRange(view, from, to, documentId);
    } else {
      // 如果没有高亮，则添加
      return addHighlightRange(view, from, to, documentId);
    }
  } 
  // 如果是光标
  else {
    const pos = selection.from;
    const highlightsAtCursor = findHighlightsAt(view.state, pos);
    
    if (highlightsAtCursor.length > 0) {
      // 移除光标位置的高亮
      const highlight = highlightsAtCursor[0];
      return removeHighlightRange(view, highlight.from, highlight.to, documentId);
    }
  }
  
  return false;
}

// 创建高亮快捷键，需要文档ID
function createHighlightKeymap(documentId: string) {
  return keymap.of([
    {key: "Mod-h", run: (view) => toggleHighlight(view, documentId)}
  ]);
}

// 高亮刷新管理器类
class HighlightRefreshManager {
  private view: EditorView;
  private refreshPending = false;
  private initialSetupDone = false;
  private rafId: number | null = null;
  private documentId: string;
  
  constructor(view: EditorView, documentId: string) {
    this.view = view;
    this.documentId = documentId;
  }
  
  /**
   * 使用requestAnimationFrame安排视图更新
   */
  scheduleRefresh(): void {
    if (this.refreshPending) return;
    
    this.refreshPending = true;
    
    this.rafId = requestAnimationFrame(() => {
      this.executeRefresh();
    });
  }
  
  /**
   * 执行视图更新
   */
  private executeRefresh(): void {
    this.refreshPending = false;
    this.rafId = null;
    
    if (!this.view.state) return;
    
    try {
      // 触发一个空的更新，确保视图刷新
      this.view.dispatch({});
    } catch (e) {
      console.debug("highlight refresh error:", e);
    }
  }
  
  /**
   * 初始化高亮 - 应用保存的高亮
   */
  initHighlights(): void {
    const savedHighlights = highlightStore.getHighlights(this.documentId);
    if (savedHighlights.length > 0) {
      this.view.dispatch({
        effects: initHighlights.of({
          highlights: savedHighlights,
          documentId: this.documentId
        })
      });
    }
  }
  
  /**
   * 执行初始化设置
   */
  performInitialSetup(): void {
    if (this.initialSetupDone) return;
    
    Promise.resolve().then(() => {
      this.initHighlights();
      this.scheduleRefresh();
    });
    
    this.initialSetupDone = true;
  }
  
  /**
   * 清理资源
   */
  dispose(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
    }
  }
}

// 创建高亮扩展
export function createTextHighlighter(documentId: string) {
  // 视图插件
  const highlightSetupPlugin = ViewPlugin.define((view) => {
    // 创建刷新管理器实例
    const refreshManager = new HighlightRefreshManager(view, documentId);
    
    // 执行初始化设置
    refreshManager.performInitialSetup();
    
    return {
      update(update: ViewUpdate) {
        // 页面有内容变化时，保存最新的高亮状态
        if (update.docChanged || update.transactions.some(tr => 
          tr.effects.some(e => e.is(addHighlight) || e.is(removeHighlight))
        )) {
          // 延迟收集高亮信息，确保所有效果都已应用
          setTimeout(() => {
            const allHighlights = collectAllHighlights(view.state);
            highlightStore.saveHighlights(documentId, allHighlights);
          }, 0);
        }
      },
      destroy() {
        // 清理资源
        refreshManager.dispose();
      }
    };
  });
  
  return [
    highlightState,
    createHighlightKeymap(documentId),
    highlightSetupPlugin
  ];
} 