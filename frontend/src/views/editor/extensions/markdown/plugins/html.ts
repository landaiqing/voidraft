/**
 * HTML plugin for CodeMirror.
 *
 * Features:
 * - Identifies HTML blocks and tags (excluding those inside tables)
 * - Shows indicator icon at the end
 * - Click to preview rendered HTML
 */

import { syntaxTree } from '@codemirror/language';
import { Extension, Range, StateField, StateEffect, ChangeSet } from '@codemirror/state';
import {
	DecorationSet,
	Decoration,
	WidgetType,
	EditorView,
	ViewPlugin,
	ViewUpdate,
	showTooltip,
	Tooltip
} from '@codemirror/view';
import DOMPurify from 'dompurify';
import { LruCache } from '@/common/utils/lruCache';

interface HTMLBlockInfo {
	from: number;
	to: number;
	content: string;
	sanitized: string;
}

// HTML5 official logo
const HTML_ICON = `<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" width="14" height="14"><path d="M89.088 59.392l62.464 803.84c1.024 12.288 9.216 22.528 20.48 25.6L502.784 993.28c6.144 2.048 12.288 2.048 18.432 0l330.752-104.448c11.264-4.096 19.456-14.336 20.48-25.6l62.464-803.84c1.024-17.408-12.288-31.744-29.696-31.744H118.784c-17.408 0-31.744 14.336-29.696 31.744z" fill="#FC490B"/><path d="M774.144 309.248h-409.6l12.288 113.664h388.096l-25.6 325.632-227.328 71.68-227.328-71.68-13.312-169.984h118.784v82.944l124.928 33.792 123.904-33.792 10.24-132.096H267.264L241.664 204.8h540.672z" fill="#FFFFFF"/></svg>`;

/**
 * LRU cache for DOMPurify sanitize results.
 */
const sanitizeCache = new LruCache<string, string>(100);

/**
 * Sanitize HTML content with caching for performance.
 */
function sanitizeHTML(html: string): string {
	const cached = sanitizeCache.get(html);
	if (cached !== undefined) {
		return cached;
	}
	
	const sanitized = DOMPurify.sanitize(html, {
		ADD_TAGS: ['img'],
		ADD_ATTR: ['src', 'alt', 'width', 'height', 'style', 'class', 'loading'],
		ALLOW_DATA_ATTR: true
	});
	
	sanitizeCache.set(html, sanitized);
	return sanitized;
}

/**
 * Check if document changes affect any of the given regions.
 */
function changesAffectRegions(changes: ChangeSet, regions: { from: number; to: number }[]): boolean {
	if (regions.length === 0) return true;
	
	let affected = false;
	changes.iterChanges((fromA, toA) => {
		if (affected) return;
		for (const region of regions) {
			if (fromA <= region.to && toA >= region.from) {
				affected = true;
				return;
			}
		}
	});
	return affected;
}

/**
 * Check if a node is inside a table.
 */
function isInsideTable(node: { parent: { type: { name: string }; parent: unknown } | null }): boolean {
	let current = node.parent;
	while (current) {
		const name = current.type.name;
		if (name === 'Table' || name === 'TableHeader' || name === 'TableRow' || name === 'TableCell') {
			return true;
		}
		current = current.parent as typeof current;
	}
	return false;
}

/**
 * Extract all HTML blocks from visible ranges.
 * Excludes HTML inside tables (tables have their own rendering).
 */
function extractHTMLBlocks(view: EditorView): HTMLBlockInfo[] {
	const result: HTMLBlockInfo[] = [];

	for (const { from, to } of view.visibleRanges) {
		syntaxTree(view.state).iterate({
			from,
			to,
			enter: (nodeRef) => {
				const { name, from: f, to: t, node } = nodeRef;

				// Support both block-level HTML (HTMLBlock) and inline HTML tags (HTMLTag)
				if (name !== 'HTMLBlock' && name !== 'HTMLTag') return;

				// Skip HTML inside tables
				if (isInsideTable(node)) return;

				const content = view.state.sliceDoc(f, t);
				const sanitized = sanitizeHTML(content);

				// Skip empty content after sanitization
				if (!sanitized.trim()) return;

				result.push({ from: f, to: t, content, sanitized });
			}
		});
	}

	return result;
}

/** Effect to toggle tooltip visibility */
const toggleHTMLTooltip = StateEffect.define<HTMLBlockInfo | null>();

/** Effect to close tooltip */
const closeHTMLTooltip = StateEffect.define<null>();

/** StateField to track active tooltip */
const htmlTooltipState = StateField.define<HTMLBlockInfo | null>({
	create: () => null,
	update(value, tr) {
		for (const effect of tr.effects) {
			if (effect.is(toggleHTMLTooltip)) {
				// Toggle: if same block, close; otherwise open new
				if (value && effect.value && value.from === effect.value.from) {
					return null;
				}
				return effect.value;
			}
			if (effect.is(closeHTMLTooltip)) {
				return null;
			}
		}
		// Close tooltip on document changes
		if (tr.docChanged) {
			return null;
		}
		return value;
	},
	provide: (field) =>
		showTooltip.from(field, (block): Tooltip | null => {
			if (!block) return null;
			return {
				pos: block.to,
				above: true,
				create: () => {
					const dom = document.createElement('div');
					dom.className = 'cm-html-tooltip';
					dom.innerHTML = block.sanitized;

					// Prevent clicks inside tooltip from closing it
					dom.addEventListener('click', (e) => {
						e.stopPropagation();
					});

					return { dom };
				}
			};
		})
});
/**
 * Indicator widget shown at the end of HTML blocks.
 * Clicking toggles the tooltip.
 */
class HTMLIndicatorWidget extends WidgetType {
	constructor(readonly info: HTMLBlockInfo) {
		super();
	}

	toDOM(view: EditorView): HTMLElement {
		const el = document.createElement('span');
		el.className = 'cm-html-indicator';
		el.innerHTML = HTML_ICON;
		el.title = 'Click to preview HTML';

		// Click handler to toggle tooltip
		el.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			view.dispatch({
				effects: toggleHTMLTooltip.of(this.info)
			});
		});

		return el;
	}

	eq(other: HTMLIndicatorWidget): boolean {
		return this.info.from === other.info.from && this.info.content === other.info.content;
	}

	ignoreEvent(): boolean {
		return false;
	}
}

/**
 * Plugin to manage HTML block decorations.
 * Optimized with incremental updates when changes don't affect HTML regions.
 */
class HTMLBlockPlugin {
	decorations: DecorationSet;
	blocks: HTMLBlockInfo[] = [];

	constructor(view: EditorView) {
		this.blocks = extractHTMLBlocks(view);
		this.decorations = this.build();
	}

	update(update: ViewUpdate) {
		// Always rebuild on viewport change
		if (update.viewportChanged) {
			this.blocks = extractHTMLBlocks(update.view);
			this.decorations = this.build();
			return;
		}
		
		// For document changes, only rebuild if changes affect HTML regions
		if (update.docChanged) {
			const needsRebuild = changesAffectRegions(update.changes, this.blocks);
			
			if (needsRebuild) {
				this.blocks = extractHTMLBlocks(update.view);
				this.decorations = this.build();
			} else {
				// Just update positions of existing decorations
				this.decorations = this.decorations.map(update.changes);
				this.blocks = this.blocks.map(block => ({
					...block,
					from: update.changes.mapPos(block.from),
					to: update.changes.mapPos(block.to)
				}));
			}
		}
	}

	private build(): DecorationSet {
		const deco: Range<Decoration>[] = [];
		for (const block of this.blocks) {
			deco.push(
				Decoration.widget({
					widget: new HTMLIndicatorWidget(block),
					side: 1
				}).range(block.to)
			);
		}
		return Decoration.set(deco, true);
	}
}

const htmlBlockPlugin = ViewPlugin.fromClass(HTMLBlockPlugin, {
	decorations: (v) => v.decorations
});

/**
 * Close tooltip when clicking outside.
 */
const clickOutsideHandler = EditorView.domEventHandlers({
	click(event, view) {
		const target = event.target as HTMLElement;
		
		// Don't close if clicking on indicator or inside tooltip
		if (target.closest('.cm-html-indicator') || target.closest('.cm-html-tooltip')) {
			return false;
		}
		
		// Close tooltip if one is open
		const currentTooltip = view.state.field(htmlTooltipState);
		if (currentTooltip) {
			view.dispatch({
				effects: closeHTMLTooltip.of(null)
			});
		}
		
		return false;
	}
});

const theme = EditorView.baseTheme({
	// Indicator icon
	'.cm-html-indicator': {
		display: 'inline-flex',
		alignItems: 'center',
		marginLeft: '4px',
		verticalAlign: 'middle',
		cursor: 'pointer',
		opacity: '0.5',
		color: 'var(--cm-html-color, #e44d26)',
		transition: 'opacity 0.15s',
		'& svg': { width: '14px', height: '14px' }
	},
	'.cm-html-indicator:hover': {
		opacity: '1'
	},

	// Tooltip content
	'.cm-html-tooltip': {
		padding: '8px 12px',
		maxWidth: '60vw',
		maxHeight: '50vh',
		overflow: 'auto'
	},

	// Images inside tooltip
	'.cm-html-tooltip img': {
		maxWidth: '100%',
		height: 'auto',
		display: 'block'
	},

	// Style the parent tooltip container
	'.cm-tooltip:has(.cm-html-tooltip)': {
		background: 'var(--bg-primary, #fff)',
		border: '1px solid var(--border-color, #ddd)',
		borderRadius: '4px',
		boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
	}
});

/**
 * HTML block extension.
 *
 * Features:
 * - Identifies HTML blocks and tags (excluding those inside tables)
 * - Shows indicator icon at the end
 * - Click to preview rendered HTML
 */
export const html = (): Extension => [
	htmlBlockPlugin,
	htmlTooltipState,
	clickOutsideHandler,
	theme
];
