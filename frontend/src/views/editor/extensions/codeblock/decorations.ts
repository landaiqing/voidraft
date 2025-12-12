/**
 * Block 装饰系统
 */

import { ViewPlugin, EditorView, Decoration, WidgetType, layer, RectangleMarker } from "@codemirror/view";
import { StateField, RangeSetBuilder, EditorState, Transaction } from "@codemirror/state";
import { blockState } from "./state";
import { codeBlockEvent, USER_EVENTS } from "./annotation";

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
    const wrap = document.createElement("div");
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
      const delimiter = block.delimiter;
      const deco = Decoration.replace({
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
  const builder = new RangeSetBuilder();
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
 * 
 * 使用 lineBlockAt 获取行坐标，而不是 coordsAtPos 获取字符坐标。
 * 这样即使某些字符被隐藏（如 heading 的 # 标记 fontSize: 0），
 * 行的坐标也不会受影响，边界线位置正确。
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
      
      const fromPos = Math.max(block.content.from, view.visibleRanges[0].from);
      const toPos = Math.min(block.content.to, view.visibleRanges[view.visibleRanges.length - 1].to);
      
      // 使用 lineBlockAt 获取行的坐标，不受字符样式（如 fontSize: 0）影响
      const fromLineBlock = view.lineBlockAt(fromPos);
      const toLineBlock = view.lineBlockAt(toPos);
      
      // lineBlockAt 返回的 top 是相对于内容区域的偏移
      // 转换为视口坐标进行后续计算
      const fromCoordsTop = fromLineBlock.top + view.documentTop;
      let toCoordsBottom = toLineBlock.bottom + view.documentTop;

      if (idx === blocks.length - 1) {
        // 计算需要添加到最后一个块的额外高度，以覆盖 scrollPastEnd 添加的额外滚动空间
        // scrollPastEnd 会在文档底部添加相当于 scrollDOM.clientHeight 的额外空间
        // 当滚动到最底部时，顶部仍会显示一行（defaultLineHeight），需要减去这部分
        const editorHeight = view.scrollDOM.clientHeight;
        const extraHeight = editorHeight - (
          view.defaultLineHeight + // 当滚动到最底部时，顶部仍显示一行
          view.documentPadding.top +
          8 // 额外的边距调整
        );
        
        if (extraHeight > 0) {
          toCoordsBottom += extraHeight;
        }
      }
      
      markers.push(new RectangleMarker(
        idx++ % 2 == 0 ? "block-even" : "block-odd",
        0,
        fromCoordsTop - (view.documentTop - view.documentPadding.top) - 1 - 6,
        null, // 宽度在 CSS 中设置为 100%
        (toCoordsBottom - fromCoordsTop) + 15,
      ));
    });
    
    return markers;
  },

  update(update: any, _dom: any) {
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
  const internalEvent = tr.annotation(codeBlockEvent);
  
  // 获取块状态并获取第一个块的分隔符大小
  const blocks = tr.startState.field(blockState);
  if (!internalEvent && blocks && blocks.length > 0) {
    const firstBlock = blocks[0];
    const firstBlockDelimiterSize = firstBlock.delimiter.to;
    
    // 保护第一个块分隔符区域（从 0 到 firstBlockDelimiterSize）
    if (firstBlockDelimiterSize > 0) {
      protect.push(0, firstBlockDelimiterSize);
    }
  }
  
  // 如果是搜索替换操作，保护所有块分隔符
  const userEvent = tr.annotation(Transaction.userEvent);
  if (userEvent && (userEvent === USER_EVENTS.INPUT_REPLACE || userEvent === USER_EVENTS.INPUT_REPLACE_ALL)) {
    blocks?.forEach((block: any) => {
      if (block.delimiter) {
        protect.push(block.delimiter.from, block.delimiter.to);
      }
    });
  }
  
  // 返回保护范围数组；若无需保护则返回 true 放行事务
  return protect.length > 0 ? protect : true;
})

/**
 * 防止选择在第一个块之前
 * 使用 transactionFilter 来确保选择不会在第一个块之前
 */
const preventSelectionBeforeFirstBlock = EditorState.transactionFilter.of((tr: any) => {
  if (tr.annotation(codeBlockEvent)) {
    return tr;
  }
  // 获取块状态并获取第一个块的分隔符大小
  const blocks = tr.startState.field(blockState);
  if (!blocks || blocks.length === 0) {
    return tr;
  }
  
  const firstBlock = blocks[0];
  const firstBlockDelimiterSize = firstBlock.delimiter.to;
  
  if (firstBlockDelimiterSize <= 0) {
    return tr;
  }
  
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
