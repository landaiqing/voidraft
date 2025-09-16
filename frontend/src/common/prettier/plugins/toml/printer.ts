/**
 * TOML Printer for Prettier
 * 
 * This module provides a visitor-based printer for TOML CST nodes,
 * converting them to Prettier's document format.
 */

import { BaseTomlCstVisitor } from '@toml-tools/parser';
import { tokensDictionary as t } from '@toml-tools/lexer';
import { doc } from 'prettier';
import type { AstPath, Doc } from 'prettier';
import {
  trimComment,
  collectComments,
  arrItemOffset,
  arrItemProp,
  getSingle,
  formatKey,
  optimizeValue,
} from './printer-utils';
import type { 
  TomlCstNode, 
  TomlDocument, 
  TomlExpression,
  TomlKeyVal,
  TomlComment,
  TomlContext
} from './types';

const { join, line, hardline, softline, ifBreak, indent, group } = doc.builders;

/**
 * TOML Beautifier Visitor class that extends the base CST visitor
 */
class TomlBeautifierVisitor extends BaseTomlCstVisitor {
  // Helper methods
  public mapVisit: (elements: TomlCstNode[] | undefined) => (Doc | string)[];
  public visitSingle: (ctx: TomlContext) => Doc | string;
  public visit: (ctx: TomlCstNode, inParam?: any) => Doc | string;

  constructor() {
    super();
    
    // Try to call validateVisitor if it exists
    if (typeof (this as any).validateVisitor === 'function') {
      (this as any).validateVisitor();
    }
    
    // Initialize helper methods
    this.mapVisit = (elements: TomlCstNode[] | undefined): (Doc | string)[] => {
      if (!elements) {
        return [];
      }
      return elements.map((element) => this.visit(element));
    };

    this.visitSingle = (ctx: TomlContext): Doc | string => {
      const singleElement = getSingle(ctx);
      return this.visit(singleElement);
    };

    // Store reference to inherited visit method and override it
    const originalVisit = Object.getPrototypeOf(this).visit?.bind(this);
    this.visit = (ctx: TomlCstNode, inParam?: any): Doc | string => {
      if (!ctx) {
        return '';
      }
      
      // Try to use the inherited visit method first
      if (originalVisit) {
        try {
          return originalVisit(ctx, inParam);
        } catch (error) {
          console.warn('Original visit method failed:', error);
        }
      }
      
      // Fallback: manually dispatch based on node name/type
      const methodName = ctx.name;
      if (methodName && typeof (this as any)[methodName] === 'function') {
        const visitMethod = (this as any)[methodName];
        try {
          if (ctx.children) {
            return visitMethod.call(this, ctx.children);
          } else {
            return visitMethod.call(this, ctx);
          }
        } catch (error) {
          console.warn(`Visit method ${methodName} failed:`, error);
        }
      }
      
      // Final fallback: return image if available
      return ctx.image || '';
    };
  }

  /**
   * Visit the root TOML document
   */
  toml(ctx: TomlDocument): Doc {
    // Handle empty toml document
    if (!ctx.expression) {
      return [line];
    }

    const isTable = (node: TomlExpression): boolean => {
      return !!node.table;
    };

    const isOnlyComment = (node: TomlExpression): boolean => {
      return !!node.Comment && Object.keys(node).length === 1;
    };

    const expsCsts = ctx.expression;
    const cstGroups: TomlExpression[][] = [];
    let currCstGroup: TomlExpression[] = [];

    // Split expressions into groups defined by tables
    for (let i = expsCsts.length - 1; i >= 0; i--) {
      const currCstNode = expsCsts[i];
      currCstGroup.push(currCstNode);
      
      if (isTable(currCstNode)) {
        let j = i - 1;
        let stillInComments = true;
        
        // Add leading comments to current group
        while (j >= 0 && stillInComments) {
          const priorCstNode = expsCsts[j];
          if (isOnlyComment(priorCstNode)) {
            currCstGroup.push(priorCstNode);
            j--;
            i--;
          } else {
            stillInComments = false;
          }
        }
        
        // Reverse since we scanned backwards
        currCstGroup.reverse();
        cstGroups.push(currCstGroup);
        currCstGroup = [];
      }
    }
    
    if (currCstGroup.length > 0) {
      currCstGroup.reverse();
      cstGroups.push(currCstGroup);
    }

    // Adjust for reverse scanning
    cstGroups.reverse();
    const docGroups = cstGroups.map((currGroup) => this.mapVisit(currGroup));
    
    // Add newlines between group elements
    const docGroupsInnerNewlines = docGroups.map((currGroup) =>
      join(line, currGroup)
    );
    const docGroupsOuterNewlines = join([line, line], docGroupsInnerNewlines);
    
    return [docGroupsOuterNewlines, line];
  }

  /**
   * Visit an expression (keyval, table, or comment)
   */
  expression(ctx: TomlExpression): Doc | string {
    if (ctx.keyval) {
      let keyValDoc = this.visit(ctx.keyval[0]);
      if (ctx.Comment) {
        const commentText = trimComment(ctx.Comment[0].image);
        keyValDoc = [keyValDoc, ' ' + commentText];
      }
      return keyValDoc;
    } else if (ctx.table) {
      let tableDoc = this.visit(ctx.table[0]);
      if (ctx.Comment) {
        const commentText = trimComment(ctx.Comment[0].image);
        tableDoc = [tableDoc, ' ' + commentText];
      }
      return tableDoc;
    } else if (ctx.Comment) {
      return trimComment(ctx.Comment[0].image);
    }
    
    return '';
  }

  /**
   * Visit a key-value pair
   */
  keyval(ctx: TomlKeyVal): Doc {
    const keyDoc = this.visit(ctx.key[0]);
    const valueDoc = this.visit(ctx.val[0]);
    return [keyDoc, ' = ', valueDoc];
  }

  /**
   * Visit a key
   */
  key(ctx: any): Doc {
    const keyTexts = ctx.IKey?.map((tok: any) => {
      const keyText = tok.image;
      // Apply key formatting (add/remove quotes as needed)
      return formatKey(keyText);
    }) || [];
    
    return join('.', keyTexts);
  }

  /**
   * Visit a value
   */
  val(ctx: any): Doc | string {
    try {
      const actualValueNode = getSingle(ctx);
      if (actualValueNode.image !== undefined) {
        // Terminal token - 优化值的表示
        return optimizeValue(actualValueNode.image);
      } else {
        return this.visit(actualValueNode);
      }
    } catch (error) {
      // 如果getSingle失败，尝试直接处理children
      if (ctx.children) {
        // 处理不同类型的值
        for (const [childKey, childNodes] of Object.entries(ctx.children)) {
          if (Array.isArray(childNodes) && childNodes.length > 0) {
            const firstChild = childNodes[0];
            
            // 处理基本类型
            if (firstChild.image !== undefined) {
              // 优化值的表示（特别是字符串）
              return optimizeValue(firstChild.image);
            }
            
            // 处理复杂类型（如数组、内联表等）
            if (firstChild.name) {
              return this.visit(firstChild);
            }
          }
        }
      }
      
      return '';
    }
  }

  /**
   * Visit an array
   */
  array(ctx: any): Doc {
    const arrayValuesDocs = ctx.arrayValues ? this.visit(ctx.arrayValues) : '';
    const postComments = collectComments(ctx.commentNewline);
    const commentsDocs = postComments.map((commentTok) => {
      const trimmedCommentText = trimComment(commentTok.image);
      return [hardline, trimmedCommentText];
    });
    
    return group(['[', indent([arrayValuesDocs, commentsDocs]), softline, ']']);
  }

  /**
   * Visit array values
   */
  arrayValues(ctx: any): Doc {
    const values = ctx.val || [];
    const commas = ctx.Comma || [];
    const comments = collectComments(ctx.commentNewline);

    const itemsCst = [...values, ...commas, ...comments];
    itemsCst.sort((a, b) => {
      const aOffset = arrItemOffset(a);
      const bOffset = arrItemOffset(b);
      return aOffset - bOffset;
    });

    const itemsDoc: Doc[] = [];
    
    for (let i = 0; i < itemsCst.length; i++) {
      const cstItem = itemsCst[i];
      
      if (cstItem.name === 'val') {
        const valDoc = this.visit(cstItem);
        const valEndLine = arrItemProp(cstItem, 'endLine');
        let potentialComma = '';

        // Handle next item (comma or comment)
        if (itemsCst[i + 1]) {
          let nextPossibleComment = itemsCst[i + 1];
          
          // Skip commas
          if (nextPossibleComment.tokenType === t.Comma) {
            potentialComma = ',';
            i++;
            nextPossibleComment = itemsCst[i + 1];
          }
          
          // Handle same-line comments
          if (
            nextPossibleComment &&
            nextPossibleComment.tokenType === t.Comment &&
            nextPossibleComment.startLine === valEndLine
          ) {
            i++;
            const trimmedComment = trimComment(nextPossibleComment.image);
            const comment = ' ' + trimmedComment;
            itemsDoc.push([valDoc, potentialComma, comment, hardline]);
          } else {
            // No comment on same line
            const isTrailingComma = i === itemsCst.length - 1;
            const optionalCommaLineBreak = isTrailingComma
              ? ifBreak(',', '') // Only print trailing comma if multiline array
              : [potentialComma, line];
            itemsDoc.push([valDoc, optionalCommaLineBreak]);
          }
        } else {
          // Last item without followup
          itemsDoc.push([valDoc]);
        }
      } else if (cstItem.tokenType === t.Comment) {
        // Separate line comment
        const trimmedComment = trimComment(cstItem.image);
        itemsDoc.push([trimmedComment, hardline]);
      } else {
        throw new Error('Non-exhaustive match in arrayValues');
      }
    }
    
    return [softline, itemsDoc];
  }

  /**
   * Visit an inline table
   */
  inlineTable(ctx: any): Doc {
    const inlineTableKeyValsDocs = ctx.inlineTableKeyVals
      ? this.visit(ctx.inlineTableKeyVals)
      : '';
    return group(['{ ', inlineTableKeyValsDocs, ' }']);
  }

  /**
   * Visit inline table key-value pairs
   */
  inlineTableKeyVals(ctx: any): Doc {
    const keyValDocs = this.mapVisit(ctx.keyval);
    return join(', ', keyValDocs);
  }

  /**
   * Visit a table
   */
  table(ctx: any): Doc | string {
    return this.visitSingle(ctx);
  }

  /**
   * Visit a standard table
   */
  stdTable(ctx: any): Doc {
    if (ctx.key && ctx.key[0] && ctx.key[0].children && ctx.key[0].children.IKey) {
      const keyTexts = ctx.key[0].children.IKey.map((tok: any) => {
        return formatKey(tok.image);
      });
      return ['[', join('.', keyTexts), ']'];
    }
    return '[]';
  }

  /**
   * Visit an array table
   */
  arrayTable(ctx: any): Doc {
    if (ctx.key && ctx.key[0] && ctx.key[0].children && ctx.key[0].children.IKey) {
      const keyTexts = ctx.key[0].children.IKey.map((tok: any) => {
        return formatKey(tok.image);
      });
      return ['[[', join('.', keyTexts), ']]'];
    }
    return '[[]]';
  }

  /**
   * Visit newline (should not be called)
   */
  nl(ctx: any): never {
    throw new Error('Should not get here!');
  }

  /**
   * Visit comment newline (no-op)
   */
  commentNewline(ctx: any): void {
    // No operation needed
  }
}

// Create singleton visitor instance
const beautifierVisitor = new TomlBeautifierVisitor();

/**
 * Main print function for Prettier
 * @param path - AST path from Prettier
 * @param options - Print options
 * @param print - Print function (unused in this implementation)
 * @returns Formatted document
 */
export function print(path: AstPath<TomlCstNode>, options?: any, print?: any): Doc {
  const cst = path.node as TomlDocument;
  return beautifierVisitor.visit(cst);
}
