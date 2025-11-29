import { Extension, Range } from '@codemirror/state';
import {
	Decoration,
	DecorationSet,
	EditorView,
	ViewPlugin,
	ViewUpdate
} from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { isCursorInRange } from '../util';

/**
 * Inline code styling plugin.
 *
 * This plugin adds visual styling to inline code (`code`):
 * - Background color
 * - Border radius
 * - Padding effect via marks
 */
export const inlineCode = (): Extension => [inlineCodePlugin, baseTheme];

/**
 * Build inline code decorations.
 */
function buildInlineCodeDecorations(view: EditorView): DecorationSet {
	const decorations: Range<Decoration>[] = [];

	for (const { from, to } of view.visibleRanges) {
		syntaxTree(view.state).iterate({
			from,
			to,
			enter: ({ type, from: nodeFrom, to: nodeTo }) => {
				if (type.name !== 'InlineCode') return;

				// Get the actual code content (excluding backticks)
				const text = view.state.doc.sliceString(nodeFrom, nodeTo);
				
				// Find backtick positions
				let codeStart = nodeFrom;
				let codeEnd = nodeTo;
				
				// Skip opening backticks
				let i = 0;
				while (i < text.length && text[i] === '`') {
					codeStart++;
					i++;
				}
				
				// Skip closing backticks
				let j = text.length - 1;
				while (j >= 0 && text[j] === '`') {
					codeEnd--;
					j--;
				}

				// Only add decoration if there's actual content
				if (codeStart < codeEnd) {
					const cursorInCode = isCursorInRange(view.state, [nodeFrom, nodeTo]);
					
					// Add mark decoration for the code content
					decorations.push(
						Decoration.mark({
							class: cursorInCode ? 'cm-inline-code cm-inline-code-active' : 'cm-inline-code'
						}).range(codeStart, codeEnd)
					);
				}
			}
		});
	}

	return Decoration.set(decorations, true);
}

/**
 * Inline code plugin class.
 */
class InlineCodePlugin {
	decorations: DecorationSet;

	constructor(view: EditorView) {
		this.decorations = buildInlineCodeDecorations(view);
	}

	update(update: ViewUpdate) {
		if (update.docChanged || update.viewportChanged || update.selectionSet) {
			this.decorations = buildInlineCodeDecorations(update.view);
		}
	}
}

const inlineCodePlugin = ViewPlugin.fromClass(InlineCodePlugin, {
	decorations: (v) => v.decorations
});

/**
 * Base theme for inline code.
 * Uses CSS variables from variables.css for consistent theming.
 */
const baseTheme = EditorView.baseTheme({
	'.cm-inline-code': {
		backgroundColor: 'var(--cm-inline-code-bg)',
		borderRadius: '0.25rem',
		padding: '0.1rem 0.3rem',
		fontFamily: 'var(--voidraft-font-mono)',
		fontSize: '0.9em'
	},
	'.cm-inline-code-active': {
		// Slightly different style when cursor is inside
		backgroundColor: 'var(--cm-inline-code-bg)'
	}
});

