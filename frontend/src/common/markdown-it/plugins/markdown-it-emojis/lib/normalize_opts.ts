/**
 * Emoji 定义类型
 */
export interface EmojiDefs {
    [key: string]: string;
}

/**
 * Emoji 快捷方式类型
 */
export interface EmojiShortcuts {
    [key: string]: string | string[];
}

/**
 * 输入选项接口
 */
export interface EmojiOptions {
    defs: EmojiDefs;
    shortcuts: EmojiShortcuts;
    enabled: string[];
}

/**
 * 标准化后的选项接口
 */
export interface NormalizedEmojiOptions {
    defs: EmojiDefs;
    shortcuts: { [key: string]: string };
    scanRE: RegExp;
    replaceRE: RegExp;
}

/**
 * 转义正则表达式特殊字符
 */
function quoteRE(str: string): string {
    return str.replace(/[.?*+^$[\]\\(){}|-]/g, '\\$&');
}

/**
 * 将输入选项转换为更可用的格式并编译搜索正则表达式
 */
export default function normalize_opts(options: EmojiOptions): NormalizedEmojiOptions {
    let emojies = options.defs;

    // Filter emojies by whitelist, if needed
    if (options.enabled.length) {
        emojies = Object.keys(emojies).reduce((acc: EmojiDefs, key: string) => {
            if (options.enabled.indexOf(key) >= 0) acc[key] = emojies[key];
            return acc;
        }, {});
    }

    // Flatten shortcuts to simple object: { alias: emoji_name }
    const shortcuts = Object.keys(options.shortcuts).reduce((acc: { [key: string]: string }, key: string) => {
        // Skip aliases for filtered emojies, to reduce regexp
        if (!emojies[key]) return acc;

        if (Array.isArray(options.shortcuts[key])) {
            (options.shortcuts[key] as string[]).forEach((alias: string) => { acc[alias] = key; });
            return acc;
        }

        acc[options.shortcuts[key] as string] = key;
        return acc;
    }, {});

    const keys = Object.keys(emojies);
    let names: string;

    // If no definitions are given, return empty regex to avoid replacements with 'undefined'.
    if (keys.length === 0) {
        names = '^$';
    } else {
        // Compile regexp
        names = keys
            .map((name: string) => { return `:${name}:`; })
            .concat(Object.keys(shortcuts))
            .sort()
            .reverse()
            .map((name: string) => { return quoteRE(name); })
            .join('|');
    }
    const scanRE = RegExp(names);
    const replaceRE = RegExp(names, 'g');

    return {
        defs: emojies,
        shortcuts,
        scanRE,
        replaceRE
    };
}

