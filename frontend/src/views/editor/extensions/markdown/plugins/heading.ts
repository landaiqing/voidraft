import { syntaxTree } from '@codemirror/language';
import { EditorState, StateField, Range } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView } from '@codemirror/view';

/**
 * Hidden mark decoration - uses visibility: hidden to hide content
 */
const hiddenMarkDecoration = Decoration.mark({
	class: 'cm-heading-mark-hidden'
});

/**
 * Check if selection overlaps with a range.
 */
function isSelectionInRange(state: EditorState, from: number, to: number): boolean {
	return state.selection.ranges.some(
		(range) => from <= range.to && to >= range.from
	);
	}

	/**
 * Build heading decorations.
 * Hides # marks when cursor is not on the heading line.
 */
function buildHeadingDecorations(state: EditorState): DecorationSet {
	const decorations: Range<Decoration>[] = [];

	syntaxTree(state).iterate({
		enter(node) {
			// Skip if cursor is in this node's range
			if (isSelectionInRange(state, node.from, node.to)) return;

			// Handle ATX headings (# Heading)
			if (node.type.name.startsWith('ATXHeading')) {
				const header = node.node.firstChild;
				if (header && header.type.name === 'HeaderMark') {
					const from = header.from;
					// Include the space after #
					const to = Math.min(header.to + 1, node.to);
					decorations.push(hiddenMarkDecoration.range(from, to));
				}
			}
			// Handle Setext headings (underline style)
			else if (node.type.name.startsWith('SetextHeading')) {
				// Hide the underline marks (=== or ---)
				const cursor = node.node.cursor();
				cursor.iterate((child) => {
					if (child.type.name === 'HeaderMark') {
						decorations.push(
							hiddenMarkDecoration.range(child.from, child.to)
						);
					}
				});
			}
		}
	});

	return Decoration.set(decorations, true);
}

/**
 * Heading StateField - manages # mark visibility.
 */
const headingField = StateField.define<DecorationSet>({
	create(state) {
		return buildHeadingDecorations(state);
	},

	update(deco, tr) {
		if (tr.docChanged || tr.selection) {
			return buildHeadingDecorations(tr.state);
		}
		return deco.map(tr.changes);
	},

	provide: (f) => EditorView.decorations.from(f)
});

/**
 * Theme for hidden heading marks.
 * 
 * Uses fontSize: 0 to hide the # mark without leaving whitespace.
 * This works correctly now because blockLayer uses lineBlockAt()
 * which calculates coordinates based on the entire line, not
 * individual characters, so fontSize: 0 doesn't affect boundaries.
 */
const headingTheme = EditorView.baseTheme({
	'.cm-heading-mark-hidden': {
		fontSize: '0'
	}
});

/**
 * Headings plugin.
 */
export const headings = () => [headingField, headingTheme];
