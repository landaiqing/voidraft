/**
 * Block 装饰系统
 */

import { ViewPlugin, EditorView, Decoration, WidgetType, layer, RectangleMarker } from "@codemirror/view";
import { StateField, RangeSetBuilder, EditorState } from "@codemirror/state";
import { blockState } from "./state";

/**
 * 块开始装饰组件
 */
class NoteBlockStart extends WidgetType {
  constructor(private isFirst: boolean) {
    super();
  }

  eq(other: NoteBlockStart) {
    return this.isFirst === other.isFirst;
  }

  toDOM() {
    let wrap = document.createElement("div");
    wrap.className = "code-block-start" + (this.isFirst ? " first" : "");
    return wrap;
  }

  ignoreEvent() {
    return false;
  }
}

/**
 * 块分隔符装饰器
 */
const noteBlockWidget = () => {
  const decorate = (state: any) => {
    const builder = new RangeSetBuilder<Decoration>();

    state.field(blockState).forEach((block: any) => {
      let delimiter = block.delimiter;
      let deco = Decoration.replace({
        widget: new NoteBlockStart(delimiter.from === 0),
        inclusive: true,
        block: true,
        side: 0,
      });
      
      builder.add(
        delimiter.from === 0 ? delimiter.from : delimiter.from + 1,
        delimiter.to - 1,
        deco
      );
    });

    return builder.finish();
  };

  const noteBlockStartField = StateField.define({
    create(state: any) {
      return decorate(state);
    },
    
    update(widgets: any, transaction: any) {
      // 如果装饰为空，可能意味着我们没有获得解析的语法树，那么我们希望在所有更新时更新装饰（而不仅仅是文档更改）
      if (transaction.docChanged || widgets.isEmpty) {
        return decorate(transaction.state);
      }
      return widgets;
    },
    
    provide(field: any) {
      return EditorView.decorations.from(field);
    }
  });

  return noteBlockStartField;
};

/**
 * 原子范围，防止在分隔符内编辑
 */
function atomicRanges(view: EditorView) {
  let builder = new RangeSetBuilder();
  view.state.field(blockState).forEach((block: any) => {
    builder.add(
      block.delimiter.from,
      block.delimiter.to,
      Decoration.mark({ atomic: true }),
    );
  });
  return builder.finish();
}

const atomicNoteBlock = ViewPlugin.fromClass(
  class {
    atomicRanges: any;
    
    constructor(view: EditorView) {
      this.atomicRanges = atomicRanges(view);
    }

    update(update: any) {
      if (update.docChanged) {
        this.atomicRanges = atomicRanges(update.view);
      }
    }
  },
  {
    provide: plugin => EditorView.atomicRanges.of(view => {
      return view.plugin(plugin)?.atomicRanges || [];
    })
  }
);

/**
 * 块背景层 - 修复高度计算问题
 */
const blockLayer = layer({
  above: false,

  markers(view: EditorView) {
    const markers: RectangleMarker[] = [];
    let idx = 0;
    
    function rangesOverlaps(range1: any, range2: any) {
      return range1.from <= range2.to && range2.from <= range1.to;
    }
    
    const blocks = view.state.field(blockState);
    blocks.forEach((block: any) => {
      // 确保块是可见的
      if (!view.visibleRanges.some(range => rangesOverlaps(block.content, range))) {
        idx++;
        return;
      }
      
      // view.coordsAtPos 如果编辑器不可见则返回 null
      const fromCoordsTop = view.coordsAtPos(Math.max(block.content.from, view.visibleRanges[0].from))?.top;
      let toCoordsBottom = view.coordsAtPos(Math.min(block.content.to, view.visibleRanges[view.visibleRanges.length - 1].to))?.bottom;
      
      if (fromCoordsTop === undefined || toCoordsBottom === undefined) {
        idx++;
        return;
      }
      
      // 对最后一个块进行特殊处理，让它直接延伸到底部
      if (idx === blocks.length - 1) {
        const editorHeight = view.dom.clientHeight;
        const contentBottom = toCoordsBottom - view.documentTop + view.documentPadding.top;
        
        // 让最后一个块直接延伸到编辑器底部
        if (contentBottom < editorHeight) {
          const extraHeight = editorHeight - contentBottom-10;
          toCoordsBottom += extraHeight;
        }
      }
      
      markers.push(new RectangleMarker(
        idx++ % 2 == 0 ? "block-even" : "block-odd",
        0,
        // 参考 Heynote 的精确计算方式
        fromCoordsTop - (view.documentTop - view.documentPadding.top) - 1 - 6,
        null, // 宽度在 CSS 中设置为 100%
        (toCoordsBottom - fromCoordsTop) + 15,
      ));
    });
    
    return markers;
  },

  update(update: any, dom: any) {
    return update.docChanged || update.viewportChanged;
  },

  class: "code-blocks-layer"
});

/**
 * 防止第一个块被删除
 * 使用 changeFilter 来保护第一个块分隔符不被删除
 */
const preventFirstBlockFromBeingDeleted = EditorState.changeFilter.of((tr: any) => {
  const protect: number[] = [];
  
  // 获取块状态
  const blocks = tr.startState.field(blockState);
  if (blocks && blocks.length > 0) {
    const firstBlock = blocks[0];
    // 保护第一个块的分隔符区域
    if (firstBlock && firstBlock.delimiter) {
      protect.push(firstBlock.delimiter.from, firstBlock.delimiter.to);
    }
  }
  
  // 如果是搜索替换操作，保护所有块分隔符
  if (tr.annotations.some((a: any) => a.value === "input.replace" || a.value === "input.replace.all")) {
    blocks.forEach((block: any) => {
      if (block.delimiter) {
        protect.push(block.delimiter.from, block.delimiter.to);
      }
    });
  }
  
  // 返回保护范围数组，如果没有需要保护的范围则返回 false
  return protect.length > 0 ? protect : false;
});

/**
 * 防止选择在第一个块之前
 * 使用 transactionFilter 来确保选择不会在第一个块之前
 */
const preventSelectionBeforeFirstBlock = EditorState.transactionFilter.of((tr: any) => {
  // 获取块状态
  const blocks = tr.startState.field(blockState);
  if (!blocks || blocks.length === 0) {
    return tr;
  }
  
  const firstBlock = blocks[0];
  if (!firstBlock || !firstBlock.delimiter) {
    return tr;
  }
  
  const firstBlockDelimiterSize = firstBlock.delimiter.to;
  
  // 检查选择范围，如果在第一个块之前，则调整到第一个块的内容开始位置
  if (tr.selection) {
    tr.selection.ranges.forEach((range: any) => {
      if (range && range.from < firstBlockDelimiterSize) {
        range.from = firstBlockDelimiterSize;
      }
      if (range && range.to < firstBlockDelimiterSize) {
        range.to = firstBlockDelimiterSize;
      }
    });
  }
  
  return tr;
});

/**
 * 获取块装饰扩展 - 简化选项
 */
export function getBlockDecorationExtensions(options: {
  showBackground?: boolean;
} = {}) {
  const {
    showBackground = true,
  } = options;

  const extensions: any[] = [
    noteBlockWidget(),
    atomicNoteBlock,
    preventFirstBlockFromBeingDeleted,
    preventSelectionBeforeFirstBlock,
  ];

  if (showBackground) {
    extensions.push(blockLayer);
  }

  return extensions;
}