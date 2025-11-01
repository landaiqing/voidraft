import { EditorState } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import type { SyntaxNode } from '@lezer/common';

/**
 * HTTP 请求模型
 */
export interface HttpRequest {
  /** 请求方法 */
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
  
  /** 请求 URL */
  url: string;
  
  /** 请求头 */
  headers: Record<string, string>;
  
  /** 请求体类型 */
  bodyType?: 'json' | 'formdata' | 'urlencoded' | 'text';
  
  /** 请求体内容 */
  body?: any;
  
  /** 原始文本位置信息（用于调试） */
  position: {
    from: number;
    to: number;
    line: number;
  };
}

/**
 * 节点类型常量
 */
const NODE_TYPES = {
  REQUEST_STATEMENT: 'RequestStatement',
  METHOD: 'Method',
  URL: 'Url',
  BLOCK: 'Block',
  PROPERTY: 'Property',
  PROPERTY_NAME: 'PropertyName',
  STRING_LITERAL: 'StringLiteral',
  NUMBER_LITERAL: 'NumberLiteral',
  IDENTIFIER: 'identifier',
  AT_RULE: 'AtRule',
  JSON_RULE: 'JsonRule',
  FORMDATA_RULE: 'FormDataRule',
  URLENCODED_RULE: 'UrlEncodedRule',
  TEXT_RULE: 'TextRule',
  JSON_KEYWORD: 'JsonKeyword',
  FORMDATA_KEYWORD: 'FormDataKeyword',
  URLENCODED_KEYWORD: 'UrlEncodedKeyword',
  TEXT_KEYWORD: 'TextKeyword',
  JSON_BLOCK: 'JsonBlock',
  JSON_PROPERTY: 'JsonProperty',
} as const;

/**
 * HTTP 请求解析器
 */
export class HttpRequestParser {
  constructor(private state: EditorState) {}

  /**
   * 解析指定位置的 HTTP 请求
   * @param pos 光标位置或请求起始位置
   * @returns 解析后的 HTTP 请求对象，如果解析失败返回 null
   */
  parseRequestAt(pos: number): HttpRequest | null {
    const tree = syntaxTree(this.state);
    
    // 查找包含该位置的 RequestStatement 节点
    const requestNode = this.findRequestNode(tree, pos);
    if (!requestNode) {
      return null;
    }

    return this.parseRequest(requestNode);
  }

  /**
   * 查找包含指定位置的 RequestStatement 节点
   */
  private findRequestNode(tree: any, pos: number): SyntaxNode | null {
    let foundNode: SyntaxNode | null = null;

    tree.iterate({
      enter: (node: any) => {
        if (node.name === NODE_TYPES.REQUEST_STATEMENT) {
          if (node.from <= pos && pos <= node.to) {
            foundNode = node.node;
            return false; // 停止迭代
          }
        }
      }
    });

    return foundNode;
  }

  /**
   * 解析 RequestStatement 节点
   */
  private parseRequest(node: SyntaxNode): HttpRequest | null {
    // 使用 Lezer API 直接获取子节点
    const methodNode = node.getChild(NODE_TYPES.METHOD);
    const urlNode = node.getChild(NODE_TYPES.URL);
    const blockNode = node.getChild(NODE_TYPES.BLOCK);

    // 验证必需节点
    if (!methodNode || !urlNode || !blockNode) {
      return null;
    }

    const method = this.getNodeText(methodNode).toUpperCase();
    const url = this.parseUrl(urlNode);
    
    // 验证 URL 非空
    if (!url) {
      return null;
    }

    const headers: Record<string, string> = {};
    let bodyType: HttpRequest['bodyType'] = undefined;
    let body: any = undefined;

    // 解析 Block
    this.parseBlock(blockNode, headers, (type, content) => {
      bodyType = type;
      body = content;
    });

    const line = this.state.doc.lineAt(node.from);

    return {
      method: method as HttpRequest['method'],
      url,
      headers,
      bodyType,
      body,
      position: {
        from: node.from,
        to: node.to,
        line: line.number,
      },
    };
  }

  /**
   * 解析 URL 节点
   */
  private parseUrl(node: SyntaxNode): string {
    const urlText = this.getNodeText(node);
    // 移除引号
    return urlText.replace(/^["']|["']$/g, '');
  }

  /**
   * 解析 Block 节点（包含 headers 和 body）
   */
  private parseBlock(
    node: SyntaxNode,
    headers: Record<string, string>,
    onBody: (type: HttpRequest['bodyType'], content: any) => void
  ): void {
    // 遍历 Block 的子节点
    for (let child = node.firstChild; child; child = child.nextSibling) {
      if (child.name === NODE_TYPES.PROPERTY) {
        // HTTP Header 属性
        const { name, value } = this.parseProperty(child);
        if (name && value !== null) {
          headers[name] = value;
        }
      } else if (child.name === NODE_TYPES.AT_RULE) {
        // AtRule 节点，直接获取第一个子节点（JsonRule, FormDataRule等）
        const ruleChild = child.firstChild;
        if (ruleChild) {
          const { type, content } = this.parseBodyRule(ruleChild);
          if (type) { // 只有有效的类型才处理
            onBody(type, content);
          }
        }
      }
    }
  }

  /**
   * 解析请求体规则
   */
  private parseBodyRule(node: SyntaxNode): { type: HttpRequest['bodyType']; content: any } {
    // 类型映射表
    const typeMap: Record<string, HttpRequest['bodyType']> = {
      [NODE_TYPES.JSON_RULE]: 'json',
      [NODE_TYPES.FORMDATA_RULE]: 'formdata',
      [NODE_TYPES.URLENCODED_RULE]: 'urlencoded',
      [NODE_TYPES.TEXT_RULE]: 'text',
    };

    const type = typeMap[node.name];
    const blockNode = node.getChild(NODE_TYPES.JSON_BLOCK);

    return {
      type,
      content: blockNode ? this.parseJsonBlock(blockNode) : null
    };
  }

  /**
   * 解析 JsonBlock（用于 @json, @formdata, @urlencoded）
   */
  private parseJsonBlock(node: SyntaxNode): any {
    const result: any = {};

    // 遍历 JsonProperty
    for (let child = node.firstChild; child; child = child.nextSibling) {
      if (child.name === NODE_TYPES.JSON_PROPERTY) {
        const { name, value } = this.parseJsonProperty(child);
        if (name && value !== null) {
          result[name] = value;
        }
      }
    }

    return result;
  }

  /**
   * 解析 JsonProperty
   */
  private parseJsonProperty(node: SyntaxNode): { name: string | null; value: any } {
    // 使用 API 获取属性名
    const nameNode = node.getChild(NODE_TYPES.PROPERTY_NAME);
    if (!nameNode) {
      return { name: null, value: null };
    }

    const name = this.getNodeText(nameNode);

    // 尝试获取值节点（String, Number, JsonBlock）
    let value: any = null;
    for (let child = node.firstChild; child; child = child.nextSibling) {
      if (child.name === NODE_TYPES.STRING_LITERAL || 
          child.name === NODE_TYPES.NUMBER_LITERAL ||
          child.name === NODE_TYPES.JSON_BLOCK ||
          child.name === NODE_TYPES.IDENTIFIER) {
        value = this.parseValue(child);
        return { name, value };
      }
    }

    // 回退：从文本中提取值（用于 true/false 等标识符）
    const fullText = this.getNodeText(node);
    const colonIndex = fullText.indexOf(':');
    if (colonIndex !== -1) {
      const valueText = fullText.substring(colonIndex + 1).trim().replace(/,$/, '').trim();
      value = this.parseValueFromText(valueText);
    }

    return { name, value };
  }

  /**
   * 从文本解析值
   */
  private parseValueFromText(text: string): any {
    // 布尔值
    if (text === 'true') return true;
    if (text === 'false') return false;
    if (text === 'null') return null;
    
    // 数字
    if (/^-?\d+(\.\d+)?$/.test(text)) {
      return parseFloat(text);
    }
    
    // 字符串（带引号）
    if ((text.startsWith('"') && text.endsWith('"')) || 
        (text.startsWith("'") && text.endsWith("'"))) {
      return text.slice(1, -1);
    }
    
    // 其他标识符
    return text;
  }

  /**
   * 解析 Property（HTTP Header）
   */
  private parseProperty(node: SyntaxNode): { name: string | null; value: any } {
    const nameNode = node.getChild(NODE_TYPES.PROPERTY_NAME);
    if (!nameNode) {
      return { name: null, value: null };
    }

    const name = this.getNodeText(nameNode);
    let value: any = null;

    // 查找值节点（跳过冒号和逗号）
    for (let child = node.firstChild; child; child = child.nextSibling) {
      if (child.name !== NODE_TYPES.PROPERTY_NAME && 
          child.name !== ':' && 
          child.name !== ',') {
        value = this.parseValue(child);
        break;
      }
    }

    return { name, value };
  }

  /**
   * 解析值节点（字符串、数字、标识符、嵌套块）
   */
  private parseValue(node: SyntaxNode): any {
    if (node.name === NODE_TYPES.STRING_LITERAL) {
      const text = this.getNodeText(node);
      // 移除引号
      return text.replace(/^["']|["']$/g, '');
    } else if (node.name === NODE_TYPES.NUMBER_LITERAL) {
      const text = this.getNodeText(node);
      return parseFloat(text);
    } else if (node.name === NODE_TYPES.IDENTIFIER) {
      const text = this.getNodeText(node);
      // 处理布尔值
      if (text === 'true') return true;
      if (text === 'false') return false;
      // 处理 null
      if (text === 'null') return null;
      // 其他标识符作为字符串
      return text;
    } else if (node.name === NODE_TYPES.JSON_BLOCK) {
      // 嵌套对象
      return this.parseJsonBlock(node);
    } else {
      // 未知类型，返回原始文本
      return this.getNodeText(node);
    }
  }

  /**
   * 获取节点的文本内容
   */
  private getNodeText(node: SyntaxNode): string {
    return this.state.doc.sliceString(node.from, node.to);
  }
}

/**
 * 便捷函数：解析指定位置的 HTTP 请求
 */
export function parseHttpRequest(state: EditorState, pos: number): HttpRequest | null {
  const parser = new HttpRequestParser(state);
  return parser.parseRequestAt(pos);
}

