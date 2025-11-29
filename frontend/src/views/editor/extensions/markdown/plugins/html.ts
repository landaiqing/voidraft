import { syntaxTree } from '@codemirror/language';
import { EditorState, StateField, Range } from '@codemirror/state';
import {
	Decoration,
	DecorationSet,
	EditorView,
	WidgetType
} from '@codemirror/view';
import DOMPurify from 'dompurify';
import { isCursorInRange } from '../util';

interface EmbedBlockData {
	from: number;
	to: number;
	content: string;
}

function extractHTMLBlocks(state: EditorState) {
	const blocks = new Array<EmbedBlockData>();
	syntaxTree(state).iterate({
		enter({ from, to, name }) {
			if (name !== 'HTMLBlock') return;
			if (isCursorInRange(state, [from, to])) return;
			const html = state.sliceDoc(from, to);
			const content = DOMPurify.sanitize(html);

			blocks.push({
				from,
				to,
				content
			});
		}
	});
	return blocks;
}

// Decoration to hide the original HTML source code
const hideDecoration = Decoration.replace({});

function blockToDecoration(blocks: EmbedBlockData[]): Range<Decoration>[] {
	const decorations: Range<Decoration>[] = [];
	
	for (const block of blocks) {
		// Hide the original HTML source code
		decorations.push(hideDecoration.range(block.from, block.to));
		
		// Add the preview widget at the end
		decorations.push(
			Decoration.widget({
				widget: new HTMLBlockWidget(block),
				side: 1
			}).range(block.to)
		);
	}
	
	return decorations;
}

export const htmlBlock = StateField.define<DecorationSet>({
	create(state) {
		return Decoration.set(blockToDecoration(extractHTMLBlocks(state)), true);
	},
	update(value, tx) {
		if (tx.docChanged || tx.selection) {
			return Decoration.set(
				blockToDecoration(extractHTMLBlocks(tx.state)),
				true
			);
		}
		return value.map(tx.changes);
	},
	provide(field) {
		return EditorView.decorations.from(field);
	}
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
		display: 'block',
		position: 'relative',
		width: '100%',
		overflow: 'auto'
	},
	'.cm-html-block-content': {
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
export const htmlBlockExtension = [htmlBlock, baseTheme];
