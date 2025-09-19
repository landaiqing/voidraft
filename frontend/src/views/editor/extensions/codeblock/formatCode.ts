import { EditorSelection } from "@codemirror/state"

import * as prettier from "prettier/standalone"
import { getActiveNoteBlock } from "./state"
import { getLanguage } from "./lang-parser/languages"
import { SupportedLanguage } from "./types"

export const formatBlockContent = (view) => {
    if (!view || view.state.readOnly)
        return false
        
    // 获取初始信息，但不缓存state对象
    const initialState = view.state
    const block = getActiveNoteBlock(initialState)

    if (!block) {
        return false
    }

    const blockFrom = block.content.from
    const blockTo = block.content.to
    const blockLanguageName = block.language.name as SupportedLanguage
    
    const language = getLanguage(blockLanguageName)
    if (!language || !language.prettier) {
        return false
    }
    
    // 获取初始需要的信息
    const cursorPos = initialState.selection.asSingle().ranges[0].head
    const content = initialState.sliceDoc(blockFrom, blockTo)
    const tabSize = initialState.tabSize

    // 检查光标是否在块的开始或结束
    const cursorAtEdge = cursorPos == blockFrom || cursorPos == blockTo

    // 执行异步格式化
    const performFormat = async () => {
        let formattedContent
        try {
            // 构建格式化配置
            const formatOptions = {
                parser: language.prettier!.parser,
                plugins: language.prettier!.plugins,
                tabWidth: tabSize,
                ...language.prettier!.options,
            }
            
            // 格式化代码
            const formatted = await prettier.format(content, formatOptions)
            
            // 计算新光标位置
            const cursorOffset = cursorAtEdge 
                ? (cursorPos == blockFrom ? 0 : formatted.length)
                : Math.min(cursorPos - blockFrom, formatted.length)
            
            formattedContent = {
                formatted,
                cursorOffset
            }
        } catch (e) {
            return false
        }
        
        try {
            // 格式化完成后再次获取最新状态
            const currentState = view.state
            
            // 重新获取当前块的位置
            const currentBlock = getActiveNoteBlock(currentState)
            
            if (!currentBlock) {
                console.warn('Block not found after formatting')
                return false
            }
            
            // 使用当前块的实际位置
            const currentBlockFrom = currentBlock.content.from
            const currentBlockTo = currentBlock.content.to
            
            // 基于最新状态创建更新
            view.dispatch({
                changes: {
                    from: currentBlockFrom,
                    to: currentBlockTo,
                    insert: formattedContent.formatted,
                },
                selection: EditorSelection.cursor(currentBlockFrom + Math.min(formattedContent.cursorOffset, formattedContent.formatted.length)),
                scrollIntoView: true,
                userEvent: "input"
            })
            
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