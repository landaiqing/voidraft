import {EditorView} from '@codemirror/view'

export const fontTheme = EditorView.theme({
    '&': {
        fontFamily: '"Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", Arial, sans-serif',
        fontSize: '12px'
    }
})