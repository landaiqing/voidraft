/**
 * 代码块复制粘贴扩展
 * 防止复制分隔符标记，自动替换为换行符
 */

import { EditorState, EditorSelection } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { Command } from "@codemirror/view";
import { LANGUAGES } from "./lang-parser/languages";
import { USER_EVENTS, codeBlockEvent, CONTENT_EDIT } from "./annotation";

/**
 * 构建块分隔符正则表达式
 */
const languageTokensMatcher = LANGUAGES.map(lang => lang.token).join("|");
const blockSeparatorRegex = new RegExp(`\\n∞∞∞(${languageTokensMatcher})(-a)?\\n`, "g");

/**
 * 获取被复制的范围和内容
 */
function copiedRange(state: EditorState, forCut: boolean = false) {
  const content: string[] = [];
  const ranges: any[] = [];
  
  for (const range of state.selection.ranges) {
    if (!range.empty) {
      content.push(state.sliceDoc(range.from, range.to));
      ranges.push(range);
    }
  }
  
  if (ranges.length === 0) {
    // 如果所有范围都是空的，我们想要复制每个选择的整行（唯一的）
    const copiedLines: number[] = [];
    for (const range of state.selection.ranges) {
      if (range.empty) {
        const line = state.doc.lineAt(range.head);
        const lineContent = state.sliceDoc(line.from, line.to);
        if (!copiedLines.includes(line.from)) {
          content.push(lineContent);
          // 对于剪切操作，需要包含整行范围（包括换行符）
          if (forCut) {
            const lineEnd = line.to < state.doc.length ? line.to + 1 : line.to;
            ranges.push({ from: line.from, to: lineEnd });
          } else {
            ranges.push(range);
          }
          copiedLines.push(line.from);
        }
      }
    }
  }
  
  return { 
    text: content.join(state.lineBreak), 
    ranges 
  };
}

/**
 * 设置浏览器复制和剪切事件处理器，将块分隔符替换为换行符
 */
export const codeBlockCopyCut = EditorView.domEventHandlers({
  copy(event, view) {
    let { text } = copiedRange(view.state);
    // 将块分隔符替换为双换行符
    text = text.replaceAll(blockSeparatorRegex, "\n\n");
    
    const data = event.clipboardData;
    if (data) {
      event.preventDefault();
      data.clearData();
      data.setData("text/plain", text);
    }
  },
  
  cut(event, view) {
    let { text, ranges } = copiedRange(view.state, true);
    // 将块分隔符替换为双换行符
    text = text.replaceAll(blockSeparatorRegex, "\n\n");
    
    const data = event.clipboardData;
    if (data) {
      event.preventDefault();
      data.clearData();
      data.setData("text/plain", text);
    }
    
    if (!view.state.readOnly) {
      view.dispatch({
        changes: ranges,
        scrollIntoView: true,
        userEvent: USER_EVENTS.DELETE_CUT,
        annotations: [codeBlockEvent.of(CONTENT_EDIT)],
      });
    }
  }
});

/**
 * 复制和剪切的通用函数
 */
const copyCut = (view: EditorView, cut: boolean): boolean => {
  let { text, ranges } = copiedRange(view.state, cut);
  // 将块分隔符替换为双换行符
  text = text.replaceAll(blockSeparatorRegex, "\n\n");

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text);
  }

  if (cut && !view.state.readOnly) {
    view.dispatch({
      changes: ranges,
      scrollIntoView: true,
      userEvent: USER_EVENTS.DELETE_CUT,
      annotations: [codeBlockEvent.of(CONTENT_EDIT)],
    });
  }

  return true;
};

/**
 * 粘贴函数
 */
function doPaste(view: EditorView, input: string) {
  const { state } = view;
  const text = state.toText(input);
  const byLine = text.lines === state.selection.ranges.length;
  
  let changes: any;
  
  if (byLine) {
    let i = 1;
    changes = state.changeByRange(range => {
      const line = text.line(i++);
      return {
        changes: { from: range.from, to: range.to, insert: line.text },
        range: EditorSelection.cursor(range.from + line.length)
      };
    });
  } else {
    changes = state.replaceSelection(text);
  }
  
  view.dispatch(changes, {
    userEvent: USER_EVENTS.INPUT_PASTE,
    scrollIntoView: true,
    annotations: [codeBlockEvent.of(CONTENT_EDIT)],
  });
}

/**
 * 复制命令
 */
export const copyCommand: Command = (view) => {
  return copyCut(view, false);
};

/**
 * 剪切命令
 */
export const cutCommand: Command = (view) => {
  return copyCut(view, true);
};

/**
 * 粘贴命令
 */
export const pasteCommand: Command = (view) => {
  if (navigator.clipboard && navigator.clipboard.readText) {
    navigator.clipboard.readText()
      .then(text => {
        doPaste(view, text);
      })
      .catch(err => {
        console.error('Failed to read from clipboard:', err);
      });
  } else {
    console.warn('The clipboard API is not available, please use your browser\'s native paste feature');
  }
  return true;
};

/**
 * 获取复制粘贴扩展
 */
export function getCopyPasteExtensions() {
  return [
    codeBlockCopyCut,
  ];
}
