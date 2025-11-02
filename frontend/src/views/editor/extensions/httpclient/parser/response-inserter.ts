import { EditorView } from '@codemirror/view';
import { EditorState, ChangeSpec } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
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
 * HTTP 响应插入器
 */
export class HttpResponseInserter {
  constructor(private view: EditorView) {}

  /**
   * 插入HTTP响应
   * @param requestPos 请求的起始位置
   * @param response 响应数据
   */
  insertResponse(requestPos: number, response: HttpResponse): void {
    const state = this.view.state;
    
    // 获取当前代码块
    const blockInfo = getNoteBlockFromPos(state, requestPos);
    if (!blockInfo) {
      return;
    }

    const blockFrom = blockInfo.range.from;
    const blockTo = blockInfo.range.to;
    
    // 查找请求节点和旧响应
    const context = this.findRequestAndResponse(state, requestPos, blockFrom, blockTo);
    
    if (!context.requestNode) {
      return;
    }

    // 生成新响应文本
    const responseText = this.formatResponse(response);

    // 确定插入位置
    let insertFrom: number;
    let insertTo: number;

    if (context.oldResponseNode) {
      // 替换旧响应
      insertFrom = context.oldResponseNode.from;
      insertTo = context.oldResponseNode.to;
    } else {
      // 在请求后插入新响应
      // 使用 requestNode.to - 1 定位到请求的最后一个字符所在行
      const lastCharPos = Math.max(context.requestNode.from, context.requestNode.to - 1);
      const requestEndLine = state.doc.lineAt(lastCharPos);
      insertFrom = requestEndLine.to;
      insertTo = insertFrom;
    }

    const changes: ChangeSpec = {
      from: insertFrom,
      to: insertTo,
      insert: context.oldResponseNode ? responseText : `\n\n${responseText}`
    };

    this.view.dispatch({
      changes,
      userEvent: 'http.response.insert',
      selection: { anchor: requestPos },
      scrollIntoView: true
    });
  }

  /**
   * 查找请求节点和旧响应节点（使用 tree.iterate）
   */
  private findRequestAndResponse(
    state: EditorState,
    requestPos: number,
    blockFrom: number,
    blockTo: number
  ): {
    requestNode: SyntaxNode | null;
    oldResponseNode: { node: SyntaxNode; from: number; to: number } | null;
  } {
    const tree = syntaxTree(state);
    
    let requestNode: SyntaxNode | null = null;
    let requestNodeTo = -1;
    let oldResponseNode: { node: SyntaxNode; from: number; to: number } | null = null;
    let nextRequestFrom = -1;
    
    // 遍历查找：请求节点、旧响应、下一个请求
    tree.iterate({
      from: blockFrom,
      to: blockTo,
      enter: (node) => {
        // 1. 找到包含 requestPos 的 RequestStatement
        if (node.name === 'RequestStatement' && 
            node.from <= requestPos && 
            node.to >= requestPos) {
          requestNode = node.node;
          requestNodeTo = node.to;
        }
        
        // 2. 找到请求后的第一个 ResponseDeclaration
        if (requestNode && !oldResponseNode && 
            node.name === 'ResponseDeclaration' && 
            node.from >= requestNodeTo) {
          oldResponseNode = {
            node: node.node,
            from: node.from,
            to: node.to
          };
        }
        
        // 3. 记录下一个请求的起始位置（用于确定响应范围）
        if (requestNode && nextRequestFrom === -1 && 
            node.name === 'RequestStatement' && 
            node.from > requestNodeTo) {
          nextRequestFrom = node.from;
        }
        
        // 4. 早期退出优化：如果已找到请求节点，且满足以下任一条件，则停止遍历
        // - 找到了旧响应节点
        // - 找到了下一个请求（说明当前请求没有响应）
        if (requestNode !== null) {
          if (oldResponseNode !== null || nextRequestFrom !== -1) {
            return false; // 停止遍历
          }
        }
      }
    });
    
    // 如果找到了下一个请求，且旧响应超出范围，则清除旧响应
    if (oldResponseNode && nextRequestFrom !== -1) {
      // TypeScript 类型收窄问题，使用非空断言
      if ((oldResponseNode as { from: number; to: number; node: SyntaxNode }).from >= nextRequestFrom) {
        oldResponseNode = null;
      }
    }
    
    return { requestNode, oldResponseNode };
  }

  /**
   * 格式化响应数据（新格式：@response）
   * 格式：@response <status> <time>ms <timestamp> { <json> }
   * 状态格式：200 或 200-OK（支持完整状态文本）
   * 错误：@response error 0ms <timestamp> { "error": "..." }
   */
  private formatResponse(response: HttpResponse): string {
    // 时间戳格式：ISO 8601（YYYY-MM-DDTHH:MM:SS）
    const timestamp = response.timestamp || new Date();
    const timestampStr = this.formatTimestampISO(timestamp);
    
    // 格式化响应体为 JSON
    let bodyJson: string;
    if (response.error) {
      // 错误响应
      bodyJson = JSON.stringify({ error: String(response.error) }, null, 2);
    } else if (typeof response.body === 'string') {
      // 尝试解析 JSON 字符串
      try {
        const parsed = JSON.parse(response.body);
        bodyJson = JSON.stringify(parsed, null, 2);
      } catch {
        // 如果不是 JSON，包装为对象
        bodyJson = JSON.stringify({ data: response.body }, null, 2);
      }
    } else if (response.body === null || response.body === undefined) {
      // 空响应
      bodyJson = '{}';
    } else {
      // 对象或数组
      bodyJson = JSON.stringify(response.body, null, 2);
    }
    
    // 构建响应
    if (response.error) {
      // 错误格式：@response error 0ms <timestamp> { ... }
      return `@response error 0ms ${timestampStr} ${bodyJson}`;
    } else {
      // 成功格式：@response <status> <time>ms <timestamp> { ... }
      // 支持完整状态：200-OK 或 200
      const statusDisplay = this.formatStatus(response.status);
      return `@response ${statusDisplay} ${response.time}ms ${timestampStr} ${bodyJson}`;
    }
  }
  
  /**
   * 格式化状态码显示
   * 输入："200 OK" 或 "404 Not Found" 或 "200"
   * 输出："200-OK" 或 "404-Not-Found" 或 "200"
   */
  private formatStatus(status: string): string {
    // 提取状态码和状态文本
    const parts = status.trim().split(/\s+/);
    
    if (parts.length === 1) {
      // 只有状态码：200
      return parts[0];
    } else {
      // 有状态码和文本：200 OK -> 200-OK
      const code = parts[0];
      const text = parts.slice(1).join('-');
      return `${code}-${text}`;
    }
  }
  
  /**
   * 格式化时间戳为 ISO 8601 格式（YYYY-MM-DDTHH:MM:SS）
   */
  private formatTimestampISO(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  }
}

/**
 * 便捷函数：插入响应数据
 */
export function insertHttpResponse(view: EditorView, requestPos: number, response: HttpResponse): void {
  const inserter = new HttpResponseInserter(view);
  inserter.insertResponse(requestPos, response);
}
