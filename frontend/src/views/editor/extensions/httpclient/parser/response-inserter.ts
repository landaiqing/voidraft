import { EditorView } from '@codemirror/view';
import { EditorState, ChangeSpec, StateField } from '@codemirror/state';
import { syntaxTree, syntaxTreeAvailable } from '@codemirror/language';
import type { SyntaxNode } from '@lezer/common';
import { getNoteBlockFromPos } from '../../codeblock/state';

/**
 * 响应数据模型
 */
export interface HttpResponse {
  /** 状态码和状态文本，如"200 OK" */
  status: string;
  
  /** 响应时间（毫秒） */
  time: number;
  
  /** 请求大小 */
  requestSize?: string;
  
  /** 响应体 */
  body: any;
  
  /** 响应头 */
  headers?: { [_: string]: string[] };
  
  /** 时间戳 */
  timestamp?: Date;
  
  /** 错误信息 */
  error?: any;
}

/**
 * 节点类型常量
 */
const NODE_TYPES = {
  REQUEST_STATEMENT: 'RequestStatement',
  LINE_COMMENT: 'LineComment',
  JSON_OBJECT: 'JsonObject',
  JSON_ARRAY: 'JsonArray',
} as const;

/**
 * 缓存接口
 */
interface ParseCache {
  version: number;
  blockId: string;
  requestPositions: Map<number, {
    requestNode: SyntaxNode | null;
    nextRequestPos: number | null;
    oldResponse: { from: number; to: number } | null;
  }>;
}

/**
 * StateField用于缓存解析结果
 */
const responseCacheField = StateField.define<ParseCache>({
  create(): ParseCache {
    return {
      version: 0,
      blockId: '',
      requestPositions: new Map()
    };
  },
  
  update(cache, tr): ParseCache {
    // 如果有文档变更，清空缓存
    if (tr.docChanged) {
      return {
        version: cache.version + 1,
        blockId: '',
        requestPositions: new Map()
      };
    }
    return cache;
  }
});

/**
 * 响应插入位置信息
 */
interface InsertPosition {
  /** 插入位置 */
  from: number;
  
  /** 删除结束位置（如果需要删除旧响应） */
  to: number;
  
  /** 是否需要删除旧响应 */
  hasOldResponse: boolean;
}

/**
 * HTTP 响应插入器
 */
export class HttpResponseInserter {
  constructor(private view: EditorView) {}

  /**
   * 插入HTTP响应（优化版本）
   * @param requestPos 请求的起始位置
   * @param response 响应数据
   */
  insertResponse(requestPos: number, response: HttpResponse): void {
    const state = this.view.state;
    
    // 检查语法树是否可用，避免阻塞UI
    if (!syntaxTreeAvailable(state)) {
      // 延迟执行，等待语法树可用
      setTimeout(() => {
        if (syntaxTreeAvailable(this.view.state)) {
          this.insertResponse(requestPos, response);
        }
      }, 10);
      return;
    }
    
    const insertPos = this.findInsertPosition(state, requestPos);
    
    if (!insertPos) {
      return;
    }

    // 生成响应文本
    const responseText = this.formatResponse(response);

    // 根据是否有旧响应决定插入内容
    const insertText = insertPos.hasOldResponse 
      ? responseText  // 替换旧响应，不需要额外换行
      : `\n${responseText}`; // 新插入，需要换行分隔

    const changes: ChangeSpec = {
      from: insertPos.from,
      to: insertPos.to,
      insert: insertText
    };

    this.view.dispatch({
      changes,
      userEvent: 'http.response.insert',
      // 保持光标在请求位置
      selection: { anchor: requestPos },
      // 滚动到插入位置
      scrollIntoView: true
    });
  }
  /**
   * 查找插入位置（带缓存优化）
   */
  private findInsertPosition(state: EditorState, requestPos: number): InsertPosition | null {
    // 获取当前代码块
    const blockInfo = getNoteBlockFromPos(state, requestPos);
    if (!blockInfo) {
      return null;
    }

    const blockFrom = blockInfo.range.from;
    const blockTo = blockInfo.range.to;
    const blockId = `${blockFrom}-${blockTo}`; // 使用位置作为唯一ID
    
    // 检查缓存
    const cache = state.field(responseCacheField, false);
    if (cache && cache.blockId === blockId) {
      const cachedResult = cache.requestPositions.get(requestPos);
      if (cachedResult) {
        // 使用缓存结果
        const { requestNode, nextRequestPos, oldResponse } = cachedResult;
        if (requestNode) {
          const insertFrom = oldResponse ? oldResponse.from : requestNode.to + 1;
          const insertTo = oldResponse ? oldResponse.to : insertFrom;
          return {
            from: insertFrom,
            to: insertTo,
            hasOldResponse: !!oldResponse
          };
        }
      }
    }

    // 缓存未命中，执行解析
    const tree = syntaxTree(state);
    const context = this.findInsertionContext(tree, state, requestPos, blockFrom, blockTo);
    
    // 更新缓存
    if (cache) {
      cache.blockId = blockId;
      cache.requestPositions.set(requestPos, context);
    }

    if (!context.requestNode) {
      return null;
    }

    // 计算插入位置
    let insertFrom: number;
    let insertTo: number;
    let hasOldResponse = false;

    if (context.oldResponse) {
      // 有旧响应，替换
      insertFrom = context.oldResponse.from;
      insertTo = context.oldResponse.to;
      hasOldResponse = true;
    } else {
      // 没有旧响应，在请求后插入
      const requestEndLine = state.doc.lineAt(context.requestNode.to);
      // 在请求行末尾插入，添加换行符分隔
      insertFrom = requestEndLine.to;
      insertTo = insertFrom;
    }

    return { from: insertFrom, to: insertTo, hasOldResponse };
  }

  /**
   * 单次遍历查找插入上下文
   */
  private findInsertionContext(
    tree: any, 
    state: EditorState, 
    requestPos: number, 
    blockFrom: number, 
    blockTo: number
  ): {
    requestNode: SyntaxNode | null;
    nextRequestPos: number | null;
    oldResponse: { from: number; to: number } | null;
  } {
    let requestNode: SyntaxNode | null = null;
    let nextRequestPos: number | null = null;
    let responseStartNode: SyntaxNode | null = null;
    let responseEndPos: number | null = null;
    
    // 第一步：向上查找当前请求节点
    const cursor = tree.cursorAt(requestPos);
    do {
      if (cursor.name === NODE_TYPES.REQUEST_STATEMENT) {
        if (cursor.from >= blockFrom && cursor.to <= blockTo) {
          requestNode = cursor.node;
          break;
        }
      }
    } while (cursor.parent());
    
    // 如果向上查找失败，从块开始位置查找
    if (!requestNode) {
      const blockCursor = tree.cursorAt(blockFrom);
      do {
        if (blockCursor.name === NODE_TYPES.REQUEST_STATEMENT) {
          if (blockCursor.from <= requestPos && requestPos <= blockCursor.to) {
            requestNode = blockCursor.node;
            break;
          }
        }
      } while (blockCursor.next() && blockCursor.from < blockTo);
    }
    
    if (!requestNode) {
      return { requestNode: null, nextRequestPos: null, oldResponse: null };
    }
    
    const requestEnd = requestNode.to;
    
    // 第二步：从请求结束位置向后遍历，查找响应和下一个请求
    const forwardCursor = tree.cursorAt(requestEnd);
    let foundResponse = false;
    
    do {
      if (forwardCursor.from <= requestEnd) continue;
      if (forwardCursor.from >= blockTo) break;
      
      // 查找下一个请求
      if (!nextRequestPos && forwardCursor.name === NODE_TYPES.REQUEST_STATEMENT) {
        nextRequestPos = forwardCursor.from;
        // 如果已经找到响应，可以提前退出
        if (foundResponse) break;
      }
      
      // 查找响应注释
      if (!responseStartNode && forwardCursor.name === NODE_TYPES.LINE_COMMENT) {
        const commentText = state.doc.sliceString(forwardCursor.from, forwardCursor.to);
        // 避免不必要的 trim，同时识别普通响应和错误响应
        if (commentText.startsWith('# Response') || commentText.startsWith(' # Response')) {
          const startNode = forwardCursor.node;
          responseStartNode = startNode;
          foundResponse = true;
          
          // 检查是否为错误响应（只有一行）
          if (commentText.includes('Error:')) {
            // 错误响应只有一行，直接设置结束位置
            responseEndPos = startNode.to;
          } else {
            // 继续查找 JSON 和结束分隔线（正常响应）
            let nextNode = startNode.nextSibling;
            while (nextNode && nextNode.from < (nextRequestPos || blockTo)) {
              // 找到 JSON
              if (nextNode.name === NODE_TYPES.JSON_OBJECT || nextNode.name === NODE_TYPES.JSON_ARRAY) {
                responseEndPos = nextNode.to;
                
                // 查找结束分隔线
                let afterJson = nextNode.nextSibling;
                while (afterJson && afterJson.from < (nextRequestPos || blockTo)) {
                  if (afterJson.name === NODE_TYPES.LINE_COMMENT) {
                    const text = state.doc.sliceString(afterJson.from, afterJson.to);
                    // 使用更快的正则匹配
                    if (/^#?\s*-+$/.test(text)) {
                      responseEndPos = afterJson.to;
                      break;
                    }
                  }
                  afterJson = afterJson.nextSibling;
                }
                break;
              }
              
              // 遇到下一个请求，停止
              if (nextNode.name === NODE_TYPES.REQUEST_STATEMENT) {
                break;
              }
              
              nextNode = nextNode.nextSibling;
            }
          }
        }
      }
    } while (forwardCursor.next() && forwardCursor.from < blockTo);
    
    // 构建旧响应信息
    let oldResponse: { from: number; to: number } | null = null;
    if (responseStartNode) {
      const startLine = state.doc.lineAt(responseStartNode.from);
      if (responseEndPos !== null) {
        const endLine = state.doc.lineAt(responseEndPos);
        oldResponse = { from: startLine.from, to: endLine.to };
      } else {
        const commentEndLine = state.doc.lineAt(responseStartNode.to);
        oldResponse = { from: startLine.from, to: commentEndLine.to };
      }
    }
    
    return { requestNode, nextRequestPos, oldResponse };
  }


  /**
   * 格式化响应数据
   */
  private formatResponse(response: HttpResponse): string {
    // 如果有错误，使用最简洁的错误格式
    if (response.error) {
      return `# Response Error: ${response.error}`;
    }
    // 正常响应格式
    const timestamp = response.timestamp || new Date();
    const dateStr = this.formatTimestamp(timestamp);
    
    let headerLine = `# Response ${response.status} ${response.time}ms`;
    if (response.requestSize) {
      headerLine += ` ${response.requestSize}`;
    }
    headerLine += ` ${dateStr}`;
    
    // 完整的开头行（不添加前导换行符）
    const header = `${headerLine}\n`;
    
    // 格式化响应体
    let body: string;
    if (typeof response.body === 'string') {
      // 尝试解析 JSON 字符串
      try {
        const parsed = JSON.parse(response.body);
        body = JSON.stringify(parsed, null, 2);
      } catch {
        // 如果不是 JSON，直接使用字符串
        body = response.body;
      }
    } else if (response.body === null || response.body === undefined) {
      // 空响应（只有响应头和结束分隔线）
      const endLine = `# ${'-'.repeat(Math.max(16, headerLine.length - 2))}`; // 最小16个字符
      return header + endLine;
    } else {
      // 对象或数组
      body = JSON.stringify(response.body, null, 2);
    }
    
    // 结尾分隔线：和响应头行长度一致，最小16个字符
    const endLine = `# ${'-'.repeat(Math.max(16, headerLine.length - 2))}`;
    
    return header + body + `\n${endLine}`;
  }

  /**
   * 格式化时间戳
   */
  private formatTimestamp(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }
}

/**
 * 便捷函数：插入响应数据
 */
export function insertHttpResponse(view: EditorView, requestPos: number, response: HttpResponse): void {
  const inserter = new HttpResponseInserter(view);
  inserter.insertResponse(requestPos, response);
}

/**
 * 导出StateField用于扩展配置
 */
export { responseCacheField };

