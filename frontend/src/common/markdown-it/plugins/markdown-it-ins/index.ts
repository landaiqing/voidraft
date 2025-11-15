import MarkdownIt, { StateInline, Token } from 'markdown-it';

/**
 * 分隔符接口定义
 */
interface Delimiter {
    marker: number;
    length: number;
    jump: number;
    token: number;
    end: number;
    open: boolean;
    close: boolean;
}

/**
 * 扫描结果接口定义
 */
interface ScanResult {
    can_open: boolean;
    can_close: boolean;
    length: number;
}

/**
 * Token 元数据接口定义
 */
interface TokenMeta {
    delimiters?: Delimiter[];
}

/**
 * markdown-it-ins 插件
 * 用于支持插入文本语法 ++text++
 */
export default function ins_plugin(md: MarkdownIt): void {
    // Insert each marker as a separate text token, and add it to delimiter list
    //
    function tokenize(state: StateInline, silent: boolean): boolean {
        const start = state.pos;
        const marker = state.src.charCodeAt(start);

        if (silent) { return false; }

        if (marker !== 0x2B/* + */) { return false; }

        const scanned = state.scanDelims(state.pos, true) as ScanResult;
        let len = scanned.length;
        const ch = String.fromCharCode(marker);

        if (len < 2) { return false; }

        if (len % 2) {
            const token: Token = state.push('text', '', 0);
            token.content = ch;
            len--;
        }

        for (let i = 0; i < len; i += 2) {
            const token: Token = state.push('text', '', 0);
            token.content = ch + ch;

            if (!scanned.can_open && !scanned.can_close) { continue; }

            state.delimiters.push({
                marker,
                length: 0,     // disable "rule of 3" length checks meant for emphasis
                jump: i / 2, // 1 delimiter = 2 characters
                token: state.tokens.length - 1,
                end: -1,
                open: scanned.can_open,
                close: scanned.can_close
            } as Delimiter);
        }

        state.pos += scanned.length;

        return true;
    }

    // Walk through delimiter list and replace text tokens with tags
    //
    function postProcess(state: StateInline, delimiters: Delimiter[]): void {
        let token: Token;
        const loneMarkers: number[] = [];
        const max = delimiters.length;

        for (let i = 0; i < max; i++) {
            const startDelim = delimiters[i];

            if (startDelim.marker !== 0x2B/* + */) {
                continue;
            }

            if (startDelim.end === -1) {
                continue;
            }

            const endDelim = delimiters[startDelim.end];

            token = state.tokens[startDelim.token];
            token.type = 'ins_open';
            token.tag = 'ins';
            token.nesting = 1;
            token.markup = '++';
            token.content = '';

            token = state.tokens[endDelim.token];
            token.type = 'ins_close';
            token.tag = 'ins';
            token.nesting = -1;
            token.markup = '++';
            token.content = '';

            if (state.tokens[endDelim.token - 1].type === 'text' &&
                state.tokens[endDelim.token - 1].content === '+') {
                loneMarkers.push(endDelim.token - 1);
            }
        }

        // If a marker sequence has an odd number of characters, it's splitted
        // like this: `~~~~~` -> `~` + `~~` + `~~`, leaving one marker at the
        // start of the sequence.
        //
        // So, we have to move all those markers after subsequent s_close tags.
        //
        while (loneMarkers.length) {
            const i = loneMarkers.pop()!;
            let j = i + 1;

            while (j < state.tokens.length && state.tokens[j].type === 'ins_close') {
                j++;
            }

            j--;

            if (i !== j) {
                token = state.tokens[j];
                state.tokens[j] = state.tokens[i];
                state.tokens[i] = token;
            }
        }
    }

    md.inline.ruler.before('emphasis', 'ins', tokenize);
    md.inline.ruler2.before('emphasis', 'ins', function (state: StateInline): boolean {
        const tokens_meta = state.tokens_meta as TokenMeta[];
        const max = (state.tokens_meta || []).length;

        postProcess(state, state.delimiters as Delimiter[]);

        for (let curr = 0; curr < max; curr++) {
            if (tokens_meta[curr] && tokens_meta[curr].delimiters) {
                postProcess(state, tokens_meta[curr].delimiters!);
            }
        }

        return true;
    });
}