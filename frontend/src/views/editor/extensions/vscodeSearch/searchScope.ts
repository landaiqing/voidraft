import type { EditorState } from "@codemirror/state";
import type { SearchQuery } from "@codemirror/search";
import { getActiveNoteBlock, blockState } from "../codeblock/state";

export type SearchScope = "all" | "currentBlock";

const MAX_MATCH_COUNT = 9999;

function isWithinBlockContent(state: EditorState, from: number, to: number): boolean {
    const blocks = state.field(blockState, false);
    if (!blocks || blocks.length === 0) return true;
    return blocks.some(block => from >= block.content.from && to <= block.content.to);
}

export function createSearchScopeTest(scope: SearchScope) {
    return (_match: string, state: EditorState, from: number, to: number) => {
        if (scope === "currentBlock") {
            const block = getActiveNoteBlock(state);
            if (!block) return false;
            return from >= block.content.from && to <= block.content.to;
        }
        return isWithinBlockContent(state, from, to);
    };
}

export function countQueryMatches(state: EditorState, query: SearchQuery): { total: number; current: number } {
    if (!query.search) {
        return { total: 0, current: 0 };
    }

    const selection = state.selection.main;
    let total = 0;
    let current = 0;
    let firstAfterSelection = 0;

    const cursor = query.getCursor(state);
    for (let next = cursor.next(); !next.done; next = cursor.next()) {
        const match = next.value;
        total += 1;

        const containsSelection = selection.from >= match.from && selection.to <= match.to;
        if (!current && containsSelection) {
            current = total;
        }

        if (!firstAfterSelection && match.from >= selection.head) {
            firstAfterSelection = total;
        }

        if (total >= MAX_MATCH_COUNT) {
            break;
        }
    }

    if (!current) {
        current = firstAfterSelection || (total > 0 ? total : 0);
    }

    return { total, current };
}
