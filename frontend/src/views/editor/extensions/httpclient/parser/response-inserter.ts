import { EditorView } from '@codemirror/view';
import { EditorState, ChangeSpec } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import type { SyntaxNode } from '@lezer/common';
import { blockState } from '../../codeblock/state';

/**
 * 响应数据模型
 */
export interface HttpResponse {
  /** 状态码 */
  status: number;
  
  /** 状态文本 */
  statusText: string;
  
  /** 响应时间（毫秒） */
  time: number;
  
  /** 响应体 */
  body: any;
  
  /** 时间戳 */
  timestamp?: Date;
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
   * 在请求后插入响应数据
   * @param requestPos 请求的起始位置
   * @param response 响应数据
   */
  insertResponse(requestPos: number, response: HttpResponse): void {
    const state = this.view.state;
    const insertPos = this.findInsertPosition(state, requestPos);
    
    if (!insertPos) {
      console.error('no insert position');
      return;
    }

    // 生成响应文本
    const responseText = this.formatResponse(response);
    
    // 创建变更
    const changes: ChangeSpec = {
      from: insertPos.from,
      to: insertPos.to,
      insert: responseText
    };

    // 应用变更
    this.view.dispatch({
      changes,
      // 将光标移动到插入内容的末尾
      selection: { anchor: insertPos.from + responseText.length },
    });
  }

  /**
   * 查找插入位置
   * 规则：
   * 1. 在当前请求后面
   * 2. 在下一个请求前面
   * 3. 如果已有响应（# Response 开头），删除旧响应
   */
  private findInsertPosition(state: EditorState, requestPos: number): InsertPosition | null {
    const tree = syntaxTree(state);
    const blocks = state.field(blockState, false);
    
    if (!blocks) return null;

    // 找到当前 HTTP 块
    const currentBlock = blocks.find(block => 
      block.language.name === 'http' && 
      block.content.from <= requestPos && 
      requestPos <= block.content.to
    );

    if (!currentBlock) return null;

    const context = this.findInsertionContext(
      tree, 
      state, 
      requestPos, 
      currentBlock.content.from, 
      currentBlock.content.to
    );
    
    if (!context.requestNode) return null;

    const requestEnd = context.requestNode.to;
    
    if (context.oldResponse) {
      // 如果有旧响应，精确替换（从上一行的末尾到响应末尾）
      const oldResponseStartLine = state.doc.lineAt(context.oldResponse.from);
      const prevLineNum = oldResponseStartLine.number - 1;
      
      let deleteFrom = context.oldResponse.from;
      if (prevLineNum >= 1) {
        const prevLine = state.doc.line(prevLineNum);
        deleteFrom = prevLine.to; // 从上一行的末尾开始删除
      }
      
      return {
        from: deleteFrom,
        to: context.oldResponse.to,
        hasOldResponse: true
      };
    } else {
      // 如果没有旧响应，在请求后面插入
      const requestEndLine = state.doc.lineAt(requestEnd);
      
      // 在当前行末尾插入（formatResponse 会自动添加必要的换行）
      return {
        from: requestEndLine.to,
        to: requestEndLine.to,
        hasOldResponse: false
      };
    }
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
        // 避免不必要的 trim
        if (commentText.startsWith('# Response') || commentText.startsWith(' # Response')) {
          const startNode = forwardCursor.node;
          responseStartNode = startNode;
          foundResponse = true;
          
          // 继续查找 JSON 和结束分隔线
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
    const timestamp = response.timestamp || new Date();
    const dateStr = this.formatTimestamp(timestamp);
    
    // 构建响应头行（不带分隔符）
    const headerLine = `# Response ${response.status} ${response.statusText} ${response.time}ms ${dateStr}`;
    
    // 完整的开头行（只有响应头，不带分隔符）
    const header = `\n${headerLine}\n`;
    
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
      const endLine = `# ${'-'.repeat(headerLine.length - 2)}`; // 减去 "# " 的长度
      return header + endLine;
    } else {
      // 对象或数组
      body = JSON.stringify(response.body, null, 2);
    }
    
    // 结尾分隔线：和响应头行长度完全一致
    const endLine = `# ${'-'.repeat(headerLine.length - 2)}`; // 减去 "# " 的长度
    
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

