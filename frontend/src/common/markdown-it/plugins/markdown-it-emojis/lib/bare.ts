import MarkdownIt from 'markdown-it';
import emoji_html from './render';
import emoji_replace from './replace';
import normalize_opts, { EmojiOptions } from './normalize_opts';

/**
 * Bare emoji 插件（不包含预定义的 emoji 数据）
 */
export default function emoji_plugin(md: MarkdownIt, options?: Partial<EmojiOptions>): void {
    const defaults: EmojiOptions = {
        defs: {},
        shortcuts: {},
        enabled: []
    };

    const opts = normalize_opts(md.utils.assign({}, defaults, options || {}) as EmojiOptions);

    md.renderer.rules.emoji = emoji_html;

    md.core.ruler.after(
        'linkify',
        'emoji',
        emoji_replace(md, opts.defs, opts.shortcuts, opts.scanRE, opts.replaceRE)
    );
}

