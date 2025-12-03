import { Extension, RangeSetBuilder } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import {
	ViewPlugin,
	DecorationSet,
	Decoration,
	EditorView,
	ViewUpdate
} from '@codemirror/view';
import { checkRangeOverlap, invisibleDecoration, RangeTuple } from '../util';

/** Mark decoration for inserted content */
const insertMarkDecoration = Decoration.mark({ class: 'cm-insert' });

/**
 * Insert plugin using syntax tree.
 *
 * Detects ++text++ and renders as inserted text (underline).
 */
export const insert = (): Extension => [insertPlugin, baseTheme];

/**
 * Collect all insert ranges in visible viewport.
 */
function collectInsertRanges(view: EditorView): RangeTuple[] {
	const ranges: RangeTuple[] = [];
	const seen = new Set<number>();

	for (const { from, to } of view.visibleRanges) {
		syntaxTree(view.state).iterate({
			from,
			to,
			enter: ({ type, from: nodeFrom, to: nodeTo }) => {
				if (type.name !== 'Insert') return;
				if (seen.has(nodeFrom)) return;
				seen.add(nodeFrom);
				ranges.push([nodeFrom, nodeTo]);
			}
		});
	}

	return ranges;
}

/**
 * Get which insert the cursor is in (-1 if none).
 */
function getCursorInsertPos(ranges: RangeTuple[], selFrom: number, selTo: number): number {
	const selRange: RangeTuple = [selFrom, selTo];
	
	for (const range of ranges) {
		if (checkRangeOverlap(range, selRange)) {
			return range[0];
		}
	}
	return -1;
}

/**
 * Build insert decorations.
 */
function buildDecorations(view: EditorView): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();
	const items: { from: number; to: number; deco: Decoration }[] = [];
	const { from: selFrom, to: selTo } = view.state.selection.main;
	const selRange: RangeTuple = [selFrom, selTo];
	const seen = new Set<number>();

	for (const { from, to } of view.visibleRanges) {
		syntaxTree(view.state).iterate({
			from,
			to,
			enter: ({ type, from: nodeFrom, to: nodeTo, node }) => {
				if (type.name !== 'Insert') return;
				if (seen.has(nodeFrom)) return;
				seen.add(nodeFrom);

				// Skip if cursor is in this insert
				if (checkRangeOverlap([nodeFrom, nodeTo], selRange)) return;

				const marks = node.getChildren('InsertMark');
				if (marks.length < 2) return;

				// Hide opening ++
				items.push({ from: marks[0].from, to: marks[0].to, deco: invisibleDecoration });

				// Apply insert style to content
				const contentStart = marks[0].to;
				const contentEnd = marks[marks.length - 1].from;
				if (contentStart < contentEnd) {
					items.push({ from: contentStart, to: contentEnd, deco: insertMarkDecoration });
				}

				// Hide closing ++
				items.push({ from: marks[marks.length - 1].from, to: marks[marks.length - 1].to, deco: invisibleDecoration });
			}
		});
	}

	// Sort and add to builder
	items.sort((a, b) => a.from - b.from);
	
	for (const item of items) {
		builder.add(item.from, item.to, item.deco);
	}

	return builder.finish();
}

/**
 * Insert plugin with optimized updates.
 */
class InsertPlugin {
	decorations: DecorationSet;
	private insertRanges: RangeTuple[] = [];
	private cursorInsertPos = -1;

	constructor(view: EditorView) {
		this.insertRanges = collectInsertRanges(view);
		const { from, to } = view.state.selection.main;
		this.cursorInsertPos = getCursorInsertPos(this.insertRanges, from, to);
		this.decorations = buildDecorations(view);
	}

	update(update: ViewUpdate) {
		const { docChanged, viewportChanged, selectionSet } = update;

		if (docChanged || viewportChanged) {
			this.insertRanges = collectInsertRanges(update.view);
			const { from, to } = update.state.selection.main;
			this.cursorInsertPos = getCursorInsertPos(this.insertRanges, from, to);
			this.decorations = buildDecorations(update.view);
			return;
		}

		if (selectionSet) {
			const { from, to } = update.state.selection.main;
			const newPos = getCursorInsertPos(this.insertRanges, from, to);

			if (newPos !== this.cursorInsertPos) {
				this.cursorInsertPos = newPos;
				this.decorations = buildDecorations(update.view);
			}
		}
	}
}

const insertPlugin = ViewPlugin.fromClass(InsertPlugin, {
	decorations: (v) => v.decorations
});

/**
 * Base theme for insert.
 */
const baseTheme = EditorView.baseTheme({
	'.cm-insert': {
		textDecoration: 'underline',
	}
});
