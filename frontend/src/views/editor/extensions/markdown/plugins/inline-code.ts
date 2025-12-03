import { Extension, RangeSetBuilder } from '@codemirror/state';
import {
	Decoration,
	DecorationSet,
	EditorView,
	ViewPlugin,
	ViewUpdate
} from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { checkRangeOverlap, invisibleDecoration, RangeTuple } from '../util';

/** Mark decoration for code content */
const codeMarkDecoration = Decoration.mark({ class: 'cm-inline-code' });

/**
 * Inline code styling plugin.
 *
 * Features:
 * - Adds background color, border radius, padding to code content
 * - Hides backtick markers when cursor is outside
 */
export const inlineCode = (): Extension => [inlineCodePlugin, baseTheme];

/**
 * Collect all inline code ranges in visible viewport.
 */
function collectCodeRanges(view: EditorView): RangeTuple[] {
	const ranges: RangeTuple[] = [];
	const seen = new Set<number>();

	for (const { from, to } of view.visibleRanges) {
		syntaxTree(view.state).iterate({
			from,
			to,
			enter: ({ type, from: nodeFrom, to: nodeTo }) => {
				if (type.name !== 'InlineCode') return;
				if (seen.has(nodeFrom)) return;
				seen.add(nodeFrom);
				ranges.push([nodeFrom, nodeTo]);
			}
		});
	}

	return ranges;
}

/**
 * Get which inline code the cursor is in (-1 if none).
 */
function getCursorCodePos(ranges: RangeTuple[], selFrom: number, selTo: number): number {
	const selRange: RangeTuple = [selFrom, selTo];
	
	for (const range of ranges) {
		if (checkRangeOverlap(range, selRange)) {
			return range[0];
		}
	}
	return -1;
}

/**
 * Build inline code decorations.
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
			enter: ({ type, from: nodeFrom, to: nodeTo }) => {
				if (type.name !== 'InlineCode') return;
				if (seen.has(nodeFrom)) return;
				seen.add(nodeFrom);

				// Skip when cursor is in this code
				if (checkRangeOverlap([nodeFrom, nodeTo], selRange)) return;

				const text = view.state.doc.sliceString(nodeFrom, nodeTo);
				
				// Find backtick boundaries
				let codeStart = nodeFrom;
				let codeEnd = nodeTo;
				
				// Count opening backticks
				let i = 0;
				while (i < text.length && text[i] === '`') {
					i++;
				}
				codeStart = nodeFrom + i;
				
				// Count closing backticks
				let j = text.length - 1;
				while (j >= 0 && text[j] === '`') {
					j--;
				}
				codeEnd = nodeFrom + j + 1;

				// Hide opening backticks
				if (nodeFrom < codeStart) {
					items.push({ from: nodeFrom, to: codeStart, deco: invisibleDecoration });
				}

				// Add style to code content
				if (codeStart < codeEnd) {
					items.push({ from: codeStart, to: codeEnd, deco: codeMarkDecoration });
				}

				// Hide closing backticks
				if (codeEnd < nodeTo) {
					items.push({ from: codeEnd, to: nodeTo, deco: invisibleDecoration });
				}
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
 * Inline code plugin with optimized updates.
 */
class InlineCodePlugin {
	decorations: DecorationSet;
	private codeRanges: RangeTuple[] = [];
	private cursorCodePos = -1;

	constructor(view: EditorView) {
		this.codeRanges = collectCodeRanges(view);
		const { from, to } = view.state.selection.main;
		this.cursorCodePos = getCursorCodePos(this.codeRanges, from, to);
		this.decorations = buildDecorations(view);
	}

	update(update: ViewUpdate) {
		const { docChanged, viewportChanged, selectionSet } = update;

		if (docChanged || viewportChanged) {
			this.codeRanges = collectCodeRanges(update.view);
			const { from, to } = update.state.selection.main;
			this.cursorCodePos = getCursorCodePos(this.codeRanges, from, to);
			this.decorations = buildDecorations(update.view);
			return;
		}

		if (selectionSet) {
			const { from, to } = update.state.selection.main;
			const newPos = getCursorCodePos(this.codeRanges, from, to);

			if (newPos !== this.cursorCodePos) {
				this.cursorCodePos = newPos;
				this.decorations = buildDecorations(update.view);
			}
		}
	}
}

const inlineCodePlugin = ViewPlugin.fromClass(InlineCodePlugin, {
	decorations: (v) => v.decorations
});

/**
 * Base theme for inline code.
 */
const baseTheme = EditorView.baseTheme({
	'.cm-inline-code': {
		backgroundColor: 'var(--cm-inline-code-bg)',
		borderRadius: '0.25rem',
		padding: '0.1rem 0.3rem',
		fontFamily: 'var(--voidraft-font-mono)'
	}
});
