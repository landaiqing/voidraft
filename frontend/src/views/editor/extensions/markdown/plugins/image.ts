import { Extension, Range } from '@codemirror/state';
import { EditorView } from 'codemirror';
import { imagePreview } from '../state/image';
import { image as classes } from '../classes';
import {
	Decoration,
	DecorationSet,
	ViewPlugin,
	ViewUpdate
} from '@codemirror/view';
import {
	iterateTreeInVisibleRanges,
	isCursorInRange,
	invisibleDecoration
} from '../util';

/**
 * Build decorations to hide image markdown syntax.
 * Only hides when cursor is outside the image range.
 */
function hideImageNodes(view: EditorView) {
	const widgets = new Array<Range<Decoration>>();
	iterateTreeInVisibleRanges(view, {
		enter(node) {
			if (
				node.name === 'Image' &&
				!isCursorInRange(view.state, [node.from, node.to])
			) {
				widgets.push(invisibleDecoration.range(node.from, node.to));
			}
		}
	});
	return Decoration.set(widgets, true);
}

/**
 * Plugin to hide image markdown syntax when cursor is outside.
 */
const hideImageNodePlugin = ViewPlugin.fromClass(
	class {
		decorations: DecorationSet;

		constructor(view: EditorView) {
			this.decorations = hideImageNodes(view);
		}

		update(update: ViewUpdate) {
			if (update.docChanged || update.selectionSet || update.viewportChanged) {
				this.decorations = hideImageNodes(update.view);
			}
		}
	},
	{ decorations: (v) => v.decorations }
);

/**
 * Image plugin.
 */
export const image = (): Extension => [
	imagePreview(),
	hideImageNodePlugin,
	baseTheme
];

const baseTheme = EditorView.baseTheme({
	['.' + classes.widget]: {
		display: 'block',
		objectFit: 'contain',
		maxWidth: '100%',
		maxHeight: '100%',
		userSelect: 'none'
	}
});
