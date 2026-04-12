/**
 * 代码块复制粘贴扩展
 * 防止复制分隔符标记，并接入 inlineImage 的图片复制/粘贴能力。
 */

import {EditorSelection, EditorState} from "@codemirror/state";
import {Command, EditorView} from "@codemirror/view";
import {LANGUAGES} from "./lang-parser/languages";
import {codeBlockEvent, CONTENT_EDIT, USER_EVENTS} from "./annotation";
import {blockState, getNoteBlockFromPos} from "./state";
import {inlineImageEnabledFacet, inlineImageOptionsFacet} from "../inlineImage";
import {
    copySelectedInlineImageIfNeeded,
    pasteInlineImagesFromClipboardEvent,
    pasteInlineImagesFromSystemClipboard
} from "../inlineImage/clipboardIntegration";
import {WIDGET_TAG_REGEX} from "../inlineImage/inlineImageParsing";
import * as runtime from "@wailsio/runtime";

/**
 * 构建块分隔符正则表达式
 */
const languageTokensMatcher = LANGUAGES.map(lang => lang.token).join("|");
const blockSeparatorRegex = new RegExp(`(?:^|\\n)∞∞∞(?:${languageTokensMatcher})(?:-(?:a|r|w))*\\n`, "g");

interface CutLineSpec {
    text: string;
    changes: { from: number; to: number };
    selection: EditorSelection;
}

/**
 * 获取被复制的范围和内容
 */
function copiedRange(state: EditorState, forCut = false) {
    const content: string[] = [];
    const ranges: any[] = [];

    for (const range of state.selection.ranges) {
        if (!range.empty) {
            content.push(state.sliceDoc(range.from, range.to));
            ranges.push(range);
        }
    }

    if (ranges.length === 0) {
        const copiedLines: number[] = [];
        for (const range of state.selection.ranges) {
            if (!range.empty) {
                continue;
            }

            const line = state.doc.lineAt(range.head);
            const lineContent = state.sliceDoc(line.from, line.to);
            if (copiedLines.includes(line.from)) {
                continue;
            }

            content.push(lineContent);
            if (forCut) {
                const lineEnd = line.to < state.doc.length ? line.to + 1 : line.to;
                ranges.push({from: line.from, to: lineEnd});
            } else {
                ranges.push(range);
            }
            copiedLines.push(line.from);
        }
    }

    return {
        text: content.join(state.lineBreak),
        ranges,
    };
}

function getSingleCursorCutLineSpec(state: EditorState): CutLineSpec | null {
    if (state.selection.ranges.length !== 1 || !state.selection.main.empty) {
        return null;
    }

    const cursor = state.selection.main;
    const line = state.doc.lineAt(cursor.head);
    const block = getNoteBlockFromPos(state, cursor.head);
    const blocks = state.field(blockState, false) ?? [];
    const blockIndex = block ? blocks.indexOf(block) : -1;
    const hasNextBlock = blockIndex >= 0 && blockIndex < blocks.length - 1;
    const endsAtBlockBoundary = Boolean(block && hasNextBlock && line.to === block.content.to);

    let from = line.from;
    let to = line.to < state.doc.length ? line.to + 1 : line.to;

    if (endsAtBlockBoundary) {
        if (block && line.from > block.content.from) {
            from = line.from - 1;
            to = line.to;
        } else {
            from = line.from;
            to = line.to;
        }
    }

    return {
        text: state.sliceDoc(line.from, line.to),
        changes: { from, to },
        selection: EditorSelection.create([EditorSelection.cursor(from)]),
    };
}

function normalizeCopiedText(text: string): string {
    return text
        .replaceAll(blockSeparatorRegex, "\n\n")
        .replaceAll(WIDGET_TAG_REGEX, "");
}

async function writeTextToClipboard(text: string, event?: ClipboardEvent): Promise<void> {
    try {
        await runtime.Clipboard.SetText(text);
        return;
    } catch (error) {
        console.error('[Clipboard] Failed to write to system clipboard:', error);
    }

    const data = event?.clipboardData;
    if (data) {
        data.clearData();
        data.setData("text/plain", text);
        return;
    }

    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
    }
}

async function handleCopyCut(view: EditorView, cut: boolean, event?: ClipboardEvent): Promise<boolean> {
    if (!cut && view.state.facet(inlineImageEnabledFacet)) {
        try {
            if (await copySelectedInlineImageIfNeeded(view)) {
                return true;
            }
        } catch (error) {
            console.error('[Clipboard] Failed to copy selected image:', error);
        }
    }

    const lineCutSpec = cut ? getSingleCursorCutLineSpec(view.state) : null;
    const copied = copiedRange(view.state, cut);
    let text = lineCutSpec?.text ?? copied.text;
    const {ranges} = copied;
    text = normalizeCopiedText(text);

    await writeTextToClipboard(text, event);

    if (cut && !view.state.readOnly) {
        if (lineCutSpec) {
            view.dispatch({
                changes: lineCutSpec.changes,
                selection: lineCutSpec.selection,
                scrollIntoView: true,
                userEvent: USER_EVENTS.DELETE_CUT,
                annotations: [codeBlockEvent.of(CONTENT_EDIT)],
            });
        } else {
            view.dispatch({
                changes: ranges,
                scrollIntoView: true,
                userEvent: USER_EVENTS.DELETE_CUT,
                annotations: [codeBlockEvent.of(CONTENT_EDIT)],
            });
        }
    }

    return true;
}

/**
 * 设置浏览器复制和剪切事件处理器，将块分隔符替换为换行符
 */
export const codeBlockCopyCut = EditorView.domEventHandlers({
    copy(event, view) {
        event.preventDefault();
        void handleCopyCut(view, false, event as ClipboardEvent);
    },

    cut(event, view) {
        event.preventDefault();
        void handleCopyCut(view, true, event as ClipboardEvent);
    },

    paste(event, view) {
        if (view.state.readOnly) {
            return false;
        }

        event.preventDefault();
        void pasteClipboard(view, event as ClipboardEvent);

        return true;
    }
});

/**
 * 粘贴函数
 */
function doPaste(view: EditorView, input: string) {
    const {state} = view;
    const text = state.toText(input);
    const byLine = text.lines === state.selection.ranges.length;

    let changes: any;

    if (byLine) {
        let i = 1;
        changes = state.changeByRange(range => {
            const line = text.line(i++);
            return {
                changes: {from: range.from, to: range.to, insert: line.text},
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

async function readClipboardText(event?: ClipboardEvent): Promise<string> {
    try {
        const text = await runtime.Clipboard.Text();
        if (text) {
            return text;
        }
    } catch (error) {
        console.error('[Clipboard] Failed to read from system clipboard:', error);
    }

    const eventText = event?.clipboardData?.getData("text/plain");
    if (eventText) {
        return eventText;
    }

    if (navigator.clipboard?.readText) {
        try {
            return await navigator.clipboard.readText();
        } catch (fallbackErr) {
            console.error('[Clipboard] Fallback also failed:', fallbackErr);
        }
    }

    return "";
}

async function pasteText(view: EditorView, event?: ClipboardEvent): Promise<boolean> {
    const text = await readClipboardText(event);
    if (!text) {
        return false;
    }

    doPaste(view, text);
    return true;
}

async function pasteClipboard(view: EditorView, event?: ClipboardEvent): Promise<boolean> {
    if (view.state.facet(inlineImageEnabledFacet)) {
        const options = view.state.facet(inlineImageOptionsFacet);
        const pasted = event
            ? await pasteInlineImagesFromClipboardEvent(view, event, options.maxDisplayHeight)
            : await pasteInlineImagesFromSystemClipboard(view, options.maxDisplayHeight);

        if (pasted) {
            return true;
        }
    }

    return pasteText(view, event);
}

/**
 * 复制命令
 */
export const copyCommand: Command = view => {
    void handleCopyCut(view, false);
    return true;
};

/**
 * 剪切命令
 */
export const cutCommand: Command = view => {
    void handleCopyCut(view, true);
    return true;
};

/**
 * 粘贴命令
 */
export const pasteCommand: Command = view => {
    void pasteClipboard(view);
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
