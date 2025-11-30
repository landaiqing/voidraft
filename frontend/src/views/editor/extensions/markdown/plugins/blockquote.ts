import {
	Decoration,
	DecorationSet,
	EditorView,
	ViewPlugin,
	ViewUpdate
} from '@codemirror/view';
import { Range } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import { isCursorInRange, invisibleDecoration } from '../util';
import { blockquote as classes } from '../classes';

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
 * Build blockquote decorations.
 */
function buildBlockQuoteDecorations(view: EditorView): DecorationSet {
	const decorations: Range<Decoration>[] = [];
	const processedLines = new Set<number>();

	syntaxTree(view.state).iterate({
		enter(node) {
			if (node.type.name !== 'Blockquote') return;

			const cursorInBlockquote = isCursorInRange(view.state, [node.from, node.to]);

			// Only add decorations when cursor is outside the blockquote
			// This allows selection highlighting to be visible when editing
			if (!cursorInBlockquote) {
				// Add line decoration for each line in the blockquote
				const startLine = view.state.doc.lineAt(node.from).number;
				const endLine = view.state.doc.lineAt(node.to).number;

				for (let i = startLine; i <= endLine; i++) {
					if (!processedLines.has(i)) {
						processedLines.add(i);
						const line = view.state.doc.line(i);
						decorations.push(
							Decoration.line({ class: classes.widget }).range(line.from)
						);
					}
				}

				// Hide quote marks when cursor is outside
				const cursor = node.node.cursor();
				cursor.iterate((child) => {
					if (child.type.name === 'QuoteMark') {
						decorations.push(
							invisibleDecoration.range(child.from, child.to)
						);
					}
				});
			}

			// Don't recurse into nested blockquotes (handled by outer iteration)
			return false;
		}
	});

	return Decoration.set(decorations, true);
}

/**
 * Blockquote plugin class.
 */
class BlockQuotePlugin {
	decorations: DecorationSet;

	constructor(view: EditorView) {
		this.decorations = buildBlockQuoteDecorations(view);
	}

	update(update: ViewUpdate) {
		if (update.docChanged || update.viewportChanged || update.selectionSet) {
			this.decorations = buildBlockQuoteDecorations(update.view);
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
	[`.${classes.widget}`]: {
		borderLeft: '4px solid var(--cm-blockquote-border, #ccc)',
		color: 'var(--cm-blockquote-color, #666)'
	}
});
