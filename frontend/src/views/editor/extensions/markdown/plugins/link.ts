import { syntaxTree } from '@codemirror/language';
import { Range } from '@codemirror/state';
import {
	Decoration,
	DecorationSet,
	EditorView,
	ViewPlugin,
	ViewUpdate
} from '@codemirror/view';
import { checkRangeOverlap, isCursorInRange, invisibleDecoration } from '../util';

/**
 * Pattern for auto-link markers (< and >).
 */
const AUTO_LINK_MARK_RE = /^<|>$/g;

/**
 * Parent node types that should not process.
 */
const BLACKLISTED_PARENTS = new Set(['Image']);

/**
 * Links plugin.
 *
 * Features:
 * - Hides link markup when cursor is outside
 * - Link icons and click events are handled by hyperlink extension
 */
export const links = () => [goToLinkPlugin];

/**
 * Build link decorations.
 * Only hides markdown syntax marks, no icons added.
 * Uses array + Decoration.set() for automatic sorting.
 */
function buildLinkDecorations(view: EditorView): DecorationSet {
	const decorations: Range<Decoration>[] = [];
	const selectionRanges = view.state.selection.ranges;

	for (const { from, to } of view.visibleRanges) {
		syntaxTree(view.state).iterate({
			from,
			to,
			enter: ({ type, from: nodeFrom, to: nodeTo, node }) => {
				if (type.name !== 'URL') return;

				const parent = node.parent;
				if (!parent || BLACKLISTED_PARENTS.has(parent.name)) return;

				const marks = parent.getChildren('LinkMark');
				const linkTitle = parent.getChild('LinkTitle');

				// Check if cursor overlaps with the link
				const cursorOverlaps = selectionRanges.some((range) =>
					checkRangeOverlap([range.from, range.to], [parent.from, parent.to])
				);

				// Hide link marks and URL when cursor is outside
				if (!cursorOverlaps && marks.length > 0) {
					for (const mark of marks) {
						decorations.push(invisibleDecoration.range(mark.from, mark.to));
					}
					decorations.push(invisibleDecoration.range(nodeFrom, nodeTo));

					if (linkTitle) {
						decorations.push(invisibleDecoration.range(linkTitle.from, linkTitle.to));
					}
				}

				// Get link content
				const linkContent = view.state.sliceDoc(nodeFrom, nodeTo);

				// Handle auto-links with < > markers
				if (AUTO_LINK_MARK_RE.test(linkContent)) {
					if (!isCursorInRange(view.state, [node.from, node.to])) {
						decorations.push(invisibleDecoration.range(nodeFrom, nodeFrom + 1));
						decorations.push(invisibleDecoration.range(nodeTo - 1, nodeTo));
					}
				}
			}
		});
	}

	// Use Decoration.set with sort=true to handle unsorted ranges
	return Decoration.set(decorations, true);
}

/**
 * Link plugin with optimized update detection.
 */
class LinkPlugin {
	decorations: DecorationSet;
	private lastSelectionRanges: string = '';

	constructor(view: EditorView) {
		this.decorations = buildLinkDecorations(view);
		this.lastSelectionRanges = this.serializeSelection(view);
	}

	update(update: ViewUpdate) {
		// Always rebuild on doc or viewport change
		if (update.docChanged || update.viewportChanged) {
			this.decorations = buildLinkDecorations(update.view);
			this.lastSelectionRanges = this.serializeSelection(update.view);
			return;
		}

		// For selection changes, check if selection actually changed
		if (update.selectionSet) {
			const newRanges = this.serializeSelection(update.view);
			if (newRanges !== this.lastSelectionRanges) {
				this.decorations = buildLinkDecorations(update.view);
				this.lastSelectionRanges = newRanges;
			}
		}
	}

	private serializeSelection(view: EditorView): string {
		return view.state.selection.ranges
			.map((r) => `${r.from}:${r.to}`)
			.join(',');
	}
}

export const goToLinkPlugin = ViewPlugin.fromClass(LinkPlugin, {
	decorations: (v) => v.decorations
});
