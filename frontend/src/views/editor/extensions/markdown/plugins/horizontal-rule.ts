import { Extension, RangeSetBuilder } from '@codemirror/state';
import {
	DecorationSet,
	Decoration,
	EditorView,
	ViewPlugin,
	ViewUpdate,
	WidgetType
} from '@codemirror/view';
import { checkRangeOverlap, RangeTuple } from '../util';
import { syntaxTree } from '@codemirror/language';

/**
 * Horizontal rule plugin that renders beautiful horizontal lines.
 *
 * Features:
 * - Replaces markdown horizontal rules (---, ***, ___) with styled <hr> elements
 * - Shows the original text when cursor is on the line
 * - Uses inline widget to avoid affecting block system boundaries
 */
export const horizontalRule = (): Extension => [horizontalRulePlugin, baseTheme];

/**
 * Widget to display a horizontal rule.
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

/** Shared widget instance (all HR widgets are identical) */
const hrWidget = new HorizontalRuleWidget();

/**
 * Collect all horizontal rule ranges in visible viewport.
 */
function collectHRRanges(view: EditorView): RangeTuple[] {
	const ranges: RangeTuple[] = [];
	const seen = new Set<number>();

	for (const { from, to } of view.visibleRanges) {
		syntaxTree(view.state).iterate({
			from,
			to,
			enter: ({ type, from: nodeFrom, to: nodeTo }) => {
				if (type.name !== 'HorizontalRule') return;
				if (seen.has(nodeFrom)) return;
				seen.add(nodeFrom);
				ranges.push([nodeFrom, nodeTo]);
			}
		});
	}

	return ranges;
}

/**
 * Get which HR the cursor is in (-1 if none).
 */
function getCursorHRPos(ranges: RangeTuple[], selFrom: number, selTo: number): number {
	const selRange: RangeTuple = [selFrom, selTo];
	
	for (const range of ranges) {
		if (checkRangeOverlap(range, selRange)) {
			return range[0];
		}
	}
	return -1;
}

/**
 * Build horizontal rule decorations.
 */
function buildDecorations(view: EditorView): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();
	const items: { from: number; to: number }[] = [];
	const { from: selFrom, to: selTo } = view.state.selection.main;
	const selRange: RangeTuple = [selFrom, selTo];
	const seen = new Set<number>();

	for (const { from, to } of view.visibleRanges) {
		syntaxTree(view.state).iterate({
			from,
			to,
			enter: ({ type, from: nodeFrom, to: nodeTo }) => {
				if (type.name !== 'HorizontalRule') return;
				if (seen.has(nodeFrom)) return;
				seen.add(nodeFrom);

				// Skip if cursor is on this HR
				if (checkRangeOverlap([nodeFrom, nodeTo], selRange)) return;

				items.push({ from: nodeFrom, to: nodeTo });
			}
		});
	}

	// Sort and add to builder
	items.sort((a, b) => a.from - b.from);
	
	for (const item of items) {
		builder.add(item.from, item.to, Decoration.replace({ widget: hrWidget }));
	}

	return builder.finish();
}

/**
 * Horizontal rule plugin with optimized updates.
 */
class HorizontalRulePlugin {
	decorations: DecorationSet;
	private hrRanges: RangeTuple[] = [];
	private cursorHRPos = -1;

	constructor(view: EditorView) {
		this.hrRanges = collectHRRanges(view);
		const { from, to } = view.state.selection.main;
		this.cursorHRPos = getCursorHRPos(this.hrRanges, from, to);
		this.decorations = buildDecorations(view);
	}

	update(update: ViewUpdate) {
		const { docChanged, viewportChanged, selectionSet } = update;

		if (docChanged || viewportChanged) {
			this.hrRanges = collectHRRanges(update.view);
			const { from, to } = update.state.selection.main;
			this.cursorHRPos = getCursorHRPos(this.hrRanges, from, to);
			this.decorations = buildDecorations(update.view);
			return;
		}

		if (selectionSet) {
			const { from, to } = update.state.selection.main;
			const newPos = getCursorHRPos(this.hrRanges, from, to);

			if (newPos !== this.cursorHRPos) {
				this.cursorHRPos = newPos;
				this.decorations = buildDecorations(update.view);
			}
		}
	}
}

const horizontalRulePlugin = ViewPlugin.fromClass(HorizontalRulePlugin, {
	decorations: (v) => v.decorations
});

/**
 * Base theme for horizontal rules.
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
