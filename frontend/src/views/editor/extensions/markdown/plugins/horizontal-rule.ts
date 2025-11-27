import { Extension, StateField, EditorState } from '@codemirror/state';
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
 */
export const horizontalRule = (): Extension => [
	horizontalRuleField,
	baseTheme
];

/**
 * Widget to display a horizontal rule.
 */
class HorizontalRuleWidget extends WidgetType {
	toDOM(): HTMLElement {
		const container = document.createElement('div');
		container.className = 'cm-horizontal-rule-container';
		const hr = document.createElement('hr');
		hr.className = 'cm-horizontal-rule';
		container.appendChild(hr);
		return container;
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
 */
function buildHorizontalRuleDecorations(state: EditorState): DecorationSet {
	const widgets: Array<ReturnType<Decoration['range']>> = [];

	syntaxTree(state).iterate({
		enter: ({ type, from, to }) => {
			if (type.name !== 'HorizontalRule') return;

			// Skip if cursor is on this line
			if (isCursorInRange(state, [from, to])) return;

			// Replace the entire horizontal rule with a styled widget
			const widget = Decoration.replace({
				widget: new HorizontalRuleWidget(),
				block: true
			});
			widgets.push(widget.range(from, to));
		}
	});

	return Decoration.set(widgets, true);
}

/**
 * StateField for horizontal rule decorations (must use StateField for block decorations).
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
 */
const baseTheme = EditorView.baseTheme({
	'.cm-horizontal-rule-container': {
		display: 'flex',
		alignItems: 'center',
		padding: '0.5rem 0',
		margin: '0.5rem 0',
		userSelect: 'none'
	},
	'.cm-horizontal-rule': {
		width: '100%',
		height: '1px',
		border: 'none',
		borderTop: '2px solid var(--cm-hr-color, rgba(128, 128, 128, 0.3))',
		margin: '0'
	}
});

