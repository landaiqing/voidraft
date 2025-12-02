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
 * Insert plugin using syntax tree.
 *
 * Uses the custom Insert extension to detect:
 * - Insert: ++text++ → renders as inserted text (underline)
 *
 * Examples:
 * - This is ++inserted++ text → This is <ins>inserted</ins> text
 * - Please ++review this section++ carefully
 */
export const insert = (): Extension => [
	insertPlugin,
	baseTheme
];

/**
 * Build decorations for insert using syntax tree.
 */
function buildDecorations(view: EditorView): DecorationSet {
	const decorations: Range<Decoration>[] = [];

	for (const { from, to } of view.visibleRanges) {
		syntaxTree(view.state).iterate({
			from,
			to,
			enter: ({ type, from: nodeFrom, to: nodeTo, node }) => {
				// Handle Insert nodes
				if (type.name === 'Insert') {
					const cursorInRange = isCursorInRange(view.state, [nodeFrom, nodeTo]);

					// Get the mark nodes (the ++ characters)
					const marks = node.getChildren('InsertMark');

					if (!cursorInRange && marks.length >= 2) {
						// Hide the opening and closing ++ marks
						decorations.push(invisibleDecoration.range(marks[0].from, marks[0].to));
						decorations.push(invisibleDecoration.range(marks[marks.length - 1].from, marks[marks.length - 1].to));

						// Apply insert style to the content between marks
						const contentStart = marks[0].to;
						const contentEnd = marks[marks.length - 1].from;
						if (contentStart < contentEnd) {
							decorations.push(
								Decoration.mark({
									class: 'cm-insert'
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
class InsertPlugin {
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

const insertPlugin = ViewPlugin.fromClass(
	InsertPlugin,
	{
		decorations: (v) => v.decorations
	}
);

/**
 * Base theme for insert.
 * Uses underline decoration for inserted text.
 */
const baseTheme = EditorView.baseTheme({
	'.cm-insert': {
		textDecoration: 'underline',
	}
});

