import { EditorView, GutterMarker, gutter } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { getNoteBlockFromPos } from '../../codeblock/state';
import type { SyntaxNode } from '@lezer/common';

// ==================== 常量定义 ====================

/** 支持的 HTTP 方法（小写） - 使用 Set 以提高查找性能 */
const HTTP_METHODS = new Set(['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'connect', 'trace']);

/** 匹配 ### Request 标记的正则表达式 */
const REQUEST_MARKER_REGEX = /^###\s+Request(?:\s|$)/i;

/** 匹配 ### Response 标记的正则表达式 */
const RESPONSE_MARKER_REGEX = /^###\s+Response/i;

/** 匹配 HTTP 方法的正则表达式 */
const HTTP_METHOD_REGEX = /^\s*(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|CONNECT|TRACE)\s+/i;

/** HTTP 方法在行首的最大偏移位置（字符数） */
const MAX_METHOD_POSITION_OFFSET = 20;

/** 向上查找 ### Request 标记的最大行数 */
const MAX_REQUEST_MARKER_DISTANCE = 10;

// ==================== 运行按钮 Marker ====================

/**
 * 运行按钮 Gutter Marker
 */
class RunButtonMarker extends GutterMarker {
  constructor(private readonly linePosition: number) {
    super();
  }

  toDOM(view: EditorView) {
    const button = document.createElement('button');
    button.className = 'cm-http-run-button';
    button.innerHTML = '▶';
    button.title = 'Run HTTP Request';
    button.setAttribute('aria-label', 'Run HTTP Request');

    button.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.executeRequest(view);
    };
    
    return button;
  }



  private async executeRequest(view: EditorView) {
    console.log(`\n============ 执行 HTTP 请求 ============`);
    console.log(`位置: ${this.linePosition}`);

  }
}

/**
 * 使用语法树检查一行是否是 HTTP 请求行（更可靠）
 * 必须符合规则：前面有 ### Request，然后才是 GET/POST 等请求行
 */
function isRequestLineInSyntaxTree(view: EditorView, lineFrom: number, lineTo: number): boolean {
  const tree = syntaxTree(view.state);
  let hasHttpMethod = false;
  
  // 遍历该行的语法树节点
  tree.iterate({
    from: lineFrom,
    to: lineTo,
    enter: (node: SyntaxNode) => {
      // HTTP 解析器将 HTTP 方法（GET、POST 等）标记为 "keyword"
      // 并且该节点应该在行首附近
      if (node.name === 'keyword' && 
          node.from >= lineFrom && 
          node.from < lineFrom + MAX_METHOD_POSITION_OFFSET) {
        const text = view.state.sliceDoc(node.from, node.to);
        if (HTTP_METHODS.has(text.toLowerCase())) {
          // 检查前面是否有 ### Request 标记
          if (hasPrecedingRequestMarker(view, lineFrom)) {
            hasHttpMethod = true;
          }
        }
      }
    }
  });
  
  return hasHttpMethod;
}

/**
 * 检查前面是否有 ### Request 标记
 * 只要包含 "### Request"，后面可以跟任何描述文字
 */
function hasPrecedingRequestMarker(view: EditorView, lineFrom: number): boolean {
  const currentLineNum = view.state.doc.lineAt(lineFrom).number;
  
  // 向上查找前面的几行（最多往上找指定行数）
  for (let i = currentLineNum - 1; 
       i >= Math.max(1, currentLineNum - MAX_REQUEST_MARKER_DISTANCE); 
       i--) {
    const line = view.state.doc.line(i);
    const lineText = view.state.sliceDoc(line.from, line.to).trim();

    if (REQUEST_MARKER_REGEX.test(lineText)) {
      return true;
    }
    
    // 如果遇到 ### Response，停止查找
    if (RESPONSE_MARKER_REGEX.test(lineText)) {
      return false;
    }
    
    // 如果是空行，继续往上找
    if (lineText === '') {
      continue;
    }
    
    // 如果遇到另一个请求方法，停止查找
    if (HTTP_METHOD_REGEX.test(lineText)) {
      return false;
    }
  }
  
  return false;
}

/**
 * 检查位置是否在 HTTP 块内
 */
function isInHttpBlock(view: EditorView, pos: number): boolean {
  try {
    const block = getNoteBlockFromPos(view.state, pos);
    return block?.language.name === 'http' || block?.language.name === 'rest';
  } catch {
    return false;
  }
}

/**
 * 创建运行按钮 Gutter
 */
export const httpRunButtonGutter = gutter({
  class: 'cm-http-gutter',
  
  // 为每一行决定是否显示 marker
  lineMarker(view, line) {
    const linePos = line.from;
    
    // 第一步：检查是否在 HTTP 块内
    if (!isInHttpBlock(view, linePos)) {
      return null;
    }
    
    // 第二步：使用语法树检查是否是请求行
    if (!isRequestLineInSyntaxTree(view, line.from, line.to)) {
      return null;
    }
    
    // 创建运行按钮
    return new RunButtonMarker(linePos);
  },

});

export const httpRunButtonTheme = EditorView.baseTheme({
  // 运行按钮样式
  '.cm-http-run-button': {
    // width: '18px',
    // height: '18px',
    border: 'none',
    borderRadius: '2px',
    backgroundColor: 'transparent',
    color: '#4CAF50', // 绿色三角
    // fontSize: '13px',
    // lineHeight: '16px',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0',
    transition: 'color 0.15s ease',
  },
  
  // 悬停效果
  '.cm-http-run-button:hover': {
      color: '#45a049', // 深绿色
      // backgroundColor: 'rgba(76, 175, 80, 0.1)', // 淡绿色背景
  },

  // 激活效果
  '.cm-http-run-button:active': {
    color: '#3d8b40',
    // backgroundColor: 'rgba(76, 175, 80, 0.2)',
  },
});

