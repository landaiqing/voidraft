import { foldedRanges, syntaxTree } from '@codemirror/language';
import type { SyntaxNodeRef, TreeCursor } from '@lezer/common';
import { Decoration, EditorView } from '@codemirror/view';
import {
	EditorState,
	SelectionRange,
	CharCategory,
	findClusterBreak
} from '@codemirror/state';

// ============================================================================
// Type Definitions (ProseMark style)
// ============================================================================

/**
 * A range-like object with from and to properties.
 */
export interface RangeLike {
	from: number;
	to: number;
}

/**
 * Tuple representation of a range [from, to].
 */
export type RangeTuple = [number, number];

// ============================================================================
// Range Utilities
// ============================================================================

/**
 * Check if two ranges overlap (touch or intersect).
 * Based on the visual diagram on https://stackoverflow.com/a/25369187
 *
 * @param range1 - First range
 * @param range2 - Second range
 * @returns True if the ranges overlap
 */
export function checkRangeOverlap(
	range1: RangeTuple,
	range2: RangeTuple
): boolean {
	return range1[0] <= range2[1] && range2[0] <= range1[1];
}

/**
 * Check if two range-like objects touch or overlap.
 * ProseMark-style range comparison.
 *
 * @param a - First range
 * @param b - Second range
 * @returns True if ranges touch
 */
export function rangeTouchesRange(a: RangeLike, b: RangeLike): boolean {
	return a.from <= b.to && b.from <= a.to;
}

/**
 * Check if a selection touches a range.
 *
 * @param selection - Array of selection ranges
 * @param range - Range to check against
 * @returns True if any selection touches the range
 */
export function selectionTouchesRange(
	selection: readonly SelectionRange[],
	range: RangeLike
): boolean {
	return selection.some((sel) => rangeTouchesRange(sel, range));
}

/**
 * Check if a range is inside another range (subset).
 *
 * @param parent - Parent (bigger) range
 * @param child - Child (smaller) range
 * @returns True if child is inside parent
 */
export function checkRangeSubset(
	parent: RangeTuple,
	child: RangeTuple
): boolean {
	return child[0] >= parent[0] && child[1] <= parent[1];
}

/**
 * Check if any of the editor cursors is in the given range.
 *
 * @param state - Editor state
 * @param range - Range to check
 * @returns True if the cursor is in the range
 */
export function isCursorInRange(
	state: EditorState,
	range: RangeTuple
): boolean {
	return state.selection.ranges.some((selection) =>
		checkRangeOverlap(range, [selection.from, selection.to])
	);
}

// ============================================================================
// Tree Iteration Utilities
// ============================================================================

/**
 * Iterate over the syntax tree in the visible ranges of the document.
 *
 * @param view - Editor view
 * @param iterateFns - Object with `enter` and `leave` iterate function
 */
export function iterateTreeInVisibleRanges(
	view: EditorView,
	iterateFns: {
		enter(node: SyntaxNodeRef): boolean | void;
		leave?(node: SyntaxNodeRef): void;
	}
): void {
	for (const { from, to } of view.visibleRanges) {
		syntaxTree(view.state).iterate({ ...iterateFns, from, to });
	}
}

/**
 * Iterate through child nodes of a cursor.
 * ProseMark-style tree traversal.
 *
 * @param cursor - Tree cursor to iterate
 * @param enter - Callback function, return true to stop iteration
 */
export function iterChildren(
	cursor: TreeCursor,
	enter: (cursor: TreeCursor) => boolean | undefined
): void {
	if (!cursor.firstChild()) return;
	do {
		if (enter(cursor)) break;
	} while (cursor.nextSibling());
	cursor.parent();
}

// ============================================================================
// Line Utilities
// ============================================================================

/**
 * Returns the lines of the editor that are in the given range and not folded.
 * This function is useful for adding line decorations to each line of a block node.
 *
 * @param view - Editor view
 * @param from - Start of the range
 * @param to - End of the range
 * @returns A list of line blocks that are in the range
 */
export function editorLines(
	view: EditorView,
	from: number,
	to: number
) {
	let lines = view.viewportLineBlocks.filter((block) =>
		checkRangeOverlap([block.from, block.to], [from, to])
	);

	const folded = foldedRanges(view.state).iter();
	while (folded.value) {
		lines = lines.filter(
			(line) =>
				!checkRangeOverlap(
					[folded.from, folded.to],
					[line.from, line.to]
				)
		);
		folded.next();
	}

	return lines;
}

/**
 * Get line numbers for a range.
 *
 * @param state - Editor state
 * @param from - Start position
 * @param to - End position
 * @returns Array of line numbers
 */
export function getLineNumbers(
	state: EditorState,
	from: number,
	to: number
): number[] {
	const startLine = state.doc.lineAt(from).number;
	const endLine = state.doc.lineAt(to).number;
	const lines: number[] = [];

	for (let i = startLine; i <= endLine; i++) {
		lines.push(i);
	}

	return lines;
}

// ============================================================================
// Word Utilities (ProseMark style)
// ============================================================================

/**
 * Get the "WORD" at a position (vim-style WORD, including non-whitespace).
 *
 * @param state - Editor state
 * @param pos - Position in document
 * @returns Selection range of the WORD, or null if at whitespace
 */
export function stateWORDAt(
	state: EditorState,
	pos: number
): SelectionRange | null {
	const { text, from, length } = state.doc.lineAt(pos);
	const cat = state.charCategorizer(pos);
	let start = pos - from;
	let end = pos - from;

	while (start > 0) {
		const prev = findClusterBreak(text, start, false);
		if (cat(text.slice(prev, start)) === CharCategory.Space) break;
		start = prev;
	}

	while (end < length) {
		const next = findClusterBreak(text, end);
		if (cat(text.slice(end, next)) === CharCategory.Space) break;
		end = next;
	}

	return start === end
		? null
		: { from: start + from, to: end + from } as SelectionRange;
}

// ============================================================================
// Decoration Utilities
// ============================================================================

/**
 * Decoration to simply hide anything (replace with nothing).
 */
export const invisibleDecoration = Decoration.replace({});



// ============================================================================
// Slug Generation
// ============================================================================

/**
 * Class for generating unique slugs from heading contents.
 */
export class Slugger {
	/** Occurrences for each slug. */
	private occurrences: Map<string, number> = new Map();

	/**
	 * Generate a slug from the given content.
	 *
	 * @param text - Content to generate the slug from
	 * @returns The generated slug
	 */
	public slug(text: string): string {
		let slug = text
			.toLowerCase()
			.replace(/\s+/g, '-')
			.replace(/[^\w-]+/g, '');

		const count = this.occurrences.get(slug) || 0;
		if (count > 0) {
			slug += '-' + count;
		}
		this.occurrences.set(slug, count + 1);

		return slug;
	}

	/**
	 * Reset the slugger state.
	 */
	public reset(): void {
		this.occurrences.clear();
	}
}


