import MarkdownIt from 'markdown-it';
import emojies_defs from './data/full';
import emojies_shortcuts from './data/shortcuts';
import bare_emoji_plugin from './bare';
import { EmojiOptions } from './normalize_opts';

/**
 * Full emoji 插件（包含完整的 emoji 数据）
 */
export default function emoji_plugin(md: MarkdownIt, options?: Partial<EmojiOptions>): void {
    const defaults: EmojiOptions = {
        defs: emojies_defs,
        shortcuts: emojies_shortcuts,
        enabled: []
    };

    const opts = md.utils.assign({}, defaults, options || {}) as EmojiOptions;

    bare_emoji_plugin(md, opts);
}

