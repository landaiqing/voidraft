import { syntaxTree } from '@codemirror/language';
import { EditorState, Range } from '@codemirror/state';
import {
	Decoration,
	DecorationSet,
	EditorView,
	ViewPlugin,
	ViewUpdate,
	WidgetType
} from '@codemirror/view';
import DOMPurify from 'dompurify';
import { isCursorInRange } from '../util';

interface EmbedBlockData {
	from: number;
	to: number;
	content: string;
}

/**
 * Extract all HTML blocks from the document (both HTMLBlock and HTMLTag).
 * Returns all blocks regardless of cursor position.
 */
function extractAllHTMLBlocks(state: EditorState): EmbedBlockData[] {
	const blocks = new Array<EmbedBlockData>();
	syntaxTree(state).iterate({
		enter({ from, to, name }) {
			// Support both block-level HTML (HTMLBlock) and inline HTML tags (HTMLTag)
			if (name !== 'HTMLBlock' && name !== 'HTMLTag') return;
			const html = state.sliceDoc(from, to);
			const content = DOMPurify.sanitize(html);

			// Skip empty content after sanitization
			if (!content.trim()) return;

			blocks.push({ from, to, content });
		}
	});
	return blocks;
}

/**
 * Build decorations for HTML blocks.
 * Only shows preview for blocks where cursor is not inside.
 */
function buildDecorations(state: EditorState, blocks: EmbedBlockData[]): DecorationSet {
	const decorations: Range<Decoration>[] = [];
	
	for (const block of blocks) {
		// Skip if cursor is in range
		if (isCursorInRange(state, [block.from, block.to])) continue;
		
		// Hide the original HTML source code
		decorations.push(Decoration.replace({}).range(block.from, block.to));
		
		// Add the preview widget at the end
		decorations.push(
			Decoration.widget({
				widget: new HTMLBlockWidget(block),
				side: 1
			}).range(block.to)
		);
	}
	
	return Decoration.set(decorations, true);
}

/**
 * Check if selection affects any HTML block (cursor moved in/out of a block).
 */
function selectionAffectsBlocks(
	state: EditorState,
	prevState: EditorState,
	blocks: EmbedBlockData[]
): boolean {
	for (const block of blocks) {
		const wasInRange = isCursorInRange(prevState, [block.from, block.to]);
		const isInRange = isCursorInRange(state, [block.from, block.to]);
		if (wasInRange !== isInRange) return true;
	}
	return false;
}

/**
 * ViewPlugin for HTML block preview.
 * Uses smart caching to avoid unnecessary updates during text selection.
 */
class HTMLBlockPlugin {
	decorations: DecorationSet;
	blocks: EmbedBlockData[];

	constructor(view: EditorView) {
		this.blocks = extractAllHTMLBlocks(view.state);
		this.decorations = buildDecorations(view.state, this.blocks);
	}

	update(update: ViewUpdate) {
		// If document changed, re-extract all blocks
		if (update.docChanged) {
			this.blocks = extractAllHTMLBlocks(update.state);
			this.decorations = buildDecorations(update.state, this.blocks);
			return;
		}

		// If selection changed, only rebuild if cursor moved in/out of a block
		if (update.selectionSet) {
			if (selectionAffectsBlocks(update.state, update.startState, this.blocks)) {
				this.decorations = buildDecorations(update.state, this.blocks);
			}
		}
	}
}

const htmlBlockPlugin = ViewPlugin.fromClass(HTMLBlockPlugin, {
	decorations: (v) => v.decorations
});

class HTMLBlockWidget extends WidgetType {
	constructor(public data: EmbedBlockData) {
		super();
	}

	toDOM(view: EditorView): HTMLElement {
		const wrapper = document.createElement('span');
		wrapper.className = 'cm-html-block-widget';
		
		// Content container
		const content = document.createElement('span');
		content.className = 'cm-html-block-content';
		// This is sanitized!
		content.innerHTML = this.data.content;
		
		// Edit button
		const editBtn = document.createElement('button');
		editBtn.className = 'cm-html-block-edit-btn';
		editBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
			<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
			<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
		</svg>`;
		editBtn.title = 'Edit HTML';
		
		editBtn.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			view.dispatch({
				selection: { anchor: this.data.from }
			});
			view.focus();
		});
		
		wrapper.appendChild(content);
		wrapper.appendChild(editBtn);
		
		return wrapper;
	}

	eq(widget: HTMLBlockWidget): boolean {
		return JSON.stringify(widget.data) === JSON.stringify(this.data);
	}
}

/**
 * Base theme for HTML blocks.
 */
const baseTheme = EditorView.baseTheme({
	'.cm-html-block-widget': {
		display: 'inline-block',
		position: 'relative',
		maxWidth: '100%',
		overflow: 'auto',
		verticalAlign: 'middle'
	},
	'.cm-html-block-content': {
		display: 'inline-block'
	},
	// Ensure images are properly sized
	'.cm-html-block-content img': {
		maxWidth: '100%',
		height: 'auto',
		display: 'block'
	},
	'.cm-html-block-edit-btn': {
		position: 'absolute',
		top: '4px',
		right: '4px',
		padding: '4px',
		border: 'none',
		borderRadius: '4px',
		background: 'rgba(128, 128, 128, 0.2)',
		color: 'inherit',
		cursor: 'pointer',
		opacity: '0',
		transition: 'opacity 0.2s, background 0.2s',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		zIndex: '10'
	},
	'.cm-html-block-widget:hover .cm-html-block-edit-btn': {
		opacity: '1'
	},
	'.cm-html-block-edit-btn:hover': {
		background: 'rgba(128, 128, 128, 0.4)'
	}
});

// Export the extension with theme
export const htmlBlockExtension = [htmlBlockPlugin, baseTheme];
