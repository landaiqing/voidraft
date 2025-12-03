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

/** Mark decoration for highlighted content */
const highlightMarkDecoration = Decoration.mark({ class: 'cm-highlight' });

/**
 * Highlight plugin using syntax tree.
 *
 * Detects ==text== and renders as highlighted text.
 */
export const highlight = (): Extension => [highlightPlugin, baseTheme];

/**
 * Collect all highlight ranges in visible viewport.
 */
function collectHighlightRanges(view: EditorView): RangeTuple[] {
	const ranges: RangeTuple[] = [];
	const seen = new Set<number>();

	for (const { from, to } of view.visibleRanges) {
		syntaxTree(view.state).iterate({
			from,
			to,
			enter: ({ type, from: nodeFrom, to: nodeTo }) => {
				if (type.name !== 'Highlight') return;
				if (seen.has(nodeFrom)) return;
				seen.add(nodeFrom);
				ranges.push([nodeFrom, nodeTo]);
			}
		});
	}

	return ranges;
}

/**
 * Get which highlight the cursor is in (-1 if none).
 */
function getCursorHighlightPos(ranges: RangeTuple[], selFrom: number, selTo: number): number {
	const selRange: RangeTuple = [selFrom, selTo];
	
	for (const range of ranges) {
		if (checkRangeOverlap(range, selRange)) {
			return range[0];
		}
	}
	return -1;
}

/**
 * Build highlight decorations.
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
				if (type.name !== 'Highlight') return;
				if (seen.has(nodeFrom)) return;
				seen.add(nodeFrom);

				// Skip if cursor is in this highlight
				if (checkRangeOverlap([nodeFrom, nodeTo], selRange)) return;

				const marks = node.getChildren('HighlightMark');
				if (marks.length < 2) return;

				// Hide opening ==
				items.push({ from: marks[0].from, to: marks[0].to, deco: invisibleDecoration });

				// Apply highlight style to content
				const contentStart = marks[0].to;
				const contentEnd = marks[marks.length - 1].from;
				if (contentStart < contentEnd) {
					items.push({ from: contentStart, to: contentEnd, deco: highlightMarkDecoration });
				}

				// Hide closing ==
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
 * Highlight plugin with optimized updates.
 */
class HighlightPlugin {
	decorations: DecorationSet;
	private highlightRanges: RangeTuple[] = [];
	private cursorHighlightPos = -1;

	constructor(view: EditorView) {
		this.highlightRanges = collectHighlightRanges(view);
		const { from, to } = view.state.selection.main;
		this.cursorHighlightPos = getCursorHighlightPos(this.highlightRanges, from, to);
		this.decorations = buildDecorations(view);
	}

	update(update: ViewUpdate) {
		const { docChanged, viewportChanged, selectionSet } = update;

		if (docChanged || viewportChanged) {
			this.highlightRanges = collectHighlightRanges(update.view);
			const { from, to } = update.state.selection.main;
			this.cursorHighlightPos = getCursorHighlightPos(this.highlightRanges, from, to);
			this.decorations = buildDecorations(update.view);
			return;
		}

		if (selectionSet) {
			const { from, to } = update.state.selection.main;
			const newPos = getCursorHighlightPos(this.highlightRanges, from, to);

			if (newPos !== this.cursorHighlightPos) {
				this.cursorHighlightPos = newPos;
				this.decorations = buildDecorations(update.view);
			}
		}
	}
}

const highlightPlugin = ViewPlugin.fromClass(HighlightPlugin, {
	decorations: (v) => v.decorations
});

/**
 * Base theme for highlight.
 */
const baseTheme = EditorView.baseTheme({
	'.cm-highlight': {
		backgroundColor: 'var(--cm-highlight-background, rgba(255, 235, 59, 0.4))',
		borderRadius: '2px',
	}
});
