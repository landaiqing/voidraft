import { syntaxTree } from '@codemirror/language';
import { Extension, RangeSetBuilder } from '@codemirror/state';
import {
	Decoration,
	DecorationSet,
	EditorView,
	ViewPlugin,
	ViewUpdate
} from '@codemirror/view';
import { checkRangeOverlap, RangeTuple } from '../util';

/** Hidden mark decoration */
const hiddenMarkDecoration = Decoration.mark({
	class: 'cm-heading-mark-hidden'
});

/**
 * Collect all heading ranges in visible viewport.
 */
function collectHeadingRanges(view: EditorView): RangeTuple[] {
	const ranges: RangeTuple[] = [];
	const seen = new Set<number>();

	for (const { from, to } of view.visibleRanges) {
		syntaxTree(view.state).iterate({
			from,
			to,
			enter(node) {
				if (!node.type.name.startsWith('ATXHeading') && 
					!node.type.name.startsWith('SetextHeading')) {
					return;
				}
				if (seen.has(node.from)) return;
				seen.add(node.from);
				ranges.push([node.from, node.to]);
			}
		});
	}

	return ranges;
}

/**
 * Get which heading the cursor is in (-1 if none).
 */
function getCursorHeadingPos(ranges: RangeTuple[], selFrom: number, selTo: number): number {
	const selRange: RangeTuple = [selFrom, selTo];
	
	for (const range of ranges) {
		if (checkRangeOverlap(range, selRange)) {
			return range[0];
		}
	}
	return -1;
}

/**
 * Build heading decorations using RangeSetBuilder.
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
			enter(node) {
				// Skip if cursor is in this heading
				if (checkRangeOverlap([node.from, node.to], selRange)) return;

				// ATX headings (# Heading)
				if (node.type.name.startsWith('ATXHeading')) {
					if (seen.has(node.from)) return;
					seen.add(node.from);

					const header = node.node.firstChild;
					if (header && header.type.name === 'HeaderMark') {
						const markFrom = header.from;
						// Include the space after #
						const markTo = Math.min(header.to + 1, node.to);
						items.push({ from: markFrom, to: markTo });
					}
				}
				// Setext headings (underline style)
				else if (node.type.name.startsWith('SetextHeading')) {
					if (seen.has(node.from)) return;
					seen.add(node.from);

					const cursor = node.node.cursor();
					cursor.iterate((child) => {
						if (child.type.name === 'HeaderMark') {
							items.push({ from: child.from, to: child.to });
						}
					});
				}
			}
		});
	}

	// Sort by position and add to builder
	items.sort((a, b) => a.from - b.from);
	
	for (const item of items) {
		builder.add(item.from, item.to, hiddenMarkDecoration);
	}

	return builder.finish();
}

/**
 * Heading plugin with optimized updates.
 */
class HeadingPlugin {
	decorations: DecorationSet;
	private headingRanges: RangeTuple[] = [];
	private cursorHeadingPos = -1;

	constructor(view: EditorView) {
		this.headingRanges = collectHeadingRanges(view);
		const { from, to } = view.state.selection.main;
		this.cursorHeadingPos = getCursorHeadingPos(this.headingRanges, from, to);
		this.decorations = buildDecorations(view);
	}

	update(update: ViewUpdate) {
		const { docChanged, viewportChanged, selectionSet } = update;

		if (docChanged || viewportChanged) {
			this.headingRanges = collectHeadingRanges(update.view);
			const { from, to } = update.state.selection.main;
			this.cursorHeadingPos = getCursorHeadingPos(this.headingRanges, from, to);
			this.decorations = buildDecorations(update.view);
			return;
		}

		if (selectionSet) {
			const { from, to } = update.state.selection.main;
			const newPos = getCursorHeadingPos(this.headingRanges, from, to);

			if (newPos !== this.cursorHeadingPos) {
				this.cursorHeadingPos = newPos;
				this.decorations = buildDecorations(update.view);
			}
		}
	}
}

const headingPlugin = ViewPlugin.fromClass(HeadingPlugin, {
	decorations: (v) => v.decorations
});

/**
 * Theme for hidden heading marks.
 */
const headingTheme = EditorView.baseTheme({
	'.cm-heading-mark-hidden': {
		fontSize: '0'
	}
});

/**
 * Headings plugin.
 */
export const headings = (): Extension => [headingPlugin, headingTheme];
