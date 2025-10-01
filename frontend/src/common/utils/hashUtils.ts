/**
 * 高效哈希算法实现
 * 针对大量文本内容优化的哈希函数集合
 */

/**
 * 使用优化的 xxHash32 算法生成字符串哈希值
 * 专为大量文本内容设计，性能优异
 * 
 * xxHash32 特点：
 * - 极快的处理速度
 * - 优秀的分布质量，冲突率极低
 * - 对长文本友好，性能不会随长度线性下降
 * - 被广泛应用于数据库、压缩工具等
 * 
 * @param content 要哈希的字符串内容
 * @returns 32位哈希值的字符串表示
 */
export const generateContentHash = (content: string): string => {
  return (generateContentHashInternal(content) >>> 0).toString(36);
};

/**
 * 从字符串中提取 32 位整数（模拟小端序）
 */
function getUint32(str: string, index: number): number {
  return (
    (str.charCodeAt(index) & 0xff) |
    ((str.charCodeAt(index + 1) & 0xff) << 8) |
    ((str.charCodeAt(index + 2) & 0xff) << 16) |
    ((str.charCodeAt(index + 3) & 0xff) << 24)
  );
}

/**
 * 32 位左旋转
 */
function rotateLeft(value: number, shift: number): number {
  return (value << shift) | (value >>> (32 - shift));
}


/**
 * 内部哈希计算函数，返回数值
 */
function generateContentHashInternal(content: string): number {
  const PRIME1 = 0x9e3779b1;
  const PRIME2 = 0x85ebca77;
  const PRIME3 = 0xc2b2ae3d;
  const PRIME4 = 0x27d4eb2f;
  const PRIME5 = 0x165667b1;
  
  const len = content.length;
  let hash: number;
  let i = 0;
  
  if (len >= 16) {
    let acc1 = PRIME1 + PRIME2;
    let acc2 = PRIME2;
    let acc3 = 0;
    let acc4 = -PRIME1;
    
    for (; i <= len - 16; i += 16) {
      acc1 = Math.imul(rotateLeft(acc1 + Math.imul(getUint32(content, i), PRIME2), 13), PRIME1);
      acc2 = Math.imul(rotateLeft(acc2 + Math.imul(getUint32(content, i + 4), PRIME2), 13), PRIME1);
      acc3 = Math.imul(rotateLeft(acc3 + Math.imul(getUint32(content, i + 8), PRIME2), 13), PRIME1);
      acc4 = Math.imul(rotateLeft(acc4 + Math.imul(getUint32(content, i + 12), PRIME2), 13), PRIME1);
    }
    
    hash = rotateLeft(acc1, 1) + rotateLeft(acc2, 7) + rotateLeft(acc3, 12) + rotateLeft(acc4, 18);
  } else {
    hash = PRIME5;
  }
  
  hash += len;
  
  for (; i <= len - 4; i += 4) {
    hash = Math.imul(rotateLeft(hash + Math.imul(getUint32(content, i), PRIME3), 17), PRIME4);
  }
  
  for (; i < len; i++) {
    hash = Math.imul(rotateLeft(hash + Math.imul(content.charCodeAt(i), PRIME5), 11), PRIME1);
  }
  
  hash ^= hash >>> 15;
  hash = Math.imul(hash, PRIME2);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, PRIME3);
  hash ^= hash >>> 16;
  
  return hash;
}