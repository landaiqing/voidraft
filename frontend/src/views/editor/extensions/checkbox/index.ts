import { EditorView, Decoration } from "@codemirror/view"
import { WidgetType } from "@codemirror/view"
import { ViewUpdate, ViewPlugin, DecorationSet } from "@codemirror/view"
import { Extension, Compartment, StateEffect } from "@codemirror/state"

// 创建字体变化效果
const fontChangeEffect = StateEffect.define<void>()

/**
 * 复选框小部件类
 */
class CheckboxWidget extends WidgetType {
    constructor(readonly checked: boolean) { 
        super() 
    }

    eq(other: CheckboxWidget) { 
        return other.checked == this.checked 
    }

    toDOM() {
        let wrap = document.createElement("span")
        wrap.setAttribute("aria-hidden", "true")
        wrap.className = "cm-checkbox-toggle"
        
        let box = document.createElement("input")
        box.type = "checkbox"
        box.checked = this.checked
        box.tabIndex = -1
        box.style.margin = "0"
        box.style.padding = "0"
        box.style.cursor = "pointer"
        box.style.position = "relative"
        box.style.top = "0.1em"
        box.style.marginRight = "0.5em"
        // 设置相对单位，让复选框跟随字体大小变化
        box.style.width = "1em"
        box.style.height = "1em"
        
        wrap.appendChild(box)
        return wrap
    }

    ignoreEvent() { 
        return false 
    }
}

/**
 * 查找并创建复选框装饰
 */
function findCheckboxes(view: EditorView) {
    let widgets: any = []
    const doc = view.state.doc
    
    for (let { from, to } of view.visibleRanges) {
        // 使用正则表达式查找 [x] 或 [ ] 模式
        const text = doc.sliceString(from, to)
        const checkboxRegex = /\[([ x])\]/gi
        let match
        
        while ((match = checkboxRegex.exec(text)) !== null) {
            const matchPos = from + match.index
            const matchEnd = matchPos + match[0].length
            
            // 检查前后是否有合适的空格或行首
            const beforeChar = matchPos > 0 ? doc.sliceString(matchPos - 1, matchPos) : ""
            const afterChar = matchEnd < doc.length ? doc.sliceString(matchEnd, matchEnd + 1) : ""
            
            // 只在行首或空格后，且后面跟空格或行尾时才渲染
            if ((beforeChar === "" || beforeChar === " " || beforeChar === "\t" || beforeChar === "\n") &&
                (afterChar === "" || afterChar === " " || afterChar === "\t" || afterChar === "\n")) {
                
                const isChecked = match[1].toLowerCase() === "x"
                let deco = Decoration.replace({
                    widget: new CheckboxWidget(isChecked),
                    inclusive: false,
                })
                widgets.push(deco.range(matchPos, matchEnd))
            }
        }
    }
    
    return Decoration.set(widgets)
}

/**
 * 切换复选框状态
 */
function toggleCheckbox(view: EditorView, pos: number) {
    const doc = view.state.doc
    
    // 查找当前位置附近的复选框模式
    for (let offset = -3; offset <= 0; offset++) {
        const checkPos = pos + offset
        if (checkPos >= 0 && checkPos + 3 <= doc.length) {
            const text = doc.sliceString(checkPos, checkPos + 3).toLowerCase()
            let change
            
            if (text === "[x]") {
                change = { from: checkPos, to: checkPos + 3, insert: "[ ]" }
            } else if (text === "[ ]") {
                change = { from: checkPos, to: checkPos + 3, insert: "[x]" }
            }
            
            if (change) {
                view.dispatch({ changes: change })
                return true
            }
        }
    }
    return false
}

// 创建字体变化效果的便捷函数
export const triggerFontChange = (view: EditorView) => {
    view.dispatch({
        effects: fontChangeEffect.of(undefined)
    })
}

/**
 * 创建复选框扩展
 */
export function createCheckboxExtension(): Extension {
    return [
        // 主要的复选框插件
        ViewPlugin.fromClass(class {
            decorations: DecorationSet

            constructor(view: EditorView) {
                this.decorations = findCheckboxes(view)
            }

            update(update: ViewUpdate) {
                // 检查是否需要重新渲染复选框
                const shouldUpdate = update.docChanged || 
                                   update.viewportChanged || 
                                   update.geometryChanged ||
                                   update.transactions.some(tr => tr.effects.some(e => e.is(fontChangeEffect)))
                
                if (shouldUpdate) {
                    this.decorations = findCheckboxes(update.view)
                }
            }
        }, {
            decorations: v => v.decorations,

            eventHandlers: {
                mousedown: (e, view) => {
                    let target = e.target as HTMLElement
                    if (target.nodeName == "INPUT" && target.parentElement!.classList.contains("cm-checkbox-toggle")) {
                        const pos = view.posAtDOM(target)
                        return toggleCheckbox(view, pos)
                    }
                }
            }
        }),

        // 复选框样式
        EditorView.theme({
            ".cm-checkbox-toggle": {
                display: "inline-block",
                verticalAlign: "baseline",
            },
            ".cm-checkbox-toggle input[type=checkbox]": {
                margin: "0",
                padding: "0",
                verticalAlign: "baseline",
                cursor: "pointer",
                // 确保复选框大小跟随字体
                fontSize: "inherit",
            }
        })
    ]
}

// 默认导出
export const checkboxExtension = createCheckboxExtension()

// 导出类型和工具函数
export {
    CheckboxWidget,
    toggleCheckbox,
    findCheckboxes
} 