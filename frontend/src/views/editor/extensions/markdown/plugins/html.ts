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
			const content = DOMPurify.sanitize(html, {
				FORBID_ATTR: ['style']
			});

			blocks.push({
				from,
				to,
				content
			});
		}
	});
	return blocks;
}

function blockToDecoration(blocks: EmbedBlockData[]): Range<Decoration>[] {
	return blocks.map((block) =>
		Decoration.widget({
			widget: new HTMLBlockWidget(block),
			// NOTE: NOT using block: true to avoid affecting codeblock boundaries
			side: 1
		}).range(block.to)
	);
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

	toDOM(): HTMLElement {
		const dom = document.createElement('span');
		dom.className = 'cm-html-block-widget';
		// This is sanitized!
		dom.innerHTML = this.data.content;
		return dom;
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
		width: '100%',
		overflow: 'auto'
	}
});

// Export the extension with theme
export const htmlBlockExtension = [htmlBlock, baseTheme];
