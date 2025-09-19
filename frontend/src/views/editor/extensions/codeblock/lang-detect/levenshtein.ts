/**
 * Levenshtein 距离算法
 */

/**
 * 内部最小值计算函数
 * 用于计算编辑距离的最小成本
 * 
 * @param d0 - 对角线上的距离
 * @param d1 - 左侧的距离
 * @param d2 - 上方的距离
 * @param bx - 字符串 b 的当前字符
 * @param ay - 字符串 a 的当前字符
 * @returns 最小编辑距离
 */
function min(d0: number, d1: number, d2: number, bx: number, ay: number): number {
    return d0 < d1 || d2 < d1
        ? d0 > d2 ? d2 + 1 : d0 + 1
        : bx === ay ? d1 : d1 + 1;
}

/**
 * 计算两个字符串之间的 Levenshtein 距离
 * 
 * 该实现使用了多项优化：
 * 1. 确保较短的字符串作为第一个参数
 * 2. 跳过公共前缀和后缀
 * 3. 使用滚动数组减少空间复杂度
 * 4. 批量处理以提高性能
 * 
 * @param stringA - 第一个字符串
 * @param stringB - 第二个字符串
 * @returns 编辑距离（非负整数）
 */
export function levenshteinDistance(a: string, b: string): number {
    if (a === b) return 0;

    if (a.length > b.length) {
        [a, b] = [b, a];
    }

    let la = a.length;
    let lb = b.length;

    // 跳过公共后缀
    while (la > 0 && a.charCodeAt(la - 1) === b.charCodeAt(lb - 1)) {
        la--;
        lb--;
    }

    let offset = 0;
    // 跳过公共前缀
    while (offset < la && a.charCodeAt(offset) === b.charCodeAt(offset)) {
        offset++;
    }

    la -= offset;
    lb -= offset;

    if (la === 0 || lb < 3) return lb;

    let x = 0, y: number, d0: number, d1: number, d2: number, d3: number;
    let dd = 0, dy: number, ay: number, bx0: number, bx1: number, bx2: number, bx3: number;

    const vector: number[] = [];
    for (y = 0; y < la; y++) {
        vector.push(y + 1, a.charCodeAt(offset + y));
    }

    const len = vector.length - 1;

    for (; x < lb - 3;) {
        bx0 = b.charCodeAt(offset + (d0 = x));
        bx1 = b.charCodeAt(offset + (d1 = x + 1));
        bx2 = b.charCodeAt(offset + (d2 = x + 2));
        bx3 = b.charCodeAt(offset + (d3 = x + 3));
        x += 4;
        dd = x;
        
        for (y = 0; y < len; y += 2) {
            dy = vector[y];
            ay = vector[y + 1];
            d0 = min(dy, d0, d1, bx0, ay);
            d1 = min(d0, d1, d2, bx1, ay);
            d2 = min(d1, d2, d3, bx2, ay);
            dd = min(d2, d3, dd, bx3, ay);
            vector[y] = dd;
            d3 = d2; d2 = d1; d1 = d0; d0 = dy;
        }
    }

    for (; x < lb;) {
        bx0 = b.charCodeAt(offset + (d0 = x));
        dd = ++x;
        for (y = 0; y < len; y += 2) {
            dy = vector[y];
            vector[y] = dd = min(dy, d0, dd, bx0, vector[y + 1]);
            d0 = dy;
        }
    }

    return dd;
} 