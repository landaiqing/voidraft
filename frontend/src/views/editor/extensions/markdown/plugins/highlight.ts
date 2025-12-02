import { Extension, Range } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import {
	ViewPlugin,
	DecorationSet,
	Decoration,
	EditorView,
	ViewUpdate
} from '@codemirror/view';
import { isCursorInRange, invisibleDecoration } from '../util';

/**
 * Highlight plugin using syntax tree.
 *
 * Uses the custom Highlight extension to detect:
 * - Highlight: ==text== → renders as highlighted text
 *
 * Examples:
 * - This is ==important== text → This is <mark>important</mark> text
 * - Please ==review this section== carefully
 */
export const highlight = (): Extension => [
	highlightPlugin,
	baseTheme
];

/**
 * Build decorations for highlight using syntax tree.
 */
function buildDecorations(view: EditorView): DecorationSet {
	const decorations: Range<Decoration>[] = [];

	for (const { from, to } of view.visibleRanges) {
		syntaxTree(view.state).iterate({
			from,
			to,
			enter: ({ type, from: nodeFrom, to: nodeTo, node }) => {
				// Handle Highlight nodes
				if (type.name === 'Highlight') {
					const cursorInRange = isCursorInRange(view.state, [nodeFrom, nodeTo]);

					// Get the mark nodes (the == characters)
					const marks = node.getChildren('HighlightMark');

					if (!cursorInRange && marks.length >= 2) {
						// Hide the opening and closing == marks
						decorations.push(invisibleDecoration.range(marks[0].from, marks[0].to));
						decorations.push(invisibleDecoration.range(marks[marks.length - 1].from, marks[marks.length - 1].to));

						// Apply highlight style to the content between marks
						const contentStart = marks[0].to;
						const contentEnd = marks[marks.length - 1].from;
						if (contentStart < contentEnd) {
							decorations.push(
								Decoration.mark({
									class: 'cm-highlight'
								}).range(contentStart, contentEnd)
							);
						}
					}
				}
			}
		});
	}

	return Decoration.set(decorations, true);
}

/**
 * Plugin class with optimized update detection.
 */
class HighlightPlugin {
	decorations: DecorationSet;
	private lastSelectionHead: number = -1;

	constructor(view: EditorView) {
		this.decorations = buildDecorations(view);
		this.lastSelectionHead = view.state.selection.main.head;
	}

	update(update: ViewUpdate) {
		if (update.docChanged || update.viewportChanged) {
			this.decorations = buildDecorations(update.view);
			this.lastSelectionHead = update.state.selection.main.head;
			return;
		}

		if (update.selectionSet) {
			const newHead = update.state.selection.main.head;
			if (newHead !== this.lastSelectionHead) {
				this.decorations = buildDecorations(update.view);
				this.lastSelectionHead = newHead;
			}
		}
	}
}

const highlightPlugin = ViewPlugin.fromClass(
	HighlightPlugin,
	{
		decorations: (v) => v.decorations
	}
);

/**
 * Base theme for highlight.
 * Uses mark decoration with a subtle background color.
 */
const baseTheme = EditorView.baseTheme({
	'.cm-highlight': {
		backgroundColor: 'var(--cm-highlight-background, rgba(255, 235, 59, 0.4))',
		borderRadius: '2px',
	}
});

