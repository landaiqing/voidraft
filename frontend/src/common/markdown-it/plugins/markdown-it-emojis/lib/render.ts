import { Token } from 'markdown-it';

/**
 * Emoji 渲染函数
 */
export default function emoji_html(tokens: Token[], idx: number): string {
    return tokens[idx].content;
}

