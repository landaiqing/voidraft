import {
	Decoration,
	DecorationSet,
	EditorView,
	ViewPlugin,
	ViewUpdate
} from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import { checkRangeOverlap, isCursorInRange } from '../util';

/**
 * Node types that contain markers as child elements.
 */
const TYPES_WITH_MARKS = new Set([
	'Emphasis',
	'StrongEmphasis',
	'InlineCode',
	'Strikethrough'
]);

/**
 * Node types that are markers themselves.
 */
const MARK_TYPES = new Set([
	'EmphasisMark',
	'CodeMark',
	'StrikethroughMark'
]);

// Export for external use
export const typesWithMarks = Array.from(TYPES_WITH_MARKS);
export const markTypes = Array.from(MARK_TYPES);

/**
 * Build mark hiding decorations using RangeSetBuilder for optimal performance.
 */
function buildHideMarkDecorations(view: EditorView): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();
	const replaceDecoration = Decoration.replace({});

	// Track processed ranges to avoid duplicate processing of nested marks
	let currentParentRange: [number, number] | null = null;

	for (const { from, to } of view.visibleRanges) {
		syntaxTree(view.state).iterate({
			from,
			to,
			enter: ({ type, from: nodeFrom, to: nodeTo, node }) => {
				if (!TYPES_WITH_MARKS.has(type.name)) return;

				// Skip if this is a nested element within a parent we're already processing
				if (currentParentRange && checkRangeOverlap([nodeFrom, nodeTo], currentParentRange)) {
					return;
				}

				// Update current parent range
				currentParentRange = [nodeFrom, nodeTo];

				// Skip if cursor is in this range
				if (isCursorInRange(view.state, [nodeFrom, nodeTo])) return;

				// Iterate through child marks
				const innerTree = node.toTree();
				innerTree.iterate({
					enter({ type: markType, from: markFrom, to: markTo }) {
						if (!MARK_TYPES.has(markType.name)) return;

						// Add decoration to hide the mark
						builder.add(
							nodeFrom + markFrom,
							nodeFrom + markTo,
							replaceDecoration
						);
					}
				});
			}
		});
	}

	return builder.finish();
}

/**
 * Hide marks plugin with optimized update detection.
 *
 * This plugin:
 * - Hides emphasis marks (*, **, ~~ etc.) when cursor is outside
 * - Uses RangeSetBuilder for efficient decoration construction
 * - Optimizes selection change detection
 */
class HideMarkPlugin {
	decorations: DecorationSet;
	private lastSelectionRanges: string = '';

	constructor(view: EditorView) {
		this.decorations = buildHideMarkDecorations(view);
		this.lastSelectionRanges = this.serializeSelection(view);
	}

	update(update: ViewUpdate) {
		// Always rebuild on doc or viewport change
		if (update.docChanged || update.viewportChanged) {
			this.decorations = buildHideMarkDecorations(update.view);
			this.lastSelectionRanges = this.serializeSelection(update.view);
			return;
		}

		// For selection changes, check if selection actually changed positions
		if (update.selectionSet) {
			const newRanges = this.serializeSelection(update.view);
			if (newRanges !== this.lastSelectionRanges) {
				this.decorations = buildHideMarkDecorations(update.view);
				this.lastSelectionRanges = newRanges;
			}
		}
	}

	/**
	 * Serialize selection ranges for comparison.
	 */
	private serializeSelection(view: EditorView): string {
		return view.state.selection.ranges
			.map(r => `${r.from}:${r.to}`)
			.join(',');
	}
}

/**
 * Hide marks plugin.
 *
 * This plugin:
 * - Hides marks when they are not in the editor selection
 * - Supports emphasis, strong, inline code, and strikethrough
 */
export const hideMarks = () => [
	ViewPlugin.fromClass(HideMarkPlugin, {
		decorations: (v) => v.decorations
	})
];
