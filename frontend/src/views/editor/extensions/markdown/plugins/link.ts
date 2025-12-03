import { syntaxTree } from '@codemirror/language';
import { Extension, RangeSetBuilder } from '@codemirror/state';
import {
	Decoration,
	DecorationSet,
	EditorView,
	ViewPlugin,
	ViewUpdate
} from '@codemirror/view';
import { checkRangeOverlap, invisibleDecoration, RangeTuple } from '../util';

/**
 * Parent node types that should not process.
 * - Image: handled by image plugin
 * - LinkReference: reference link definitions should be fully visible
 */
const BLACKLISTED_PARENTS = new Set(['Image', 'LinkReference']);

/**
 * Links plugin.
 *
 * Features:
 * - Hides link markup when cursor is outside
 * - Link icons and click events are handled by hyperlink extension
 */
export const links = (): Extension => [goToLinkPlugin];

/**
 * Link info for tracking.
 */
interface LinkInfo {
	parentFrom: number;
	parentTo: number;
	urlFrom: number;
	urlTo: number;
	marks: { from: number; to: number }[];
	linkTitle: { from: number; to: number } | null;
	isAutoLink: boolean;
}

/**
 * Collect all link ranges in visible viewport.
 */
function collectLinkRanges(view: EditorView): RangeTuple[] {
	const ranges: RangeTuple[] = [];
	const seen = new Set<number>();

	for (const { from, to } of view.visibleRanges) {
		syntaxTree(view.state).iterate({
			from,
			to,
			enter: ({ type, node }) => {
				if (type.name !== 'URL') return;

				const parent = node.parent;
				if (!parent || BLACKLISTED_PARENTS.has(parent.name)) return;
				if (seen.has(parent.from)) return;
				seen.add(parent.from);

				ranges.push([parent.from, parent.to]);
			}
		});
	}

	return ranges;
}

/**
 * Get which link the cursor is in (-1 if none).
 */
function getCursorLinkPos(ranges: RangeTuple[], selFrom: number, selTo: number): number {
	const selRange: RangeTuple = [selFrom, selTo];
	
	for (const range of ranges) {
		if (checkRangeOverlap(range, selRange)) {
			return range[0];
		}
	}
	return -1;
}

/**
 * Build link decorations.
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
			enter: ({ type, from: nodeFrom, to: nodeTo, node }) => {
				if (type.name !== 'URL') return;

				const parent = node.parent;
				if (!parent || BLACKLISTED_PARENTS.has(parent.name)) return;

				// Use parent.from as unique key to handle multiple URLs in same link
				if (seen.has(parent.from)) return;
				seen.add(parent.from);

				const marks = parent.getChildren('LinkMark');
				const linkTitle = parent.getChild('LinkTitle');

				// Find the ']' mark to distinguish link text from URL
				const closeBracketMark = marks.find((mark) => {
					const text = view.state.sliceDoc(mark.from, mark.to);
					return text === ']';
				});

				// If URL is before ']', it's part of display text, don't hide
				if (closeBracketMark && nodeFrom < closeBracketMark.from) {
					return;
				}

				// Check if cursor overlaps with the parent link
				if (checkRangeOverlap([parent.from, parent.to], selRange)) {
					return;
				}

				// Hide link marks and URL
				if (marks.length > 0) {
					for (const mark of marks) {
						items.push({ from: mark.from, to: mark.to });
					}
					items.push({ from: nodeFrom, to: nodeTo });

					if (linkTitle) {
						items.push({ from: linkTitle.from, to: linkTitle.to });
					}
				}

				// Handle auto-links with < > markers
				const linkContent = view.state.sliceDoc(nodeFrom, nodeTo);
				if (linkContent.startsWith('<') && linkContent.endsWith('>')) {
					// Already hidden the whole URL above, no extra handling needed
				}
			}
		});
	}

	// Sort and add to builder
	items.sort((a, b) => a.from - b.from);
	
	// Deduplicate overlapping ranges
	let lastTo = -1;
	for (const item of items) {
		if (item.from >= lastTo) {
			builder.add(item.from, item.to, invisibleDecoration);
			lastTo = item.to;
		}
	}

	return builder.finish();
}

/**
 * Link plugin with optimized updates.
 */
class LinkPlugin {
	decorations: DecorationSet;
	private linkRanges: RangeTuple[] = [];
	private cursorLinkPos = -1;

	constructor(view: EditorView) {
		this.linkRanges = collectLinkRanges(view);
		const { from, to } = view.state.selection.main;
		this.cursorLinkPos = getCursorLinkPos(this.linkRanges, from, to);
		this.decorations = buildDecorations(view);
	}

	update(update: ViewUpdate) {
		const { docChanged, viewportChanged, selectionSet } = update;

		if (docChanged || viewportChanged) {
			this.linkRanges = collectLinkRanges(update.view);
			const { from, to } = update.state.selection.main;
			this.cursorLinkPos = getCursorLinkPos(this.linkRanges, from, to);
			this.decorations = buildDecorations(update.view);
			return;
		}

		if (selectionSet) {
			const { from, to } = update.state.selection.main;
			const newPos = getCursorLinkPos(this.linkRanges, from, to);

			if (newPos !== this.cursorLinkPos) {
				this.cursorLinkPos = newPos;
				this.decorations = buildDecorations(update.view);
			}
		}
	}
}

export const goToLinkPlugin = ViewPlugin.fromClass(LinkPlugin, {
	decorations: (v) => v.decorations
});

