/**
 * Location utilities for TOML CST nodes
 * These functions help Prettier determine the location of nodes for formatting
 */

import type { TomlCstNode } from './types';

/**
 * Get the start location of a CST node
 * @param cstNode - The TOML CST node
 * @returns The start offset of the node
 */
export function locStart(cstNode: TomlCstNode): number {
  if (!cstNode) {
    return 0;
  }

  // If the node has a direct startOffset, use it
  if (typeof cstNode.startOffset === 'number') {
    return cstNode.startOffset;
  }

  // If the node has children, find the earliest start offset
  if (cstNode.children) {
    let minOffset = Infinity;
    for (const key in cstNode.children) {
      const childrenArray = cstNode.children[key];
      if (Array.isArray(childrenArray)) {
        for (const child of childrenArray) {
          const childStart = locStart(child);
          if (childStart < minOffset) {
            minOffset = childStart;
          }
        }
      }
    }
    return minOffset === Infinity ? 0 : minOffset;
  }

  return 0;
}

/**
 * Get the end location of a CST node
 * @param cstNode - The TOML CST node
 * @returns The end offset of the node
 */
export function locEnd(cstNode: TomlCstNode): number {
  if (!cstNode) {
    return 0;
  }

  // If the node has a direct endOffset, use it
  if (typeof cstNode.endOffset === 'number') {
    return cstNode.endOffset;
  }

  // If the node has children, find the latest end offset
  if (cstNode.children) {
    let maxOffset = -1;
    for (const key in cstNode.children) {
      const childrenArray = cstNode.children[key];
      if (Array.isArray(childrenArray)) {
        for (const child of childrenArray) {
          const childEnd = locEnd(child);
          if (childEnd > maxOffset) {
            maxOffset = childEnd;
          }
        }
      }
    }
    return maxOffset === -1 ? 0 : maxOffset;
  }

  // If the node has an image (token), return the length
  if (cstNode.image) {
    const startOffset = locStart(cstNode);
    return startOffset + cstNode.image.length;
  }

  return 0;
}
