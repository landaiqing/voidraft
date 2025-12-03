import { Extension, RangeSetBuilder } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import {
	ViewPlugin,
	DecorationSet,
	Decoration,
	EditorView,
	ViewUpdate
} from '@codemirror/view';
import { checkRangeOverlap, invisibleDecoration, RangeTuple } from '../util';

/** Pre-computed mark decorations */
const superscriptMarkDecoration = Decoration.mark({ class: 'cm-superscript' });
const subscriptMarkDecoration = Decoration.mark({ class: 'cm-subscript' });

/**
 * Subscript and Superscript plugin using syntax tree.
 *
 * - Superscript: ^text^ → renders as superscript
 * - Subscript: ~text~ → renders as subscript
 *
 * Note: Inline footnotes ^[content] are handled by the Footnote extension.
 */
export const subscriptSuperscript = (): Extension => [
	subscriptSuperscriptPlugin,
	baseTheme
];

/** Node types to handle */
const SCRIPT_TYPES = new Set(['Superscript', 'Subscript']);

/**
 * Collect all superscript/subscript ranges in visible viewport.
 */
function collectScriptRanges(view: EditorView): RangeTuple[] {
	const ranges: RangeTuple[] = [];
	const seen = new Set<number>();

	for (const { from, to } of view.visibleRanges) {
		syntaxTree(view.state).iterate({
			from,
			to,
			enter: ({ type, from: nodeFrom, to: nodeTo }) => {
				if (!SCRIPT_TYPES.has(type.name)) return;
				if (seen.has(nodeFrom)) return;
				seen.add(nodeFrom);
				ranges.push([nodeFrom, nodeTo]);
			}
		});
	}

	return ranges;
}

/**
 * Get which script element the cursor is in (-1 if none).
 */
function getCursorScriptPos(ranges: RangeTuple[], selFrom: number, selTo: number): number {
	const selRange: RangeTuple = [selFrom, selTo];
	
	for (const range of ranges) {
		if (checkRangeOverlap(range, selRange)) {
			return range[0];
		}
	}
	return -1;
}

/**
 * Build decorations for subscript and superscript.
 */
function buildDecorations(view: EditorView): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();
	const items: { from: number; to: number; deco: Decoration }[] = [];
	const { from: selFrom, to: selTo } = view.state.selection.main;
	const selRange: RangeTuple = [selFrom, selTo];
	const seen = new Set<number>();

	for (const { from, to } of view.visibleRanges) {
		syntaxTree(view.state).iterate({
			from,
			to,
			enter: ({ type, from: nodeFrom, to: nodeTo, node }) => {
				if (!SCRIPT_TYPES.has(type.name)) return;
				if (seen.has(nodeFrom)) return;
				seen.add(nodeFrom);

				// Skip if cursor is in this element
				if (checkRangeOverlap([nodeFrom, nodeTo], selRange)) return;

				const isSuperscript = type.name === 'Superscript';
				const markName = isSuperscript ? 'SuperscriptMark' : 'SubscriptMark';
				const contentDeco = isSuperscript ? superscriptMarkDecoration : subscriptMarkDecoration;

				const marks = node.getChildren(markName);
				if (marks.length < 2) return;

				// Hide opening mark
				items.push({ from: marks[0].from, to: marks[0].to, deco: invisibleDecoration });

				// Apply style to content
				const contentStart = marks[0].to;
				const contentEnd = marks[marks.length - 1].from;
				if (contentStart < contentEnd) {
					items.push({ from: contentStart, to: contentEnd, deco: contentDeco });
				}

				// Hide closing mark
				items.push({ from: marks[marks.length - 1].from, to: marks[marks.length - 1].to, deco: invisibleDecoration });
			}
		});
	}

	// Sort and add to builder
	items.sort((a, b) => a.from - b.from);
	
	for (const item of items) {
		builder.add(item.from, item.to, item.deco);
	}

	return builder.finish();
}

/**
 * Subscript/Superscript plugin with optimized updates.
 */
class SubscriptSuperscriptPlugin {
	decorations: DecorationSet;
	private scriptRanges: RangeTuple[] = [];
	private cursorScriptPos = -1;

	constructor(view: EditorView) {
		this.scriptRanges = collectScriptRanges(view);
		const { from, to } = view.state.selection.main;
		this.cursorScriptPos = getCursorScriptPos(this.scriptRanges, from, to);
		this.decorations = buildDecorations(view);
	}

	update(update: ViewUpdate) {
		const { docChanged, viewportChanged, selectionSet } = update;

		if (docChanged || viewportChanged) {
			this.scriptRanges = collectScriptRanges(update.view);
			const { from, to } = update.state.selection.main;
			this.cursorScriptPos = getCursorScriptPos(this.scriptRanges, from, to);
			this.decorations = buildDecorations(update.view);
			return;
		}

		if (selectionSet) {
			const { from, to } = update.state.selection.main;
			const newPos = getCursorScriptPos(this.scriptRanges, from, to);

			if (newPos !== this.cursorScriptPos) {
				this.cursorScriptPos = newPos;
				this.decorations = buildDecorations(update.view);
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
 */
const baseTheme = EditorView.baseTheme({
	'.cm-superscript': {
		verticalAlign: 'super',
		fontSize: '0.75em',
		color: 'var(--cm-superscript-color, inherit)'
	},
	'.cm-subscript': {
		verticalAlign: 'sub',
		fontSize: '0.75em',
		color: 'var(--cm-subscript-color, inherit)'
	}
});

