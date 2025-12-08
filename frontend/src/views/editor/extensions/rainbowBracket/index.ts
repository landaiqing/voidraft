import { EditorView, Decoration, ViewPlugin, DecorationSet, ViewUpdate } from '@codemirror/view';
import { Range } from '@codemirror/state';

// 彩虹颜色数组
const COLORS = ['red', 'orange', 'yellow', 'green', 'blue', 'indigo', 'violet'];

const OPEN_BRACKETS = new Set(['(', '[', '{']);
const CLOSE_BRACKETS = new Set([')', ']', '}']);
const BRACKET_PAIRS: Record<string, string> = { ')': '(', ']': '[', '}': '{' };

/**
 * 彩虹括号插件
 */
class RainbowBracketsView {
    decorations: DecorationSet;

    constructor(view: EditorView) {
        this.decorations = this.buildDecorations(view);
    }

    update(update: ViewUpdate): void {
        if (update.docChanged || update.viewportChanged) {
            this.decorations = this.buildDecorations(update.view);
        }
    }

    private buildDecorations(view: EditorView): DecorationSet {
        const decorations: Range<Decoration>[] = [];
        const doc = view.state.doc;
        
        const visibleRanges = view.visibleRanges;
        if (visibleRanges.length === 0) {
            return Decoration.set([]);
        }
        
        const visibleFrom = visibleRanges[0].from;
        const visibleTo = visibleRanges[visibleRanges.length - 1].to;
        
        // 阶段1: 预计算到可视范围开始位置的栈状态（只维护栈，不创建装饰）
        const stack: { char: string; from: number }[] = [];
        
        for (let pos = 0; pos < visibleFrom && pos < doc.length; pos++) {
            const char = doc.sliceString(pos, pos + 1);
            
            if (OPEN_BRACKETS.has(char)) {
                stack.push({ char, from: pos });
            } else if (CLOSE_BRACKETS.has(char)) {
                const open = stack.pop();
                if (open && open.char !== BRACKET_PAIRS[char]) {
                    stack.push(open); // 不匹配，放回
                }
            }
        }
        
        // 阶段2: 处理可视范围内的括号（创建装饰）
        for (let pos = visibleFrom; pos < visibleTo && pos < doc.length; pos++) {
            const char = doc.sliceString(pos, pos + 1);
            
            if (OPEN_BRACKETS.has(char)) {
                const depth = stack.length;
                stack.push({ char, from: pos });
                
                // 添加开括号装饰
                const color = COLORS[depth % COLORS.length];
                decorations.push(
                    Decoration.mark({ class: `cm-rainbow-bracket-${color}` }).range(pos, pos + 1)
                );
            } else if (CLOSE_BRACKETS.has(char)) {
                const open = stack.pop();
                
                if (open && open.char === BRACKET_PAIRS[char]) {
                    const depth = stack.length;
                    const color = COLORS[depth % COLORS.length];
                    
                    // 添加闭括号装饰
                    decorations.push(
                        Decoration.mark({ class: `cm-rainbow-bracket-${color}` }).range(pos, pos + 1)
                    );
                } else if (open) {
                    stack.push(open); // 不匹配，放回
                }
            }
        }
        
        return Decoration.set(decorations.sort((a, b) => a.from - b.from));
    }
}

const rainbowBracketsPlugin = ViewPlugin.fromClass(RainbowBracketsView, {
    decorations: (v) => v.decorations,
});

export default function rainbowBrackets() {
    return [
        rainbowBracketsPlugin,
        EditorView.baseTheme({
            // 为每种颜色定义CSS样式
            '.cm-rainbow-bracket-red': { color: '#FF6B6B' },
            '.cm-rainbow-bracket-orange': { color: '#FF9E6B' },
            '.cm-rainbow-bracket-yellow': { color: '#FFD166' },
            '.cm-rainbow-bracket-green': { color: '#06D6A0' },
            '.cm-rainbow-bracket-blue': { color: '#118AB2' },
            '.cm-rainbow-bracket-indigo': { color: '#6B5B95' },
            '.cm-rainbow-bracket-violet': { color: '#9B5DE5' },
        }),
    ];
}
