/**
 * Image plugin for CodeMirror.
 *
 * Features:
 * - Identifies markdown images
 * - Shows indicator icon at the end
 * - Click to preview image
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

interface ImageInfo {
	src: string;
	from: number;
	to: number;
	alt: string;
}

const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|svg|bmp|ico|avif|apng|tiff?)(\?.*)?$/i;
const IMAGE_ALT_RE = /(?:!\[)(.*?)(?:\])/;
const ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;

function isImageUrl(url: string): boolean {
	return IMAGE_EXT_RE.test(url) || url.startsWith('data:image/');
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

function extractImages(view: EditorView): ImageInfo[] {
	const result: ImageInfo[] = [];
	for (const { from, to } of view.visibleRanges) {
		syntaxTree(view.state).iterate({
			from,
			to,
			enter: ({ name, node, from: f, to: t }) => {
				if (name !== 'Image') return;
				const urlNode = node.getChild('URL');
				if (!urlNode) return;
				const src = view.state.sliceDoc(urlNode.from, urlNode.to);
				if (!isImageUrl(src)) return;
				const text = view.state.sliceDoc(f, t);
				const alt = text.match(IMAGE_ALT_RE)?.[1] ?? '';
				result.push({ src, from: f, to: t, alt });
			}
		});
	}
	return result;
}

/** Effect to toggle tooltip visibility */
const toggleImageTooltip = StateEffect.define<ImageInfo | null>();

/** Effect to close tooltip */
const closeImageTooltip = StateEffect.define<null>();

/** StateField to track active tooltip */
const imageTooltipState = StateField.define<ImageInfo | null>({
	create: () => null,
	update(value, tr) {
		for (const effect of tr.effects) {
			if (effect.is(toggleImageTooltip)) {
				// Toggle: if same image, close; otherwise open new
				if (value && effect.value && value.from === effect.value.from) {
					return null;
				}
				return effect.value;
			}
			if (effect.is(closeImageTooltip)) {
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
		showTooltip.from(field, (img): Tooltip | null => {
			if (!img) return null;
			return {
				pos: img.to,
				above: true,
				create: () => {
					const dom = document.createElement('div');
					dom.className = 'cm-image-tooltip cm-image-loading';

					const spinner = document.createElement('span');
					spinner.className = 'cm-image-spinner';

					const imgEl = document.createElement('img');
					imgEl.src = img.src;
					imgEl.alt = img.alt;

					imgEl.onload = () => {
						dom.classList.remove('cm-image-loading');
					};
					imgEl.onerror = () => {
						spinner.remove();
						imgEl.remove();
						dom.textContent = 'Failed to load image';
						dom.classList.remove('cm-image-loading');
						dom.classList.add('cm-image-tooltip-error');
					};

					dom.append(spinner, imgEl);

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
 * Indicator widget shown at the end of images.
 * Clicking toggles the tooltip.
 */
class IndicatorWidget extends WidgetType {
	constructor(readonly info: ImageInfo) {
		super();
	}

	toDOM(view: EditorView): HTMLElement {
		const el = document.createElement('span');
		el.className = 'cm-image-indicator';
		el.innerHTML = ICON;
		el.title = 'Click to preview image';

		// Click handler to toggle tooltip
		el.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			view.dispatch({
				effects: toggleImageTooltip.of(this.info)
			});
		});

		return el;
	}

	eq(other: IndicatorWidget): boolean {
		return this.info.from === other.info.from && this.info.src === other.info.src;
	}

	ignoreEvent(): boolean {
		return false;
	}
}

/**
 * Plugin to manage image decorations.
 * Optimized with incremental updates when changes don't affect image regions.
 */
class ImagePlugin {
	decorations: DecorationSet;
	images: ImageInfo[] = [];

	constructor(view: EditorView) {
		this.images = extractImages(view);
		this.decorations = this.build();
	}

	update(update: ViewUpdate) {
		// Always rebuild on viewport change
		if (update.viewportChanged) {
			this.images = extractImages(update.view);
			this.decorations = this.build();
			return;
		}
		
		// For document changes, only rebuild if changes affect image regions
		if (update.docChanged) {
			const needsRebuild = changesAffectRegions(update.changes, this.images);
			
			if (needsRebuild) {
				this.images = extractImages(update.view);
				this.decorations = this.build();
			} else {
				// Just update positions of existing decorations
				this.decorations = this.decorations.map(update.changes);
				this.images = this.images.map(img => ({
					...img,
					from: update.changes.mapPos(img.from),
					to: update.changes.mapPos(img.to)
				}));
			}
		}
	}

	private build(): DecorationSet {
		const deco: Range<Decoration>[] = [];
		for (const img of this.images) {
			deco.push(Decoration.widget({ widget: new IndicatorWidget(img), side: 1 }).range(img.to));
		}
		return Decoration.set(deco, true);
	}
}

const imagePlugin = ViewPlugin.fromClass(ImagePlugin, {
	decorations: (v) => v.decorations
});

/**
 * Close tooltip when clicking outside.
 */
const clickOutsideHandler = EditorView.domEventHandlers({
	click(event, view) {
		const target = event.target as HTMLElement;

		// Don't close if clicking on indicator or inside tooltip
		if (target.closest('.cm-image-indicator') || target.closest('.cm-image-tooltip')) {
			return false;
		}

		// Close tooltip if one is open
		const currentTooltip = view.state.field(imageTooltipState);
		if (currentTooltip) {
			view.dispatch({
				effects: closeImageTooltip.of(null)
			});
		}

		return false;
	}
});

const theme = EditorView.baseTheme({
	'.cm-image-indicator': {
		display: 'inline-flex',
		alignItems: 'center',
		marginLeft: '4px',
		verticalAlign: 'middle',
		cursor: 'pointer',
		opacity: '0.5',
		color: 'var(--cm-link-color, #1a73e8)',
		transition: 'opacity 0.15s',
		'& svg': { width: '14px', height: '14px' }
	},
	'.cm-image-indicator:hover': { opacity: '1' },

	'.cm-image-tooltip': {
		position: 'relative',
		background: `
			linear-gradient(45deg, #e0e0e0 25%, transparent 25%),
			linear-gradient(-45deg, #e0e0e0 25%, transparent 25%),
			linear-gradient(45deg, transparent 75%, #e0e0e0 75%),
			linear-gradient(-45deg, transparent 75%, #e0e0e0 75%)
		`,
		backgroundColor: '#fff',
		backgroundSize: '12px 12px',
		backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0px',
		border: '1px solid var(--border-color)',
		boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
		'& img': {
			display: 'block',
			maxWidth: '60vw',
			maxHeight: '50vh',
			opacity: '1',
			transition: 'opacity 0.15s ease-out'
		}
	},
	'.cm-image-loading': {
		minWidth: '48px',
		minHeight: '48px',
		'& img': { opacity: '0' }
	},
	'.cm-image-spinner': {
		position: 'absolute',
		top: '50%',
		left: '50%',
		width: '16px',
		height: '16px',
		marginTop: '-8px',
		marginLeft: '-8px',
		border: '2px solid #ccc',
		borderTopColor: '#666',
		borderRadius: '50%',
		animation: 'cm-spin 0.5s linear infinite'
	},
	'.cm-image-tooltip:not(.cm-image-loading) .cm-image-spinner': {
		display: 'none'
	},
	'@keyframes cm-spin': {
		to: { transform: 'rotate(360deg)' }
	},
	'.cm-image-tooltip-error': {
		padding: '16px 24px',
		fontSize: '12px',
		color: 'red'
	}
});

export const image = (): Extension => [
	imagePlugin,
	imageTooltipState,
	clickOutsideHandler,
	theme
];
