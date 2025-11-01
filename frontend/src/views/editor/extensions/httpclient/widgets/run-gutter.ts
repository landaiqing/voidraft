import { EditorView, GutterMarker, gutter } from '@codemirror/view';
import { StateField } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import { blockState } from '../../codeblock/state';
import { parseHttpRequest, type HttpRequest } from '../parser/request-parser';
import { insertHttpResponse, type HttpResponse } from '../parser/response-inserter';
import { createDebounce } from '@/common/utils/debounce';

/**
 * 语法树节点类型常量
 */
const NODE_TYPES = {
  REQUEST_STATEMENT: 'RequestStatement',
  METHOD: 'Method',
  URL: 'Url',
  BLOCK: 'Block',
} as const;

/**
 * HTTP 请求缓存信息
 */
interface CachedHttpRequest {
  lineNumber: number;        // 行号（用于快速查找）
  position: number;          // 字符位置（用于解析）
  request: HttpRequest;      // 完整的解析结果
}

/**
 * 预解析所有 HTTP 块中的请求
 * 只在文档改变时调用，结果缓存在 StateField 中
 * 
 * 优化：一次遍历完成验证和解析，避免重复工作
 */
function parseHttpRequests(state: any): Map<number, CachedHttpRequest> {
  const requestsMap = new Map<number, CachedHttpRequest>();
  const blocks = state.field(blockState, false);
  
  if (!blocks) return requestsMap;
  
  const tree = syntaxTree(state);
  
  // 只遍历 HTTP 块
  for (const block of blocks) {
    if (block.language.name !== 'http') continue;
    
    // 在块范围内查找所有 RequestStatement
    tree.iterate({
      from: block.content.from,
      to: block.content.to,
      enter: (node) => {
        if (node.name === NODE_TYPES.REQUEST_STATEMENT) {
          // 检查是否包含错误节点
          let hasError = false;
          node.node.cursor().iterate((nodeRef) => {
            if (nodeRef.name === '⚠') {
              hasError = true;
              return false;
            }
          });
          
          if (hasError) return;
          
          // 直接解析请求
          const request = parseHttpRequest(state, node.from);
          
          if (request) {
            const line = state.doc.lineAt(request.position.from);
            requestsMap.set(line.number, {
              lineNumber: line.number,
              position: request.position.from,
              request: request,
            });
          }
        }
      }
    });
  }
  
  return requestsMap;
}

/**
 * StateField：缓存所有 HTTP 请求的完整解析结果
 * 只在文档改变时重新解析
 */
const httpRequestsField = StateField.define<Map<number, CachedHttpRequest>>({
  create(state) {
    return parseHttpRequests(state);
  },
  
  update(requests, transaction) {
    // 只有文档改变或缓存为空时才重新解析
    if (transaction.docChanged || requests.size === 0) {
      return parseHttpRequests(transaction.state);
    }
    return requests;
  }
});

// ==================== 运行按钮 Marker ====================

/**
 * 运行按钮 Gutter Marker
 */
class RunButtonMarker extends GutterMarker {
  private isLoading = false;
  private buttonElement: HTMLButtonElement | null = null;
  private readonly debouncedExecute: ((view: EditorView) => void) | null = null;

  constructor(
    private readonly lineNumber: number,
    private readonly cachedRequest: HttpRequest
  ) {
    super();
    
    // 创建防抖执行函数
    const { debouncedFn } = createDebounce(
      (view: EditorView) => this.executeRequestInternal(view),
      { delay: 500 }
    );
    this.debouncedExecute = debouncedFn;
  }

  toDOM(view: EditorView) {
    const button = document.createElement('button');
    button.className = 'cm-http-run-button';
    button.innerHTML = '▶';
    button.title = 'Run HTTP Request';
    button.setAttribute('aria-label', 'Run HTTP Request');
    
    this.buttonElement = button;

    button.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (this.isLoading) {
        return;
      }
      
      this.executeRequest(view);
    };

    return button;
  }

  private executeRequest(view: EditorView) {
    if (this.debouncedExecute) {
      this.debouncedExecute(view);
    }
  }

  private async executeRequestInternal(view: EditorView) {
    if (this.isLoading) return;
    
    this.setLoadingState(true);
    
    try {
      console.log(`\n============ 执行 HTTP 请求 ============`);
      console.log('行号:', this.lineNumber);
      console.log('解析结果:', JSON.stringify(this.cachedRequest, null, 2));
      
      // TODO: 调用后端 API 执行请求
      // 临时模拟网络延迟
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
      
      // 临时模拟响应数据用于测试
      const mockResponse: HttpResponse = {
        status: 200,
        statusText: 'OK',
        time: Math.floor(Math.random() * 500) + 50, // 50-550ms
        body: {
          code: 200,
          message: "请求成功",
          data: {
            id: 1001,
            timestamp: new Date().toISOString()
          }
        },
        timestamp: new Date()
      };
      
      // 插入响应数据
      insertHttpResponse(view, this.cachedRequest.position.from, mockResponse);
    } catch (error) {
      console.error('HTTP 请求执行失败:', error);
    } finally {
      this.setLoadingState(false);
    }
  }

  private setLoadingState(loading: boolean) {
    this.isLoading = loading;
    
    if (this.buttonElement) {
      if (loading) {
        this.buttonElement.className = 'cm-http-run-button cm-http-run-button-loading';
        this.buttonElement.title = 'Request in progress...';
        this.buttonElement.disabled = true;
      } else {
        this.buttonElement.className = 'cm-http-run-button';
        this.buttonElement.title = 'Run HTTP Request';
        this.buttonElement.disabled = false;
      }
    }
  }
}



/**
 * 创建运行按钮 Gutter
 */
export const httpRunButtonGutter = gutter({
  class: 'cm-http-gutter',

  lineMarker(view, line) {
    // O(1) 查找：从缓存中获取请求
    const requestsMap = view.state.field(httpRequestsField, false);
    if (!requestsMap) return null;
    
    const lineNumber = view.state.doc.lineAt(line.from).number;
    const cached = requestsMap.get(lineNumber);
    
    if (!cached) {
      return null;
    }

    // 创建并返回运行按钮，传递缓存的解析结果
    return new RunButtonMarker(cached.lineNumber, cached.request);
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
    transition: 'color 0.15s ease, opacity 0.15s ease',
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

  // 加载状态样式
  '.cm-http-run-button-loading': {
    color: '#999999 !important', // 灰色
    cursor: 'not-allowed !important',
    opacity: '0.6',
  },

  // 禁用悬停效果当加载时
  '.cm-http-run-button-loading:hover': {
    color: '#999999 !important',
  },
});

// 导出 StateField 供扩展系统使用
export { httpRequestsField };