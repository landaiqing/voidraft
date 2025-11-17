/**
 * 数学块扩展
 * 提供数学表达式计算功能，支持实时显示计算结果
 */

import { ViewPlugin, Decoration, WidgetType } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import { getNoteBlockFromPos } from "./state";
import { transactionsHasAnnotation, CURRENCIES_LOADED } from "./annotation";

type MathParserEntry = {
    parser: any;
    prev?: any;
};
// 声明全局math对象
declare global {
    interface Window {
        math: any;
    }
}

/**
 * 数学结果小部件
 */
class MathResult extends WidgetType {
    constructor(
        private displayResult: string,
        private copyResult: string
    ) {
        super();
    }

    eq(other: MathResult): boolean {
        return other.displayResult === this.displayResult;
    }

    toDOM(): HTMLElement {
        const wrap = document.createElement("span");
        wrap.className = "code-blocks-math-result";
        
        const inner = document.createElement("span");
        inner.className = "inner";
        inner.innerHTML = this.displayResult;
        wrap.appendChild(inner);
        
        inner.addEventListener("click", (e) => {
            e.preventDefault();
            navigator.clipboard.writeText(this.copyResult);
            const copyElement = document.createElement("i");
            copyElement.className = "code-blocks-math-result-copied";
            copyElement.innerHTML = "Copied!";
            wrap.appendChild(copyElement);
            copyElement.offsetWidth; // trigger reflow so that the animation is shown
            copyElement.className = "code-blocks-math-result-copied fade-out";
            setTimeout(() => {
                copyElement.remove();
            }, 1700);
        });
        
        return wrap;
    }

    ignoreEvent(): boolean {
        return false;
    }
}

/**
 * 数学装饰函数
 */
function mathDeco(view: any, parserCache: WeakMap<any, MathParserEntry>): any {
    const builder = new RangeSetBuilder();
    
    for (const { from, to } of view.visibleRanges) {
        for (let pos = from; pos <= to;) {
            const line = view.state.doc.lineAt(pos);
            const block = getNoteBlockFromPos(view.state, pos);

            if (block && block.language.name === "math") {
                let entry = parserCache.get(block);
                let parser = entry?.parser;
                if (!parser) {
                    if (line.from > block.content.from) {
                        pos = block.content.from;
                        continue;
                    }
                    if (typeof window.math !== 'undefined') {
                        parser = window.math.parser();
                        entry = { parser, prev: undefined };
                        parserCache.set(block, entry);
                    }
                }
                
                // evaluate math line
                let result: any;
                try {
                    if (parser) {
                        if (entry && line.from === block.content.from && typeof parser.clear === "function") {
                            parser.clear();
                            entry.prev = undefined;
                        }
                        const prevValue = entry?.prev;
                        parser.set("prev", prevValue);
                        result = parser.evaluate(line.text);
                        if (entry && result !== undefined) {
                            entry.prev = result;
                        }
                    }
                } catch (e) {
                    // suppress any errors
                }

                // if we got a result from math.js, add the result decoration
                if (result !== undefined) {
                    const format = parser?.get?.("format");

                    let resultWidget: MathResult | undefined;
                    if (typeof(result) === "string") {
                        resultWidget = new MathResult(result, result);
                    } else if (format !== undefined && typeof(format) === "function") {
                        try {
                            resultWidget = new MathResult(format(result), format(result));
                        } catch (e) {
                            // suppress any errors
                        }
                    }
                    
                    if (resultWidget === undefined && typeof window.math !== 'undefined') {
                        resultWidget = new MathResult(
                            window.math.format(result, {
                                precision: 8,
                                upperExp: 8,
                                lowerExp: -6,
                            }),
                            window.math.format(result, {
                                notation: "fixed",
                            })
                        );
                    }
                    
                    if (resultWidget) {
                        builder.add(line.to, line.to, Decoration.widget({
                            widget: resultWidget,
                            side: 1,
                        }));
                    }
                }
            }
            pos = line.to + 1;
        }
    }
    return builder.finish();
}

/**
 * 数学块视图插件
 */
export const mathBlock = ViewPlugin.fromClass(class {
    decorations: any;
    mathParsers: WeakMap<any, MathParserEntry>;

    constructor(view: any) {
        this.mathParsers = new WeakMap();
        this.decorations = mathDeco(view, this.mathParsers);
    }

    update(update: any) {
        const hasCurrencyUpdate = transactionsHasAnnotation(update.transactions, CURRENCIES_LOADED);
        if (update.docChanged || hasCurrencyUpdate) {
            // 文档结构或汇率变化时重置解析缓存
            this.mathParsers = new WeakMap();
        }
        if (
            update.docChanged ||
            update.viewportChanged ||
            hasCurrencyUpdate
        ) {
            this.decorations = mathDeco(update.view, this.mathParsers);
        }
    }
}, {
    decorations: v => v.decorations
});

/**
 * 获取数学块扩展
 */
export function getMathBlockExtensions() {
    return [mathBlock];
}
