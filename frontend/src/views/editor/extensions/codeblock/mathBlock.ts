/**
 * 数学块扩展
 * 提供数学表达式计算功能，支持实时显示计算结果
 */

import { ViewPlugin, Decoration, WidgetType } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import { getNoteBlockFromPos } from "./state";
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
function mathDeco(view: any): any {
    let mathParsers = new WeakMap();
    let builder = new RangeSetBuilder();
    
    for (let { from, to } of view.visibleRanges) {
        for (let pos = from; pos <= to;) {
            let line = view.state.doc.lineAt(pos);
            var block = getNoteBlockFromPos(view.state, pos);

            if (block && block.language.name === "math") {
                // get math.js parser and cache it for this block
                let { parser, prev } = mathParsers.get(block) || {};
                if (!parser) {
                    if (typeof window.math !== 'undefined') {
                        parser = window.math.parser();
                        mathParsers.set(block, { parser, prev });
                    }
                }
                
                // evaluate math line
                let result: any;
                try {
                    if (parser) {
                        parser.set("prev", prev);
                        result = parser.evaluate(line.text);
                        if (result !== undefined) {
                            mathParsers.set(block, { parser, prev: result });
                        }
                    }
                } catch (e) {
                    // suppress any errors
                }

                // if we got a result from math.js, add the result decoration
                if (result !== undefined) {
                    let format = parser?.get("format");

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

    constructor(view: any) {
        this.decorations = mathDeco(view);
    }

    update(update: any) {
        // If the document changed, the viewport changed, update the decorations
        if (update.docChanged || update.viewportChanged) {
            this.decorations = mathDeco(update.view);
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
