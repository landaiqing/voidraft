import type { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import {
    codeFolding,
    foldEffect,
    foldedRanges,
    foldGutter,
    unfoldEffect,
} from "@codemirror/language";
import { getActiveNoteBlock, getNoteBlockFromPos, getNoteBlocksFromRangeSet } from "./state";
import type { Block } from "./types";
import { ADD_NEW_BLOCK, LANGUAGE_CHANGE, transactionsHasAnnotationsAny } from "./annotation";
import { formatBlockCreatedAt } from "./timestamp";

const FOLD_LABEL_LENGTH = 80;

function getLocale(): string | undefined {
    if (typeof document !== "undefined") {
        return document.documentElement.lang || navigator.language || undefined;
    }
    return undefined;
}

function getSelectedBlocks(state: EditorState): Block[] {
    return getNoteBlocksFromRangeSet(state, state.selection.ranges);
}

function getFoldedBlockRanges(state: EditorState, block: Block): { from: number; to: number }[] {
    const firstLine = state.doc.lineAt(block.content.from);
    const ranges: { from: number; to: number }[] = [];

    foldedRanges(state).between(block.content.from, block.content.to, (from, to) => {
        if (from <= firstLine.to && to === block.content.to) {
            ranges.push({ from, to });
        }
    });

    return ranges;
}

export function getFoldBlockRange(block: Block, state: EditorState): { from: number; to: number } | null {
    const from = block.content.from;
    const to = block.content.to;

    if (from >= to) {
        return null;
    }

    return { from, to };
}

export function canFoldBlock(state: EditorState, block?: Block | null): boolean {
    if (!block) {
        return false;
    }

    return Boolean(getFoldBlockRange(block, state));
}

export function isBlockFolded(state: EditorState, block?: Block | null): boolean {
    if (!block) {
        return false;
    }

    return getFoldedBlockRanges(state, block).length > 0;
}

function createPlaceholderDOM(state: EditorState, from: number, to: number): HTMLElement {
    const block = getNoteBlockFromPos(state, from) ?? getNoteBlockFromPos(state, Math.max(0, to - 1)) ?? null;
    const firstLine = state.doc.lineAt(from);
    const lastLinePos = Math.max(from, to - 1);
    const lastLine = state.doc.lineAt(lastLinePos);
    const lineCount = Math.max(1, lastLine.number - firstLine.number + 1);

    const dom = document.createElement("span");
    dom.className = "cm-foldPlaceholder cm-block-fold-placeholder";

    const label = document.createElement("span");
    label.className = "cm-block-fold-label";
    label.textContent = firstLine.text.slice(0, FOLD_LABEL_LENGTH).trimEnd();
    dom.appendChild(label);

    const summary = document.createElement("span");
    summary.className = "cm-block-fold-summary";
    summary.textContent = `${label.textContent ? " " : ""}… (${lineCount} lines)`;
    dom.appendChild(summary);

    if (block?.createdAt && block.content.from === from && block.content.to === to) {
        const createdTime = formatBlockCreatedAt(block.createdAt, undefined, getLocale());
        if (createdTime) {
            const created = document.createElement("span");
            created.className = "cm-block-fold-created-time";
            created.textContent = createdTime;
            created.title = block.createdAt;
            dom.appendChild(created);
        }
    }

    return dom;
}

function autoUnfoldOnEdit() {
    return EditorView.updateListener.of((update) => {
        if (!update.docChanged) {
            return;
        }

        const foldRanges = foldedRanges(update.state);
        if (!foldRanges || foldRanges.size === 0) {
            return;
        }

        if (transactionsHasAnnotationsAny(update.transactions, [ADD_NEW_BLOCK, LANGUAGE_CHANGE])) {
            return;
        }

        const unfoldTargets: { from: number; to: number }[] = [];

        update.changes.iterChanges((_fromA, _toA, fromB, toB) => {
            foldRanges.between(0, update.state.doc.length, (from, to) => {
                const lineFrom = update.state.doc.lineAt(from).from;
                const lineTo = update.state.doc.lineAt(to).to;

                if ((fromB >= lineFrom && fromB <= lineTo) || (toB >= lineFrom && toB <= lineTo)) {
                    unfoldTargets.push({ from, to });
                }
            });
        });

        if (unfoldTargets.length > 0) {
            update.view.dispatch({
                effects: unfoldTargets.map(range => unfoldEffect.of(range)),
            });
        }
    });
}

export const foldBlockCommand = (view: EditorView): boolean => {
    const blocks = getSelectedBlocks(view.state);
    const ranges = blocks
        .map(block => getFoldBlockRange(block, view.state))
        .filter((range): range is { from: number; to: number } => Boolean(range));

    if (ranges.length === 0) {
        return false;
    }

    view.dispatch({
        effects: ranges.map(range => foldEffect.of(range)),
    });
    return true;
};

export const unfoldBlockCommand = (view: EditorView): boolean => {
    const blocks = getSelectedBlocks(view.state);
    const ranges = blocks.flatMap(block => getFoldedBlockRanges(view.state, block));

    if (ranges.length === 0) {
        return false;
    }

    view.dispatch({
        effects: ranges.map(range => unfoldEffect.of(range)),
    });
    return true;
};

export const toggleFoldBlockCommand = (view: EditorView): boolean => {
    const blocks = getSelectedBlocks(view.state);
    if (blocks.length === 0) {
        return false;
    }

    const foldRanges: { from: number; to: number }[] = [];
    const unfoldRanges: { from: number; to: number }[] = [];
    let foldedCount = 0;
    let unfoldedCount = 0;

    for (const block of blocks) {
        const currentFoldedRanges = getFoldedBlockRanges(view.state, block);
        if (currentFoldedRanges.length > 0) {
            foldedCount += 1;
            unfoldRanges.push(...currentFoldedRanges);
            continue;
        }

        const foldRange = getFoldBlockRange(block, view.state);
        if (foldRange) {
            unfoldedCount += 1;
            foldRanges.push(foldRange);
        }
    }

    if (foldRanges.length === 0 && unfoldRanges.length === 0) {
        return false;
    }

    view.dispatch({
        effects: (unfoldedCount >= foldedCount ? foldRanges : unfoldRanges)
            .map(range => (unfoldedCount >= foldedCount ? foldEffect : unfoldEffect).of(range)),
    });
    return true;
};

export function toggleActiveBlockFold(view: EditorView): boolean {
    if (!getActiveNoteBlock(view.state)) {
        return false;
    }

    return toggleFoldBlockCommand(view);
}

export function createBlockFoldExtension() {
    return [
        foldGutter({
            domEventHandlers: {
                click(view) {
                    view.focus();
                    return false;
                },
            },
        }),
        codeFolding({
            preparePlaceholder: (state, range) => createPlaceholderDOM(state, range.from, range.to),
            placeholderDOM: (_view, onClick, prepared) => {
                prepared.addEventListener("click", onClick);
                return prepared;
            },
        }),
        autoUnfoldOnEdit(),
    ];
}
