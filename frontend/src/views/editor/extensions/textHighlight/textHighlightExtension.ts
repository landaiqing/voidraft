import { EditorState, StateEffect, StateField, Facet } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView } from "@codemirror/view";

// 高亮配置接口
export interface TextHighlightConfig {
  backgroundColor?: string;
  opacity?: number;
}

// 默认配置
const DEFAULT_CONFIG: Required<TextHighlightConfig> = {
  backgroundColor: '#FFD700', // 金黄色
  opacity: 0.3
};

// 定义添加和移除高亮的状态效果
const addHighlight = StateEffect.define<{from: number, to: number}>({
  map: ({from, to}, change) => ({
    from: change.mapPos(from),
    to: change.mapPos(to)
  })
});

const removeHighlight = StateEffect.define<{from: number, to: number}>({
  map: ({from, to}, change) => ({
    from: change.mapPos(from),
    to: change.mapPos(to)
  })
});



// 配置facet
const highlightConfigFacet = Facet.define<TextHighlightConfig, Required<TextHighlightConfig>>({
  combine: (configs) => {
    let result = { ...DEFAULT_CONFIG };
    for (const config of configs) {
      if (config.backgroundColor !== undefined) {
        result.backgroundColor = config.backgroundColor;
      }
      if (config.opacity !== undefined) {
        result.opacity = config.opacity;
      }
    }
    return result;
  }
});

// 创建高亮装饰
function createHighlightMark(config: Required<TextHighlightConfig>): Decoration {
  const { backgroundColor, opacity } = config;
  const rgbaColor = hexToRgba(backgroundColor, opacity);
  
  return Decoration.mark({
    attributes: { 
      style: `background-color: ${rgbaColor}; border-radius: 2px;`
    }
  });
}

// 将十六进制颜色转换为RGBA
function hexToRgba(hex: string, opacity: number): string {
  // 移除 # 符号
  hex = hex.replace('#', '');
  
  // 处理短格式 (如 #FFF -> #FFFFFF)
  if (hex.length === 3) {
    hex = hex.split('').map(char => char + char).join('');
  }
  
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

// 存储高亮范围的状态字段 - 支持撤销
const highlightState = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decorations, tr) {
    // 映射现有装饰以适应文档变化
    decorations = decorations.map(tr.changes);
    
    // 处理效果
    for (const effect of tr.effects) {
      if (effect.is(addHighlight)) {
        const { from, to } = effect.value;
        const config = tr.state.facet(highlightConfigFacet);
        const highlightMark = createHighlightMark(config);
        
        decorations = decorations.update({
          add: [highlightMark.range(from, to)]
        });
      } 
      else if (effect.is(removeHighlight)) {
        const { from, to } = effect.value;
        decorations = decorations.update({
          filter: (rangeFrom, rangeTo) => {
            // 移除与指定范围重叠的装饰
            return !(rangeFrom < to && rangeTo > from);
          }
        });
      }
    }
    
    return decorations;
  },
  provide: field => EditorView.decorations.from(field)
});

// 查找与给定范围重叠的所有高亮
function findHighlightsInRange(state: EditorState, from: number, to: number): Array<{from: number, to: number}> {
  const highlights: Array<{from: number, to: number}> = [];
  
  state.field(highlightState).between(from, to, (rangeFrom, rangeTo) => {
    if (rangeFrom < to && rangeTo > from) {
      highlights.push({ from: rangeFrom, to: rangeTo });
    }
  });
  
  return highlights;
}

// 查找指定位置包含的高亮
function findHighlightsAt(state: EditorState, pos: number): Array<{from: number, to: number}> {
  const highlights: Array<{from: number, to: number}> = [];
  
  state.field(highlightState).between(pos, pos, (from, to) => {
    highlights.push({ from, to });
  });
  
  return highlights;
}

// 添加高亮范围
function addHighlightRange(view: EditorView, from: number, to: number): boolean {
  if (from === to) return false; // 不高亮空选择
  
  // 检查是否已经完全高亮
  const overlappingHighlights = findHighlightsInRange(view.state, from, to);
  const isFullyHighlighted = overlappingHighlights.some(range => 
    range.from <= from && range.to >= to
  );
  
  if (isFullyHighlighted) return false;
  
  view.dispatch({
    effects: addHighlight.of({from, to})
  });
  
  return true;
}

// 移除高亮范围
function removeHighlightRange(view: EditorView, from: number, to: number): boolean {
  const highlights = findHighlightsInRange(view.state, from, to);
  
  if (highlights.length === 0) return false;
  
  view.dispatch({
    effects: removeHighlight.of({from, to})
  });
  
  return true;
}

// 切换高亮状态
function toggleHighlight(view: EditorView): boolean {
  const selection = view.state.selection.main;
  
  // 如果有选择文本
  if (!selection.empty) {
    const {from, to} = selection;
    
    // 检查选择范围内是否已经有高亮
    const highlights = findHighlightsInRange(view.state, from, to);
    
    if (highlights.length > 0) {
      // 如果已有高亮，则移除
      return removeHighlightRange(view, from, to);
    } else {
      // 如果没有高亮，则添加
      return addHighlightRange(view, from, to);
    }
  } 
  // 如果是光标
  else {
    const pos = selection.from;
    const highlightsAtCursor = findHighlightsAt(view.state, pos);
    
    if (highlightsAtCursor.length > 0) {
      // 移除光标位置的高亮
      const highlight = highlightsAtCursor[0];
      return removeHighlightRange(view, highlight.from, highlight.to);
    }
  }
  
  return false;
}

// 导出文本高亮切换命令，供快捷键系统使用
export const textHighlightToggleCommand = toggleHighlight;

// 创建文本高亮扩展
export function createTextHighlighter(config: TextHighlightConfig = {}) {
  return [
    highlightConfigFacet.of(config),
    highlightState
  ];
} 