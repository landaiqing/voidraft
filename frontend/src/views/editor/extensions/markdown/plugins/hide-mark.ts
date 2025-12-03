import {
	Decoration,
	DecorationSet,
	EditorView,
	ViewPlugin,
	ViewUpdate
} from '@codemirror/view';
import { Extension, RangeSetBuilder } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import { checkRangeOverlap, invisibleDecoration, RangeTuple } from '../util';

/**
 * Node types that contain markers to hide.
 * Note: InlineCode is handled by inline-code.ts
 */
const TYPES_WITH_MARKS = new Set([
	'Emphasis',
	'StrongEmphasis',
	'Strikethrough'
]);

/**
 * Marker node types to hide.
 */
const MARK_TYPES = new Set([
	'EmphasisMark',
	'StrikethroughMark'
]);

// Export for external use
export const typesWithMarks = Array.from(TYPES_WITH_MARKS);
export const markTypes = Array.from(MARK_TYPES);

/**
 * Collect all mark ranges in visible viewport.
 */
function collectMarkRanges(view: EditorView): RangeTuple[] {
	const ranges: RangeTuple[] = [];
	const seen = new Set<number>();

	for (const { from, to } of view.visibleRanges) {
		syntaxTree(view.state).iterate({
			from,
			to,
			enter: ({ type, from: nodeFrom, to: nodeTo }) => {
				if (!TYPES_WITH_MARKS.has(type.name)) return;
				if (seen.has(nodeFrom)) return;
				seen.add(nodeFrom);
				ranges.push([nodeFrom, nodeTo]);
			}
		});
	}

	return ranges;
}

/**
 * Get which mark range the cursor is in (-1 if none).
 */
function getCursorMarkPos(ranges: RangeTuple[], selFrom: number, selTo: number): number {
	const selRange: RangeTuple = [selFrom, selTo];
	
	for (const range of ranges) {
		if (checkRangeOverlap(range, selRange)) {
			return range[0];
		}
	}
	return -1;
}

/**
 * Build mark hiding decorations.
 */
function buildDecorations(view: EditorView): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();
	const items: { from: number; to: number }[] = [];
	const { from: selFrom, to: selTo } = view.state.selection.main;
	const selRange: RangeTuple = [selFrom, selTo];
	const seen = new Set<number>();

	for (const { from, to } of view.visibleRanges) {
		syntaxTree(view.state).iterate({
			from,
			to,
			enter: ({ type, from: nodeFrom, to: nodeTo, node }) => {
				if (!TYPES_WITH_MARKS.has(type.name)) return;
				if (seen.has(nodeFrom)) return;
				seen.add(nodeFrom);

				// Skip if cursor is in this range
				if (checkRangeOverlap([nodeFrom, nodeTo], selRange)) return;

				// Collect mark positions
				const innerTree = node.toTree();
				innerTree.iterate({
					enter({ type: markType, from: markFrom, to: markTo }) {
						if (!MARK_TYPES.has(markType.name)) return;
						items.push({
							from: nodeFrom + markFrom,
							to: nodeFrom + markTo
						});
					}
				});
			}
		});
	}

	// Sort and add to builder
	items.sort((a, b) => a.from - b.from);
	
	for (const item of items) {
		builder.add(item.from, item.to, invisibleDecoration);
	}

	return builder.finish();
}

/**
 * Hide marks plugin with optimized updates.
 * 
 * Hides emphasis marks (*, **, ~~) when cursor is outside.
 * Note: InlineCode backticks are handled by inline-code.ts
 */
class HideMarkPlugin {
	decorations: DecorationSet;
	private markRanges: RangeTuple[] = [];
	private cursorMarkPos = -1;

	constructor(view: EditorView) {
		this.markRanges = collectMarkRanges(view);
		const { from, to } = view.state.selection.main;
		this.cursorMarkPos = getCursorMarkPos(this.markRanges, from, to);
		this.decorations = buildDecorations(view);
	}

	update(update: ViewUpdate) {
		const { docChanged, viewportChanged, selectionSet } = update;

		if (docChanged || viewportChanged) {
			this.markRanges = collectMarkRanges(update.view);
			const { from, to } = update.state.selection.main;
			this.cursorMarkPos = getCursorMarkPos(this.markRanges, from, to);
			this.decorations = buildDecorations(update.view);
			return;
		}

		if (selectionSet) {
			const { from, to } = update.state.selection.main;
			const newPos = getCursorMarkPos(this.markRanges, from, to);

			if (newPos !== this.cursorMarkPos) {
				this.cursorMarkPos = newPos;
				this.decorations = buildDecorations(update.view);
			}
		}
	}
}

/**
 * Hide marks plugin.
 * Hides marks for emphasis, strong, and strikethrough.
 */
export const hideMarks = (): Extension => [
	ViewPlugin.fromClass(HideMarkPlugin, {
		decorations: (v) => v.decorations
	})
];
