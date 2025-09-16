/**
 * Utility functions for TOML printer
 */

import type { TomlCstNode, TomlComment, TomlContext } from './types';

/**
 * Trim trailing whitespace from comment text
 * @param commentText - The comment text to trim
 * @returns Trimmed comment text
 */
export function trimComment(commentText: string): string {
  return commentText.replace(/[ \t]+$/, '');
}

/**
 * Check if a quoted string can be unquoted
 * @param quotedText - The quoted text to check
 * @returns Whether the text can be unquoted
 */
export function canUnquote(quotedText: string): boolean {
  // Remove quotes if present
  let text = quotedText;
  if (text.startsWith('"') && text.endsWith('"')) {
    text = text.slice(1, -1);
  } else if (text.startsWith("'") && text.endsWith("'")) {
    text = text.slice(1, -1);
  }

  // Empty string needs quotes
  if (text.length === 0) {
    return false;
  }

  // Check if the string is a valid unquoted key
  // TOML unquoted keys can contain:
  // - A-Z, a-z, 0-9, _, -
  const unquotedKeyRegex = /^[A-Za-z0-9_-]+$/;
  
  // Additional checks for values that might be confused with other TOML types
  if (unquotedKeyRegex.test(text)) {
    // Don't unquote strings that look like booleans
    if (text === 'true' || text === 'false') {
      return false;
    }
    
    // Don't unquote strings that look like numbers
    if (/^[+-]?(\d+\.?\d*|\d*\.\d+)([eE][+-]?\d+)?$/.test(text)) {
      return false;
    }
    
    // Don't unquote strings that look like dates/times
    if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
      return false;
    }
    
    return true;
  }

  return false;
}

/**
 * Check if a key needs quotes
 * @param keyText - The key text to check
 * @returns Whether the key needs quotes
 */
export function keyNeedsQuotes(keyText: string): boolean {
  return !canUnquote(`"${keyText}"`);
}

/**
 * Format a key, adding or removing quotes as needed
 * @param keyText - The key text to format
 * @returns Formatted key
 */
export function formatKey(keyText: string): string {
  // If already quoted, check if we can unquote
  if ((keyText.startsWith('"') && keyText.endsWith('"')) || 
      (keyText.startsWith("'") && keyText.endsWith("'"))) {
    if (canUnquote(keyText)) {
      return keyText.slice(1, -1);
    }
    return keyText;
  }

  // If not quoted, check if we need to add quotes
  if (keyNeedsQuotes(keyText)) {
    return `"${keyText}"`;
  }

  return keyText;
}

/**
 * Check if a string contains escape sequences that need to be preserved
 * @param str - The string to check
 * @returns Whether the string contains escape sequences
 */
export function containsEscapeSequences(str: string): boolean {
  // Check for common escape sequences
  return /\\[btnfr"\\\/]|\\u[0-9a-fA-F]{4}|\\U[0-9a-fA-F]{8}/.test(str);
}

/**
 * Check if a string can use literal string syntax (single quotes)
 * @param str - The string to check (without quotes)
 * @returns Whether literal string syntax can be used
 */
export function canUseLiteralString(str: string): boolean {
  // Literal strings cannot contain single quotes or control characters
  // and don't need escape sequences
  return !str.includes("'") && 
         !/[\x00-\x08\x0A-\x1F\x7F]/.test(str) &&
         !containsEscapeSequences(str);
}

/**
 * Check if a string should use multiline syntax
 * @param str - The string to check (without quotes)
 * @returns Whether multiline syntax should be used
 */
export function shouldUseMultiline(str: string): boolean {
  // Use multiline for strings that contain newlines
  return str.includes('\n') || str.includes('\r');
}

/**
 * Format a string value optimally
 * @param value - The string value (potentially with quotes)
 * @returns Optimally formatted string
 */
export function formatStringValue(value: string): string {
  // If it's already a properly formatted string, keep it
  if (!value.startsWith('"') && !value.startsWith("'")) {
    return value;
  }

  // Extract the actual string content
  let content: string;
  let isLiteral = false;
  
  if (value.startsWith('"""') && value.endsWith('"""')) {
    // Multiline basic string
    content = value.slice(3, -3);
  } else if (value.startsWith("'''") && value.endsWith("'''")) {
    // Multiline literal string
    content = value.slice(3, -3);
    isLiteral = true;
  } else if (value.startsWith('"') && value.endsWith('"')) {
    // Basic string
    content = value.slice(1, -1);
  } else if (value.startsWith("'") && value.endsWith("'")) {
    // Literal string
    content = value.slice(1, -1);
    isLiteral = true;
  } else {
    return value; // Fallback
  }

  // Decide on the best format
  if (shouldUseMultiline(content)) {
    if (isLiteral || !containsEscapeSequences(content)) {
      // Use multiline literal string if no escapes needed
      return `'''${content}'''`;
    } else {
      // Use multiline basic string
      return `"""${content}"""`;
    }
  } else {
    if (canUseLiteralString(content) && !containsEscapeSequences(content)) {
      // Use literal string for simple cases
      return `'${content}'`;
    } else {
      // Use basic string
      return `"${content}"`;
    }
  }
}

/**
 * Optimize value representation (for strings, numbers, etc.)
 * @param value - The value to optimize
 * @returns Optimized value representation
 */
export function optimizeValue(value: string): string {
  // Handle string values
  if (value.startsWith('"') || value.startsWith("'")) {
    return formatStringValue(value);
  }

  // For non-strings, return as-is
  return value;
}

/**
 * Collect all comments from comment newline nodes
 * @param commentsNL - Array of comment newline nodes
 * @returns Array of comment tokens
 */
export function collectComments(commentsNL: TomlCstNode[] = []): TomlComment[] {
  const comments: TomlComment[] = [];
  
  commentsNL.forEach((commentNLNode) => {
    if (commentNLNode.children?.Comment) {
      const commentsTok = commentNLNode.children.Comment;
      for (const comment of commentsTok) {
        if (comment.image) {
          comments.push(comment as TomlComment);
        }
      }
    }
  });

  return comments;
}

/**
 * Get a single element from a context that should contain exactly one key-value pair
 * @param ctx - The context to extract from
 * @returns The single element
 * @throws Error if the context doesn't contain exactly one element
 */
export function getSingle(ctx: TomlContext): TomlCstNode {
  const ctxKeys = Object.keys(ctx);
  if (ctxKeys.length !== 1) {
    throw new Error(
      `Expecting single key CST ctx but found: <${ctxKeys.length}> keys`
    );
  }
  
  const singleElementKey = ctxKeys[0];
  const singleElementValues = ctx[singleElementKey];

  if (!Array.isArray(singleElementValues) || singleElementValues.length !== 1) {
    throw new Error(
      `Expecting single item in CST ctx key but found: <${singleElementValues?.length || 0}> items`
    );
  }

  return singleElementValues[0];
}

/**
 * Get the start offset of an array item (deprecated - use arrItemProp instead)
 * @param item - The array item node
 * @returns The start offset
 */
export function arrItemOffset(item: TomlCstNode): number {
  return arrItemProp(item, 'startOffset') as number;
}

/**
 * Get a specific property from an array item, handling wrapped values
 * @param item - The array item node
 * @param propName - The property name to retrieve
 * @returns The property value
 * @throws Error for non-exhaustive matches
 */
export function arrItemProp(item: TomlCstNode, propName: keyof TomlCstNode): any {
  let currentItem = item;

  // Unwrap 'val' nodes
  if (currentItem.name === 'val' && currentItem.children) {
    currentItem = getSingle(currentItem.children);
  }

  // Direct property access
  if (currentItem[propName] !== undefined) {
    return currentItem[propName];
  }

  // Check for LSquare (array start)
  if (currentItem.children?.LSquare?.[0]?.[propName] !== undefined) {
    return currentItem.children.LSquare[0][propName];
  }

  // Check for LCurly (inline table start)
  if (currentItem.children?.LCurly?.[0]?.[propName] !== undefined) {
    return currentItem.children.LCurly[0][propName];
  }

  throw new Error(`Non-exhaustive match for property ${propName}`);
}
