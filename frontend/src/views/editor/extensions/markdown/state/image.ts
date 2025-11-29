import { syntaxTree } from '@codemirror/language';
import { Extension, Range } from '@codemirror/state';
import {
	DecorationSet,
	Decoration,
	WidgetType,
	EditorView,
	ViewPlugin,
	ViewUpdate
} from '@codemirror/view';
import { isCursorInRange } from '../util';
import { image as classes } from '../classes';

/**
 * Representation of image data extracted from the syntax tree.
 */
export interface ImageInfo {
	/** The source URL of the image. */
	src: string;
	/** The starting position of the image element in the document. */
	from: number;
	/** The end position of the image element in the document. */
	to: number;
	/** The alt text of the image. */
	alt: string;
}

/**
 * Capture everything in square brackets of a markdown image, after
 * the exclamation mark.
 */
const IMAGE_TEXT_RE = /(?:!\[)(.*?)(?:\])/;

/**
 * Extract images from the syntax tree.
 */
function extractImages(view: EditorView): ImageInfo[] {
	const images: ImageInfo[] = [];

	for (const { from, to } of view.visibleRanges) {
		syntaxTree(view.state).iterate({
			from,
			to,
			enter: ({ name, node, from: nodeFrom, to: nodeTo }) => {
				if (name !== 'Image') return;
				const altMatch = view.state.sliceDoc(nodeFrom, nodeTo).match(IMAGE_TEXT_RE);
				const alt: string = altMatch?.pop() ?? '';
				const urlNode = node.getChild('URL');
				if (urlNode) {
					const url: string = view.state.sliceDoc(urlNode.from, urlNode.to);
					images.push({ src: url, from: nodeFrom, to: nodeTo, alt });
				}
			}
		});
	}

	return images;
}

/**
 * Build image preview decorations.
 * Only shows preview when cursor is outside the image syntax.
 */
function buildImageDecorations(view: EditorView, loadedImages: Set<string>): DecorationSet {
	const decorations: Range<Decoration>[] = [];
	const images = extractImages(view);

	for (const img of images) {
		const cursorInImage = isCursorInRange(view.state, [img.from, img.to]);

		// Only show preview when cursor is outside
		if (!cursorInImage) {
			const isLoaded = loadedImages.has(img.src);
			decorations.push(
				Decoration.widget({
					widget: new ImagePreviewWidget(img, isLoaded, loadedImages),
					side: 1
				}).range(img.to)
			);
		}
	}

	return Decoration.set(decorations, true);
}

/**
 * Image preview widget that displays the actual image.
 */
class ImagePreviewWidget extends WidgetType {
	constructor(
		private readonly info: ImageInfo,
		private readonly isLoaded: boolean,
		private readonly loadedImages: Set<string>
	) {
		super();
	}

	toDOM(view: EditorView): HTMLElement {
		const wrapper = document.createElement('span');
		wrapper.className = 'cm-image-preview-wrapper';

		const img = new Image();
		img.classList.add(classes.widget);
		img.src = this.info.src;
		img.alt = this.info.alt;

		if (!this.isLoaded) {
			img.addEventListener('load', () => {
				this.loadedImages.add(this.info.src);
				view.dispatch({});
			});
		}

		if (this.isLoaded) {
			wrapper.appendChild(img);
		} else {
			const placeholder = document.createElement('span');
			placeholder.className = 'cm-image-loading';
			placeholder.textContent = '🖼️';
			wrapper.appendChild(placeholder);
			img.style.display = 'none';
			wrapper.appendChild(img);
		}

		return wrapper;
	}

	eq(widget: ImagePreviewWidget): boolean {
		return (
			widget.info.src === this.info.src &&
			widget.info.from === this.info.from &&
			widget.info.to === this.info.to &&
			widget.isLoaded === this.isLoaded
		);
	}

	ignoreEvent(): boolean {
		return false;
	}
}

/**
 * Image preview plugin class.
 */
class ImagePreviewPlugin {
	decorations: DecorationSet;
	private loadedImages: Set<string> = new Set();
	private lastSelectionRanges: string = '';

	constructor(view: EditorView) {
		this.decorations = buildImageDecorations(view, this.loadedImages);
		this.lastSelectionRanges = this.serializeSelection(view);
	}

	update(update: ViewUpdate) {
		if (update.docChanged || update.viewportChanged) {
			this.decorations = buildImageDecorations(update.view, this.loadedImages);
			this.lastSelectionRanges = this.serializeSelection(update.view);
			return;
		}

		if (update.selectionSet) {
			const newRanges = this.serializeSelection(update.view);
			if (newRanges !== this.lastSelectionRanges) {
				this.decorations = buildImageDecorations(update.view, this.loadedImages);
				this.lastSelectionRanges = newRanges;
			}
			return;
		}

		if (!update.docChanged && !update.selectionSet && !update.viewportChanged) {
			this.decorations = buildImageDecorations(update.view, this.loadedImages);
		}
	}

	private serializeSelection(view: EditorView): string {
		return view.state.selection.ranges
			.map((r) => `${r.from}:${r.to}`)
			.join(',');
	}
}

/**
 * Image preview extension.
 * Only handles displaying image preview widget.
 */
export const imagePreview = (): Extension => [
	ViewPlugin.fromClass(ImagePreviewPlugin, {
		decorations: (v) => v.decorations
	}),
	baseTheme
];

const baseTheme = EditorView.baseTheme({
	'.cm-image-preview-wrapper': {
		display: 'block',
		margin: '0.5rem 0'
	},
	[`.${classes.widget}`]: {
		maxWidth: '100%',
		height: 'auto',
		borderRadius: '0.25rem'
	},
	'.cm-image-loading': {
		display: 'inline-block',
		color: 'var(--cm-foreground)',
		opacity: '0.6'
	}
});
