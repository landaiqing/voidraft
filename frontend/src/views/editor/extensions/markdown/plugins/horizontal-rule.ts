import { Extension, StateField, EditorState, Range } from '@codemirror/state';
import {
	DecorationSet,
	Decoration,
	EditorView,
	WidgetType
} from '@codemirror/view';
import { isCursorInRange } from '../util';
import { syntaxTree } from '@codemirror/language';

/**
 * Horizontal rule plugin that renders beautiful horizontal lines.
 *
 * This plugin:
 * - Replaces markdown horizontal rules (---, ***, ___) with styled <hr> elements
 * - Shows the original text when cursor is on the line
 * - Uses inline widget to avoid affecting block system boundaries
 */
export const horizontalRule = (): Extension => [
	horizontalRuleField,
	baseTheme
];

/**
 * Widget to display a horizontal rule (inline version).
 */
class HorizontalRuleWidget extends WidgetType {
	toDOM(): HTMLElement {
		const span = document.createElement('span');
		span.className = 'cm-horizontal-rule-widget';
		
		const hr = document.createElement('hr');
		hr.className = 'cm-horizontal-rule';
		span.appendChild(hr);
		
		return span;
	}

	eq(_other: HorizontalRuleWidget) {
		return true;
	}

	ignoreEvent(): boolean {
		return false;
	}
}

/**
 * Build horizontal rule decorations.
 * Uses Decoration.replace WITHOUT block: true to avoid affecting block system.
 */
function buildHorizontalRuleDecorations(state: EditorState): DecorationSet {
	const decorations: Range<Decoration>[] = [];

	syntaxTree(state).iterate({
		enter: ({ type, from, to }) => {
			if (type.name !== 'HorizontalRule') return;

			// Skip if cursor is on this line
			if (isCursorInRange(state, [from, to])) return;

			// Replace the entire horizontal rule with a styled widget
			// NOTE: NOT using block: true to avoid affecting codeblock boundaries
			decorations.push(
				Decoration.replace({
					widget: new HorizontalRuleWidget()
				}).range(from, to)
			);
		}
	});

	return Decoration.set(decorations, true);
}

/**
 * StateField for horizontal rule decorations.
 */
const horizontalRuleField = StateField.define<DecorationSet>({
	create(state) {
		return buildHorizontalRuleDecorations(state);
	},
	update(value, tx) {
		if (tx.docChanged || tx.selection) {
			return buildHorizontalRuleDecorations(tx.state);
		}
		return value.map(tx.changes);
	},
	provide(field) {
		return EditorView.decorations.from(field);
	}
});

/**
 * Base theme for horizontal rules.
 * Uses inline-block display to render properly without block: true.
 */
const baseTheme = EditorView.baseTheme({
	'.cm-horizontal-rule-widget': {
		display: 'inline-block',
		width: '100%',
		verticalAlign: 'middle'
	},
	'.cm-horizontal-rule': {
		width: '100%',
		height: '0',
		border: 'none',
		borderTop: '2px solid var(--cm-hr-color, rgba(128, 128, 128, 0.3))',
		margin: '0.5em 0'
	}
});
