import {
	Decoration,
	DecorationSet,
	EditorView,
	ViewPlugin,
	ViewUpdate
} from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import { checkRangeOverlap, invisibleDecoration, RangeTuple } from '../util';

/** Pre-computed line decoration */
const LINE_DECO = Decoration.line({ class: 'cm-blockquote' });

/**
 * Blockquote plugin.
 *
 * Features:
 * - Decorates blockquote with left border
 * - Hides quote marks (>) when cursor is outside
 * - Supports nested blockquotes
 */
export function blockquote() {
	return [blockQuotePlugin, baseTheme];
}

/**
 * Collect blockquote ranges in visible viewport.
 */
function collectBlockquoteRanges(view: EditorView): RangeTuple[] {
	const ranges: RangeTuple[] = [];
	const seen = new Set<number>();

	for (const { from, to } of view.visibleRanges) {
		syntaxTree(view.state).iterate({
			from,
			to,
			enter(node) {
				if (node.type.name !== 'Blockquote') return;
				if (seen.has(node.from)) return;
				seen.add(node.from);
				ranges.push([node.from, node.to]);
				return false; // Don't recurse into nested
			}
		});
	}

	return ranges;
}

/**
 * Get cursor's blockquote position (-1 if not in any).
 */
function getCursorBlockquotePos(view: EditorView, ranges: RangeTuple[]): number {
	const sel = view.state.selection.main;
	const selRange: RangeTuple = [sel.from, sel.to];
	
	for (const range of ranges) {
		if (checkRangeOverlap(selRange, range)) {
			return range[0];
		}
	}
	return -1;
}

/**
 * Build blockquote decorations for visible viewport.
 */
function buildDecorations(view: EditorView): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();
	const items: { pos: number; endPos?: number; deco: Decoration }[] = [];
	const processedLines = new Set<number>();
	const seen = new Set<number>();

	for (const { from, to } of view.visibleRanges) {
		syntaxTree(view.state).iterate({
			from,
			to,
			enter(node) {
				if (node.type.name !== 'Blockquote') return;
				if (seen.has(node.from)) return;
				seen.add(node.from);

				const inBlock = checkRangeOverlap(
					[node.from, node.to],
					[view.state.selection.main.from, view.state.selection.main.to]
				);
				if (inBlock) return false;

				// Line decorations
				const startLine = view.state.doc.lineAt(node.from).number;
				const endLine = view.state.doc.lineAt(node.to).number;

				for (let i = startLine; i <= endLine; i++) {
					if (!processedLines.has(i)) {
						processedLines.add(i);
						const line = view.state.doc.line(i);
						items.push({ pos: line.from, deco: LINE_DECO });
					}
				}

				// Hide quote marks
				const cursor = node.node.cursor();
				cursor.iterate((child) => {
					if (child.type.name === 'QuoteMark') {
						items.push({ pos: child.from, endPos: child.to, deco: invisibleDecoration });
					}
				});

				return false;
			}
		});
	}

	// Sort and build
	items.sort((a, b) => a.pos - b.pos);
	
	for (const item of items) {
		if (item.endPos !== undefined) {
			builder.add(item.pos, item.endPos, item.deco);
		} else {
			builder.add(item.pos, item.pos, item.deco);
		}
	}

	return builder.finish();
}

/**
 * Blockquote plugin with optimized updates.
 */
class BlockQuotePlugin {
	decorations: DecorationSet;
	private blockRanges: RangeTuple[] = [];
	private cursorBlockPos = -1;

	constructor(view: EditorView) {
		this.blockRanges = collectBlockquoteRanges(view);
		this.cursorBlockPos = getCursorBlockquotePos(view, this.blockRanges);
		this.decorations = buildDecorations(view);
	}

	update(update: ViewUpdate) {
		const { docChanged, viewportChanged, selectionSet } = update;

		if (docChanged || viewportChanged) {
			this.blockRanges = collectBlockquoteRanges(update.view);
			this.cursorBlockPos = getCursorBlockquotePos(update.view, this.blockRanges);
			this.decorations = buildDecorations(update.view);
			return;
		}

		if (selectionSet) {
			const newPos = getCursorBlockquotePos(update.view, this.blockRanges);
			if (newPos !== this.cursorBlockPos) {
				this.cursorBlockPos = newPos;
				this.decorations = buildDecorations(update.view);
			}
		}
	}
}

const blockQuotePlugin = ViewPlugin.fromClass(BlockQuotePlugin, {
	decorations: (v) => v.decorations
});

/**
 * Base theme for blockquotes.
 */
const baseTheme = EditorView.baseTheme({
	'.cm-blockquote': {
		borderLeft: '4px solid var(--cm-blockquote-border, #ccc)',
		color: 'var(--cm-blockquote-color, #666)'
	}
});
