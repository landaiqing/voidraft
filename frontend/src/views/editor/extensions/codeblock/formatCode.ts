import { EditorSelection } from "@codemirror/state"

import * as prettier from "prettier/standalone"
import { getActiveNoteBlock } from "./state"
import { getLanguage } from "./lang-parser/languages"
import { SupportedLanguage } from "./types"

export const formatBlockContent = (view) => {
    const state = view.state
    if (state.readOnly)
        return false
    const block = getActiveNoteBlock(state)

    if (!block) {
        return false
    }

    const language = getLanguage(block.language.name as SupportedLanguage)
    if (!language || !language.prettier) {
        return false
    }
    
    // get current cursor position
    const cursorPos = state.selection.asSingle().ranges[0].head
    // get block content
    const content = state.sliceDoc(block.content.from, block.content.to)

    let useFormat = false
    if (cursorPos == block.content.from || cursorPos == block.content.to) {
        useFormat = true
    }

    // 执行异步格式化，但在回调中获取最新状态
    const performFormat = async () => {
        let formattedContent
        try {
            if (useFormat) {
                formattedContent = {
                    formatted: await prettier.format(content, {
                        parser: language.prettier!.parser,
                        plugins: language.prettier!.plugins,
                        tabWidth: state.tabSize,
                    }),
                }
                formattedContent.cursorOffset = cursorPos == block.content.from ? 0 : formattedContent.formatted.length
            } else {
                // formatWithCursor 有性能问题，改用简单格式化 + 光标位置计算
                const formatted = await prettier.format(content, {
                    parser: language.prettier!.parser,
                    plugins: language.prettier!.plugins,
                    tabWidth: state.tabSize,
                })
                formattedContent = {
                    formatted: formatted,
                    cursorOffset: Math.min(cursorPos - block.content.from, formatted.length)
                }
            }
        } catch (e) {
            const hyphens = "----------------------------------------------------------------------------"
            const errorMessage = (e as Error).message;
            console.log(`Error when trying to format block:\n${hyphens}\n${errorMessage}\n${hyphens}`)
            return false
        }
        
        try {
            // 重新获取当前状态和块信息，确保状态一致
            const currentState = view.state
            const currentBlock = getActiveNoteBlock(currentState)
            
            if (!currentBlock) {
                console.warn('Block not found after formatting')
                return false
            }
            
            view.dispatch(currentState.update({
                changes: {
                    from: currentBlock.content.from,
                    to: currentBlock.content.to,
                    insert: formattedContent.formatted,
                },
                selection: EditorSelection.cursor(currentBlock.content.from + Math.min(formattedContent.cursorOffset, formattedContent.formatted.length)),
            }, {
                userEvent: "input",
                scrollIntoView: true,
            }))
            return true;
        } catch (error) {
            console.error('Failed to apply formatting changes:', error);
            return false;
        }
    }
    
    // 执行异步格式化
    performFormat()
    return true // 立即返回 true，表示命令已开始执行
} 