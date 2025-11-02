import { EditorState } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import type { SyntaxNode } from '@lezer/common';

/**
 * 变量引用模型
 */
export interface VariableReference {
  /** 变量名 */
  name: string;
  /** 默认值（可选） */
  defaultValue?: string;
  /** 原始文本 */
  raw: string;
}

/**
 * 节点类型常量
 */
const NODE_TYPES = {
  VAR_DECLARATION: 'VarDeclaration',
  VAR_KEYWORD: 'VarKeyword',
  JSON_BLOCK: 'JsonBlock',
  JSON_PROPERTY: 'JsonProperty',
  PROPERTY_NAME: 'PropertyName',
  STRING_LITERAL: 'StringLiteral',
  NUMBER_LITERAL: 'NumberLiteral',
  IDENTIFIER: 'identifier',
  VARIABLE_REF: 'VariableRef',
} as const;

/**
 * 变量解析器
 * 负责解析 @var 块和变量引用（块级作用域）
 */
export class VariableResolver {
  /** 变量存储 */
  private variables: Map<string, any> = new Map();

  /**
   * 构造函数
   * @param state EditorState
   * @param blockRange 块的范围（可选），如果提供则只解析该范围内的变量
   */
  constructor(
    private state: EditorState,
    private blockRange?: { from: number; to: number }
  ) {
    // 初始化时解析变量定义
    this.parseBlockVariables();
  }

  /**
   * 解析块范围内的 @var 声明
   * 如果提供了 blockRange，只解析该范围内的变量
   * 否则解析整个文档（向后兼容）
   */
  private parseBlockVariables(): void {
    const tree = syntaxTree(this.state);
    
    tree.iterate({
      enter: (node: any) => {
        // 如果指定了块范围，检查节点是否在范围内
        if (this.blockRange) {
          // 节点完全在块范围外，跳过
          if (node.to < this.blockRange.from || node.from > this.blockRange.to) {
            return false; // 停止遍历此分支
          }
        }
        
        if (node.name === NODE_TYPES.VAR_DECLARATION) {
          this.parseVarDeclaration(node.node);
        }
      }
    });
  }

  /**
   * 解析单个 @var 声明
   */
  private parseVarDeclaration(node: SyntaxNode): void {
    // 获取 JsonBlock 节点
    const jsonBlockNode = node.getChild(NODE_TYPES.JSON_BLOCK);
    if (!jsonBlockNode) {
      return;
    }

    // 解析 JsonBlock 中的所有属性
    const variables = this.parseJsonBlock(jsonBlockNode);
    
    // 存储变量
    for (const [name, value] of Object.entries(variables)) {
      this.variables.set(name, value);
    }
  }

  /**
   * 解析 JsonBlock
   */
  private parseJsonBlock(node: SyntaxNode): Record<string, any> {
    const result: Record<string, any> = {};

    // 遍历所有 JsonProperty 子节点
    let child = node.firstChild;
    while (child) {
      if (child.name === NODE_TYPES.JSON_PROPERTY) {
        const { name, value } = this.parseJsonProperty(child);
        if (name) {
          result[name] = value;
        }
      }
      child = child.nextSibling;
    }

    return result;
  }

  /**
   * 解析 JsonProperty
   */
  private parseJsonProperty(node: SyntaxNode): { name: string | null; value: any } {
    // 获取属性名节点
    const nameNode = node.getChild(NODE_TYPES.PROPERTY_NAME);
    if (!nameNode) {
      return { name: null, value: null };
    }

    const name = this.getNodeText(nameNode);

    // 获取值节点
    let valueNode = nameNode.nextSibling;
    
    // 跳过冒号
    while (valueNode && valueNode.name === ':') {
      valueNode = valueNode.nextSibling;
    }

    if (!valueNode) {
      return { name, value: null };
    }

    const value = this.parseValue(valueNode);
    return { name, value };
  }

  /**
   * 解析值节点
   */
  private parseValue(node: SyntaxNode): any {
    switch (node.name) {
      case NODE_TYPES.STRING_LITERAL: {
        const text = this.getNodeText(node);
        // 移除引号
        return text.replace(/^["']|["']$/g, '');
      }
      
      case NODE_TYPES.NUMBER_LITERAL: {
        const text = this.getNodeText(node);
        return parseFloat(text);
      }
      
      case NODE_TYPES.IDENTIFIER: {
        const text = this.getNodeText(node);
        // 处理布尔值和 null
        if (text === 'true') return true;
        if (text === 'false') return false;
        if (text === 'null') return null;
        return text;
      }
      
      case NODE_TYPES.JSON_BLOCK: {
        // 嵌套对象
        return this.parseJsonBlock(node);
      }
      
      default:
        // 其他类型返回原始文本
        return this.getNodeText(node);
    }
  }

  /**
   * 解析变量引用
   * 从 {{variableName}} 或 {{variableName:default}} 或 {{obj.nested.path}} 中提取信息
   */
  public parseVariableRef(text: string): VariableReference | null {
    // 正则匹配：
    // - {{variableName}}
    // - {{variableName:default}}
    // - {{obj.nested.path}}
    // - {{obj.nested.path:default}}
    const match = text.match(/^\{\{([a-zA-Z_$][a-zA-Z0-9_$.-]*)(:(.*))?\}\}$/);
    
    if (!match) {
      return null;
    }

    return {
      name: match[1],
      defaultValue: match[3],
      raw: text,
    };
  }

  /**
   * 解析字符串中的所有变量引用
   * 例如: "{{baseUrl}}/{{version}}/users" 或 "{{config.nested.value}}"
   */
  public parseVariableRefsInString(text: string): VariableReference[] {
    const refs: VariableReference[] = [];
    // 支持路径访问：允许变量名中包含 "."
    const regex = /\{\{([a-zA-Z_$][a-zA-Z0-9_$.-]*)(:[^}]+)?\}\}/g;
    
    let match;
    while ((match = regex.exec(text)) !== null) {
      refs.push({
        name: match[1],
        defaultValue: match[2] ? match[2].substring(1) : undefined, // 去掉冒号
        raw: match[0],
      });
    }
    
    return refs;
  }

  /**
   * 解析变量值（支持路径访问）
   * @param name 变量名，支持路径访问如 "config.nested.deep.value"
   * @param defaultValue 默认值
   * @returns 解析后的值
   */
  public resolveVariable(name: string, defaultValue?: string): any {
    // 检查是否包含路径访问符 "."
    if (name.includes('.')) {
      return this.resolveNestedVariable(name, defaultValue);
    }
    
    // 简单变量名直接查找
    if (this.variables.has(name)) {
      return this.variables.get(name);
    }
    return defaultValue;
  }

  /**
   * 解析嵌套变量（路径访问）
   * @param path 变量路径，如 "config.nested.deep.value"
   * @param defaultValue 默认值
   * @returns 解析后的值
   */
  private resolveNestedVariable(path: string, defaultValue?: string): any {
    const parts = path.split('.');
    const rootName = parts[0];
    
    // 获取根变量
    if (!this.variables.has(rootName)) {
      return defaultValue;
    }
    
    let current: any = this.variables.get(rootName);
    
    // 遍历路径访问嵌套属性
    for (let i = 1; i < parts.length; i++) {
      const key = parts[i];
      
      // 检查当前值是否是对象
      if (current === null || current === undefined || typeof current !== 'object') {
        return defaultValue;
      }
      
      // 访问嵌套属性
      if (!(key in current)) {
        return defaultValue;
      }
      
      current = current[key];
    }
    
    return current;
  }

  /**
   * 替换字符串中的所有变量引用
   * 支持：
   * - 简单变量: "{{baseUrl}}/{{version}}/users"
   * - 路径访问: "{{config.nested.deep.value}}"
   * - 默认值: "{{timeout:30000}}"
   */
  public replaceVariables(text: string): string {
    return text.replace(
      /\{\{([a-zA-Z_$][a-zA-Z0-9_$.-]*)(:[^}]+)?\}\}/g,
      (match, name, defaultPart) => {
        const defaultValue = defaultPart ? defaultPart.substring(1) : undefined;
        const value = this.resolveVariable(name, defaultValue);
        
        // 如果值是对象或数组，转换为 JSON 字符串
        if (value !== undefined && value !== null) {
          if (typeof value === 'object') {
            return JSON.stringify(value);
          }
          return String(value);
        }
        
        // 如果没有找到变量，保持原样
        return match;
      }
    );
  }

  /**
   * 获取所有已定义的变量
   */
  public getAllVariables(): Map<string, any> {
    return new Map(this.variables);
  }

  /**
   * 获取节点的文本内容
   */
  private getNodeText(node: SyntaxNode): string {
    return this.state.doc.sliceString(node.from, node.to);
  }
}


