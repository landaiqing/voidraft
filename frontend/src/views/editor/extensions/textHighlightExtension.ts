import {EditorState, StateEffect, StateField} from "@codemirror/state";
import {Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate, WidgetType} from "@codemirror/view";
import {keymap} from "@codemirror/view";
import {Text} from "@codemirror/state";

// 定义高亮标记的语法
const HIGHLIGHT_MARKER_START = "<hl>";
const HIGHLIGHT_MARKER_END = "</hl>";

// 高亮样式
const highlightMark = Decoration.mark({
  attributes: {style: `background-color: rgba(255, 215, 0, 0.3)`}
});

// 空白Widget用于隐藏标记
class EmptyWidget extends WidgetType {
  toDOM() {
    return document.createElement("span");
  }
}

const emptyWidget = new EmptyWidget();

// 定义效果用于触发高亮视图刷新
const refreshHighlightEffect = StateEffect.define<null>();

// 存储高亮范围的状态字段
const highlightState = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decorations, tr) {
    decorations = decorations.map(tr.changes);
    
    // 检查是否有刷新效果
    for (const effect of tr.effects) {
      if (effect.is(refreshHighlightEffect)) {
        return findHighlights(tr.state);
      }
    }
    
    if (tr.docChanged) {
      return findHighlights(tr.state);
    }
    
    return decorations;
  },
  provide: field => EditorView.decorations.from(field)
});

// 从文档中查找高亮标记并创建装饰
function findHighlights(state: EditorState): DecorationSet {
  const decorations: any[] = [];
  const doc = state.doc;
  const text = doc.toString();
  let pos = 0;
  
  while (pos < text.length) {
    const startMarkerPos = text.indexOf(HIGHLIGHT_MARKER_START, pos);
    if (startMarkerPos === -1) break;
    
    const contentStart = startMarkerPos + HIGHLIGHT_MARKER_START.length;
    const endMarkerPos = text.indexOf(HIGHLIGHT_MARKER_END, contentStart);
    if (endMarkerPos === -1) {
      pos = contentStart;
      continue;
    }
    
    // 创建装饰，隐藏标记，高亮中间内容
    decorations.push(Decoration.replace({
      widget: emptyWidget
    }).range(startMarkerPos, contentStart));
    
    decorations.push(highlightMark.range(contentStart, endMarkerPos));
    
    decorations.push(Decoration.replace({
      widget: emptyWidget
    }).range(endMarkerPos, endMarkerPos + HIGHLIGHT_MARKER_END.length));
    
    pos = endMarkerPos + HIGHLIGHT_MARKER_END.length;
  }
  
  return Decoration.set(decorations, true);
}

// 检查文本是否已经被高亮标记包围
function isAlreadyHighlighted(text: string): boolean {
  // 检查是否有嵌套标记
  let startIndex = 0;
  let markerCount = 0;
  
  while (true) {
    const nextStart = text.indexOf(HIGHLIGHT_MARKER_START, startIndex);
    if (nextStart === -1) break;
    markerCount++;
    startIndex = nextStart + HIGHLIGHT_MARKER_START.length;
  }
  
  // 如果有多个开始标记，表示存在嵌套
  if (markerCount > 1) return true;
  
  // 检查简单的包围情况
  return text.startsWith(HIGHLIGHT_MARKER_START) && text.endsWith(HIGHLIGHT_MARKER_END);
}

// 添加高亮标记到文本
function addHighlightMarker(view: EditorView, from: number, to: number) {
  const text = view.state.sliceDoc(from, to);
  
  // 检查文本是否已经被高亮，防止嵌套高亮
  if (isAlreadyHighlighted(text)) {
    return false;
  }
  
  view.dispatch({
    changes: {
      from,
      to,
      insert: `${HIGHLIGHT_MARKER_START}${text}${HIGHLIGHT_MARKER_END}`
    },
    effects: refreshHighlightEffect.of(null)
  });
  
  return true;
}

// 移除文本的高亮标记
function removeHighlightMarker(view: EditorView, region: {from: number, to: number, content: string}) {
  view.dispatch({
    changes: {
      from: region.from,
      to: region.to,
      insert: region.content
    },
    effects: refreshHighlightEffect.of(null)
  });
  
  return true;
}

// 清理嵌套高亮标记
function cleanNestedHighlights(view: EditorView, from: number, to: number) {
  const text = view.state.sliceDoc(from, to);
  
  // 如果没有嵌套标记，直接返回
  if (text.indexOf(HIGHLIGHT_MARKER_START) === -1 || 
      text.indexOf(HIGHLIGHT_MARKER_END) === -1) {
    return false;
  }
  
  // 尝试清理嵌套标记
  let cleanedText = text;
  let changed = false;
  
  // 从内到外清理嵌套标记
  while (true) {
    const startPos = cleanedText.indexOf(HIGHLIGHT_MARKER_START);
    if (startPos === -1) break;
    
    const contentStart = startPos + HIGHLIGHT_MARKER_START.length;
    const endPos = cleanedText.indexOf(HIGHLIGHT_MARKER_END, contentStart);
    if (endPos === -1) break;
    
    // 提取标记中的内容
    const content = cleanedText.substring(contentStart, endPos);
    
    // 替换带标记的部分为纯内容
    cleanedText = cleanedText.substring(0, startPos) + content + cleanedText.substring(endPos + HIGHLIGHT_MARKER_END.length);
    changed = true;
  }
  
  if (changed) {
    view.dispatch({
      changes: {
        from,
        to,
        insert: cleanedText
      },
      effects: refreshHighlightEffect.of(null)
    });
    return true;
  }
  
  return false;
}

// 检查选中区域是否包含高亮标记
function isHighlightedRegion(doc: Text, from: number, to: number): {from: number, to: number, content: string} | null {
  const fullText = doc.toString();
  
  // 向前搜索起始标记
  let startPos = from;
  while (startPos > 0) {
    const textBefore = fullText.substring(Math.max(0, startPos - 100), startPos);
    const markerPos = textBefore.lastIndexOf(HIGHLIGHT_MARKER_START);
    
    if (markerPos !== -1) {
      startPos = startPos - textBefore.length + markerPos;
      break;
    }
    
    if (startPos - 100 <= 0) {
      // 没找到标记
      return null;
    }
    
    startPos = Math.max(0, startPos - 100);
  }
  
  // 确认找到的标记范围包含选中区域
  const contentStart = startPos + HIGHLIGHT_MARKER_START.length;
  
  // 向后搜索结束标记
  const textAfter = fullText.substring(contentStart, Math.min(fullText.length, to + 100));
  const endMarkerPos = textAfter.indexOf(HIGHLIGHT_MARKER_END);
  
  if (endMarkerPos === -1) {
    return null;
  }
  
  const contentEnd = contentStart + endMarkerPos;
  const regionEnd = contentEnd + HIGHLIGHT_MARKER_END.length;
  
  // 确保选中区域在高亮区域内
  if (from < startPos || to > regionEnd) {
    return null;
  }
  
  // 获取高亮内容
  const content = fullText.substring(contentStart, contentEnd);
  
  return {
    from: startPos,
    to: regionEnd,
    content
  };
}

// 查找光标位置是否在高亮区域内
function findHighlightAtCursor(view: EditorView, pos: number): {from: number, to: number, content: string} | null {
  const doc = view.state.doc;
  const fullText = doc.toString();
  
  // 向前搜索起始标记
  let startPos = pos;
  let foundStart = false;
  
  while (startPos > 0) {
    const textBefore = fullText.substring(Math.max(0, startPos - 100), startPos);
    const markerPos = textBefore.lastIndexOf(HIGHLIGHT_MARKER_START);
    
    if (markerPos !== -1) {
      startPos = startPos - textBefore.length + markerPos;
      foundStart = true;
      break;
    }
    
    if (startPos - 100 <= 0) {
      break;
    }
    
    startPos = Math.max(0, startPos - 100);
  }
  
  if (!foundStart) {
    return null;
  }
  
  const contentStart = startPos + HIGHLIGHT_MARKER_START.length;
  
  // 如果光标在开始标记之前，不在高亮区域内
  if (pos < contentStart) {
    return null;
  }
  
  // 向后搜索结束标记
  const textAfter = fullText.substring(contentStart);
  const endMarkerPos = textAfter.indexOf(HIGHLIGHT_MARKER_END);
  
  if (endMarkerPos === -1) {
    return null;
  }
  
  const contentEnd = contentStart + endMarkerPos;
  
  // 如果光标在结束标记之后，不在高亮区域内
  if (pos > contentEnd) {
    return null;
  }
  
  // 获取高亮内容
  const content = fullText.substring(contentStart, contentEnd);
  
  return {
    from: startPos,
    to: contentEnd + HIGHLIGHT_MARKER_END.length,
    content
  };
}

// 切换高亮状态
function toggleHighlight(view: EditorView) {
  const selection = view.state.selection.main;
  
  // 如果有选择文本
  if (!selection.empty) {
    // 先尝试清理选择区域内的嵌套高亮
    if (cleanNestedHighlights(view, selection.from, selection.to)) {
      return true;
    }
    
    // 检查选中区域是否已经在高亮区域内
    const highlightRegion = isHighlightedRegion(view.state.doc, selection.from, selection.to);
    if (highlightRegion) {
      removeHighlightMarker(view, highlightRegion);
      return true;
    }
    
    // 检查是否选择了带有标记的文本
    const selectedText = view.state.sliceDoc(selection.from, selection.to);
    if (selectedText.indexOf(HIGHLIGHT_MARKER_START) !== -1 || 
        selectedText.indexOf(HIGHLIGHT_MARKER_END) !== -1) {
      return cleanNestedHighlights(view, selection.from, selection.to);
    }
    
    // 如果选择的是干净文本，添加高亮
    addHighlightMarker(view, selection.from, selection.to);
    return true;
  }
  // 如果是光标
  else {
    // 查找光标位置是否在高亮区域内
    const highlightAtCursor = findHighlightAtCursor(view, selection.from);
    if (highlightAtCursor) {
      removeHighlightMarker(view, highlightAtCursor);
      return true;
    }
  }
  
  return false;
}

// 定义快捷键
const highlightKeymap = keymap.of([
  {key: "Mod-h", run: toggleHighlight}
]);

// 处理复制事件，移除高亮标记
function handleCopy(view: EditorView, event: ClipboardEvent) {
  if (!event.clipboardData || view.state.selection.main.empty) return false;
  
  const { from, to } = view.state.selection.main;
  const selectedText = view.state.sliceDoc(from, to);
  
  // 如果选中的内容包含高亮标记，则处理复制
  if (selectedText.indexOf(HIGHLIGHT_MARKER_START) !== -1 || 
      selectedText.indexOf(HIGHLIGHT_MARKER_END) !== -1) {
    
    // 清理文本中的所有标记
    let cleanText = selectedText;
    while (true) {
      const startPos = cleanText.indexOf(HIGHLIGHT_MARKER_START);
      if (startPos === -1) break;
      
      const contentStart = startPos + HIGHLIGHT_MARKER_START.length;
      const endPos = cleanText.indexOf(HIGHLIGHT_MARKER_END, contentStart);
      if (endPos === -1) break;
      
      const content = cleanText.substring(contentStart, endPos);
      cleanText = cleanText.substring(0, startPos) + content + cleanText.substring(endPos + HIGHLIGHT_MARKER_END.length);
    }
    
    // 将清理后的文本设置为剪贴板内容
    event.clipboardData.setData('text/plain', cleanText);
    event.preventDefault();
    return true;
  }
  
  return false;
}

// 高亮刷新管理器类
class HighlightRefreshManager {
  private view: EditorView;
  private refreshPending = false;
  private initialSetupDone = false;
  private rafId: number | null = null;
  
  constructor(view: EditorView) {
    this.view = view;
  }
  
  /**
   * 使用requestAnimationFrame安排高亮刷新
   * 确保在适当的时机执行，且不会重复触发
   */
  scheduleRefresh(): void {
    if (this.refreshPending) return;
    
    this.refreshPending = true;
    
    // 使用requestAnimationFrame确保在下一帧渲染前执行
    this.rafId = requestAnimationFrame(() => {
      this.executeRefresh();
    });
  }
  
  /**
   * 执行高亮刷新
   */
  private executeRefresh(): void {
    this.refreshPending = false;
    this.rafId = null;
    
    // 确保视图仍然有效
    if (!this.view.state) return;
    
    try {
      this.view.dispatch({
        effects: refreshHighlightEffect.of(null)
      });
    } catch (e) {
      console.debug("highlight refresh error:", e);
    }
  }
  
  /**
   * 执行初始化设置
   */
  performInitialSetup(): void {
    if (this.initialSetupDone) return;
    
    // 使用Promise.resolve().then确保在当前执行栈清空后运行
    Promise.resolve().then(() => {
      this.scheduleRefresh();
      
      // 在DOM完全加载后再次刷新以确保稳定性
      window.addEventListener('load', () => {
        this.scheduleRefresh();
      }, { once: true });
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

// 确保编辑器初始化时立即扫描高亮
const highlightSetupPlugin = ViewPlugin.define((view) => {
  // 添加复制事件监听器
  const copyHandler = (event: ClipboardEvent) => handleCopy(view, event);
  view.dom.addEventListener('copy', copyHandler);
  
  // 创建刷新管理器实例
  const refreshManager = new HighlightRefreshManager(view);
  
  // 执行初始化设置
  refreshManager.performInitialSetup();
  
  return {
    update(update: ViewUpdate) {
      // 不在update回调中直接调用dispatch
      if ((update.docChanged || update.selectionSet) && !update.transactions.some(tr => 
        tr.effects.some(e => e.is(refreshHighlightEffect)))) {
        // 安排一个未来的刷新
        refreshManager.scheduleRefresh();
      }
    },
    destroy() {
      // 清理资源
      refreshManager.dispose();
      view.dom.removeEventListener('copy', copyHandler);
    }
  };
});

// 导出完整扩展
export const textHighlighter = [
  highlightState,
  highlightKeymap,
  highlightSetupPlugin
]; 