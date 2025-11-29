import { syntaxTree } from '@codemirror/language';
import { Range } from '@codemirror/state';
import {
	Decoration,
	DecorationSet,
	EditorView,
	ViewPlugin,
	ViewUpdate,
	WidgetType
} from '@codemirror/view';
import { headingSlugField } from '../state/heading-slug';
import { checkRangeOverlap, isCursorInRange, invisibleDecoration } from '../util';
import { link as classes } from '../classes';

/**
 * Pattern for auto-link markers (< and >).
 */
const AUTO_LINK_MARK_RE = /^<|>$/g;

/**
 * Parent node types that should not have link widgets.
 */
const BLACKLISTED_PARENTS = new Set(['Image']);

/**
 * Links plugin.
 *
 * Features:
 * - Adds interactive link icon for navigation
 * - Supports internal anchor links (#heading)
 * - Hides link markup when cursor is outside
 */
export const links = () => [goToLinkPlugin, baseTheme];

/**
 * Link widget for external/internal navigation.
 */
export class GoToLinkWidget extends WidgetType {
	constructor(
		readonly link: string,
		readonly title?: string
	) {
		super();
	}

	eq(other: GoToLinkWidget): boolean {
		return other.link === this.link && other.title === this.title;
	}

	toDOM(view: EditorView): HTMLElement {
		const anchor = document.createElement('a');
		anchor.classList.add(classes.widget);
		anchor.textContent = '🔗';

		if (this.link.startsWith('#')) {
			// Handle internal anchor links
			anchor.href = 'javascript:void(0)';
			anchor.addEventListener('click', (e) => {
				e.preventDefault();
				const slugs = view.state.field(headingSlugField);
				const targetSlug = this.link.slice(1);
				const pos = slugs.find((h) => h.slug === targetSlug)?.pos;

				if (typeof pos !== 'undefined') {
					view.dispatch({
						selection: { anchor: pos },
						scrollIntoView: true
					});
				}
			});
		} else {
			// External links
			anchor.href = this.link;
			anchor.target = '_blank';
			anchor.rel = 'noopener noreferrer';
		}

		if (this.title) {
			anchor.title = this.title;
		}

		return anchor;
	}

	ignoreEvent(): boolean {
		return false;
	}
}

/**
 * Build link decorations.
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
				let linkContent = view.state.sliceDoc(nodeFrom, nodeTo);

				// Handle auto-links with < > markers
				if (AUTO_LINK_MARK_RE.test(linkContent)) {
					linkContent = linkContent.replace(AUTO_LINK_MARK_RE, '');

					if (!isCursorInRange(view.state, [node.from, node.to])) {
						decorations.push(invisibleDecoration.range(nodeFrom, nodeFrom + 1));
						decorations.push(invisibleDecoration.range(nodeTo - 1, nodeTo));
					}
				}

				// Get link title content
				const linkTitleContent = linkTitle
					? view.state.sliceDoc(linkTitle.from, linkTitle.to)
					: undefined;

				// Add link widget
				decorations.push(
					Decoration.widget({
						widget: new GoToLinkWidget(linkContent, linkTitleContent),
						side: 1
					}).range(nodeTo)
				);
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

/**
 * Base theme for links.
 */
const baseTheme = EditorView.baseTheme({
	[`.${classes.widget}`]: {
		cursor: 'pointer',
		textDecoration: 'none',
		opacity: '0.7',
		transition: 'opacity 0.2s'
	},
	[`.${classes.widget}:hover`]: {
		opacity: '1'
	}
});
