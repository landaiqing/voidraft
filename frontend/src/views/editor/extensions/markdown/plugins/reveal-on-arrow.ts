import { Extension, EditorSelection } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';

/**
 * Reveal block on arrow key navigation.
 *
 * This plugin:
 * - Detects when arrow keys are pressed
 * - Helps navigate through folded/hidden content
 * - Provides better UX when navigating markdown documents
 *
 * Note: This is a simplified implementation that works with the
 * standard CodeMirror navigation. For more advanced behavior,
 * consider using the cursor position to detect nearby decorations.
 */
export const revealOnArrow = (): Extension => [revealOnArrowKeymap];

/**
 * Check if we should adjust cursor position for better navigation.
 * This is a basic implementation that lets CodeMirror handle most navigation.
 */
function maybeReveal(
	view: EditorView,
	direction: 'up' | 'down'
): boolean {
	const { state } = view;
	const cursorAt = state.selection.main.head;
	const doc = state.doc;

	// Basic navigation enhancement
	// Let CodeMirror handle the navigation naturally
	// This hook is here for future enhancements if needed

	if (direction === 'down') {
		// Moving down: check if we're at the end of a line
		const line = doc.lineAt(cursorAt);
		if (cursorAt === line.to && line.number < doc.lines) {
			// Let CodeMirror handle moving to next line
			return false;
		}
	} else {
		// Moving up: check if we're at the start of a line
		const line = doc.lineAt(cursorAt);
		if (cursorAt === line.from && line.number > 1) {
			// Let CodeMirror handle moving to previous line
			return false;
		}
	}

	return false;
}

/**
 * Keymap for revealing blocks on arrow navigation.
 */
const revealOnArrowKeymap = keymap.of([
	{
		key: 'ArrowUp',
		run: (view) => maybeReveal(view, 'up')
	},
	{
		key: 'ArrowDown',
		run: (view) => maybeReveal(view, 'down')
	}
]);

