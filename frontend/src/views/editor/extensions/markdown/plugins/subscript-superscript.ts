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
 * Subscript and Superscript plugin using syntax tree.
 *
 * Uses lezer-markdown's Subscript and Superscript extensions to detect:
 * - Superscript: ^text^ → renders as superscript
 * - Subscript: ~text~ → renders as subscript
 *
 * Examples:
 * - 19^th^ → 19ᵗʰ (superscript)
 * - H~2~O → H₂O (subscript)
 */
export const subscriptSuperscript = (): Extension => [
	subscriptSuperscriptPlugin,
	baseTheme
];

/**
 * Build decorations for subscript and superscript using syntax tree.
 */
function buildDecorations(view: EditorView): DecorationSet {
	const decorations: Range<Decoration>[] = [];

	for (const { from, to } of view.visibleRanges) {
		syntaxTree(view.state).iterate({
			from,
			to,
			enter: ({ type, from: nodeFrom, to: nodeTo, node }) => {
				// Handle Superscript nodes
				if (type.name === 'Superscript') {
					// Get the full content including marks
					const fullContent = view.state.doc.sliceString(nodeFrom, nodeTo);
					
					// Skip if this contains inline footnote pattern ^[
					// This catches ^[text] being misinterpreted as superscript
					if (fullContent.includes('^[') || fullContent.includes('[') && fullContent.includes(']')) {
						return;
					}

					const cursorInRange = isCursorInRange(view.state, [nodeFrom, nodeTo]);

					// Get the mark nodes (the ^ characters)
					const marks = node.getChildren('SuperscriptMark');

					if (!cursorInRange && marks.length >= 2) {
						// Get inner content between marks
						const innerContent = view.state.doc.sliceString(marks[0].to, marks[marks.length - 1].from);
						
						// Skip if inner content looks like footnote (starts with [ or contains brackets)
						if (innerContent.startsWith('[') || innerContent.includes('[') || innerContent.includes(']')) {
							return;
						}

						// Hide the opening and closing ^ marks
						decorations.push(invisibleDecoration.range(marks[0].from, marks[0].to));
						decorations.push(invisibleDecoration.range(marks[marks.length - 1].from, marks[marks.length - 1].to));

						// Apply superscript style to the content between marks
						const contentStart = marks[0].to;
						const contentEnd = marks[marks.length - 1].from;
						if (contentStart < contentEnd) {
							decorations.push(
								Decoration.mark({
									class: 'cm-superscript'
								}).range(contentStart, contentEnd)
							);
						}
					}
				}

				// Handle Subscript nodes
				if (type.name === 'Subscript') {
					const cursorInRange = isCursorInRange(view.state, [nodeFrom, nodeTo]);

					// Get the mark nodes (the ~ characters)
					const marks = node.getChildren('SubscriptMark');

					if (!cursorInRange && marks.length >= 2) {
						// Hide the opening and closing ~ marks
						decorations.push(invisibleDecoration.range(marks[0].from, marks[0].to));
						decorations.push(invisibleDecoration.range(marks[marks.length - 1].from, marks[marks.length - 1].to));

						// Apply subscript style to the content between marks
						const contentStart = marks[0].to;
						const contentEnd = marks[marks.length - 1].from;
						if (contentStart < contentEnd) {
							decorations.push(
								Decoration.mark({
									class: 'cm-subscript'
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
class SubscriptSuperscriptPlugin {
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

const subscriptSuperscriptPlugin = ViewPlugin.fromClass(
	SubscriptSuperscriptPlugin,
	{
		decorations: (v) => v.decorations
	}
);

/**
 * Base theme for subscript and superscript.
 * Uses mark decoration instead of widget to avoid layout issues.
 */
const baseTheme = EditorView.baseTheme({
	'.cm-superscript': {
		verticalAlign: 'super',
		fontSize: '0.8em',
		color: 'var(--cm-superscript-color, inherit)'
	},
	'.cm-subscript': {
		verticalAlign: 'sub',
		fontSize: '0.8em',
		color: 'var(--cm-subscript-color, inherit)'
	}
});
