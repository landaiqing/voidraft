import { EditorView, Decoration, ViewPlugin, DecorationSet, ViewUpdate } from '@codemirror/view';
import { Range } from '@codemirror/state';

// 生成彩虹颜色数组
function generateColors(): string[] {
    return ['red', 'orange', 'yellow', 'green', 'blue', 'indigo', 'violet'
    ];
}

class RainbowBracketsView {
    decorations: DecorationSet;

    constructor(view: EditorView) {
        this.decorations = this.getBracketDecorations(view);
    }

    update(update: ViewUpdate): void {
        if (update.docChanged || update.selectionSet || update.viewportChanged) {
            this.decorations = this.getBracketDecorations(update.view);
        }
    }

    private getBracketDecorations(view: EditorView): DecorationSet {
        const { doc } = view.state;
        const decorations: Range<Decoration>[] = [];
        const stack: { type: string; from: number }[] = [];
        const colors = generateColors();

        // 遍历文档内容
        for (let pos = 0; pos < doc.length; pos++) {
            const char = doc.sliceString(pos, pos + 1);

            // 遇到开括号
            if (char === '(' || char === '[' || char === '{') {
                stack.push({ type: char, from: pos });
            }
            // 遇到闭括号
            else if (char === ')' || char === ']' || char === '}') {
                const open = stack.pop();
                const matchingBracket = this.getMatchingBracket(char);

                if (open && open.type === matchingBracket) {
                    const color = colors[stack.length % colors.length];
                    const className = `cm-rainbow-bracket-${color}`;

                    // 为开括号和闭括号添加装饰
                    decorations.push(
                        Decoration.mark({ class: className }).range(open.from, open.from + 1),
                        Decoration.mark({ class: className }).range(pos, pos + 1)
                    );
                }
            }
        }

        return Decoration.set(decorations.sort((a, b) => a.from - b.from));
    }

    private getMatchingBracket(closingBracket: string): string | null {
        switch (closingBracket) {
            case ')': return '(';
            case ']': return '[';
            case '}': return '{';
            default: return null;
        }
    }
}

const rainbowBracketsPlugin = ViewPlugin.fromClass(RainbowBracketsView, {
    decorations: (v) => v.decorations,
});

export default function index() {
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