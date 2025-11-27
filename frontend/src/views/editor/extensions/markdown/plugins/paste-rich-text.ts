import { Extension } from '@codemirror/state';
import { EditorView, keymap, type Command } from '@codemirror/view';

/**
 * Paste rich text as markdown.
 *
 * This plugin:
 * - Intercepts paste events containing HTML
 * - Converts HTML to Markdown format
 * - Supports common formatting: bold, italic, links, lists, etc.
 * - Provides Ctrl/Cmd+Shift+V for plain text paste
 */
export const pasteRichText = (): Extension => [
	pasteRichTextHandler,
	pastePlainTextKeymap
];

/**
 * Convert HTML to Markdown.
 * Simplified implementation for common HTML elements.
 */
function htmlToMarkdown(html: string): string {
	// Create a temporary DOM element to parse HTML
	const temp = document.createElement('div');
	temp.innerHTML = html;

	return convertNode(temp);
}

/**
 * Convert a DOM node to Markdown recursively.
 */
function convertNode(node: Node): string {
	if (node.nodeType === Node.TEXT_NODE) {
		return node.textContent || '';
	}

	if (node.nodeType !== Node.ELEMENT_NODE) {
		return '';
	}

	const element = node as HTMLElement;
	const children = Array.from(element.childNodes)
		.map(convertNode)
		.join('');

	switch (element.tagName.toLowerCase()) {
		case 'strong':
		case 'b':
			return `**${children}**`;

		case 'em':
		case 'i':
			return `*${children}*`;

		case 'code':
			return `\`${children}\``;

		case 'pre':
			return `\n\`\`\`\n${children}\n\`\`\`\n`;

		case 'a': {
			const href = element.getAttribute('href') || '';
			return `[${children}](${href})`;
		}

		case 'img': {
			const src = element.getAttribute('src') || '';
			const alt = element.getAttribute('alt') || '';
			return `![${alt}](${src})`;
		}

		case 'h1':
			return `\n# ${children}\n`;
		case 'h2':
			return `\n## ${children}\n`;
		case 'h3':
			return `\n### ${children}\n`;
		case 'h4':
			return `\n#### ${children}\n`;
		case 'h5':
			return `\n##### ${children}\n`;
		case 'h6':
			return `\n###### ${children}\n`;

		case 'p':
			return `\n${children}\n`;

		case 'br':
			return '\n';

		case 'hr':
			return '\n---\n';

		case 'blockquote':
			return children
				.split('\n')
				.map((line) => `> ${line}`)
				.join('\n');

		case 'ul':
		case 'ol': {
			const items = Array.from(element.children)
				.filter((child) => child.tagName.toLowerCase() === 'li')
				.map((li, index) => {
					const content = convertNode(li).trim();
					const marker =
						element.tagName.toLowerCase() === 'ul'
							? '-'
							: `${index + 1}.`;
					return `${marker} ${content}`;
				})
				.join('\n');
			return `\n${items}\n`;
		}

		case 'li':
			return children;

		case 'table':
		case 'thead':
		case 'tbody':
		case 'tr':
		case 'th':
		case 'td':
			// Simple table handling - just extract text
			return children;

		case 'div':
		case 'span':
		case 'article':
		case 'section':
			return children;

		default:
			return children;
	}
}

/**
 * Handler for paste events with HTML content.
 */
const pasteRichTextHandler = EditorView.domEventHandlers({
	paste(event, view) {
		const html = event.clipboardData?.getData('text/html');
		if (!html) {
			// No HTML content, let default paste handler work
			return false;
		}

		event.preventDefault();

		// Convert HTML to Markdown
		const markdown = htmlToMarkdown(html);

		// Insert the markdown at cursor position
		const from = view.state.selection.main.from;
		const to = view.state.selection.main.to;
		const newPos = from + markdown.length;

		view.dispatch({
			changes: { from, to, insert: markdown },
			selection: { anchor: newPos },
			scrollIntoView: true
		});

		return true;
	}
});

/**
 * Plain text paste command (Ctrl/Cmd+Shift+V).
 */
const pastePlainTextCommand: Command = (view: EditorView) => {
	navigator.clipboard
		.readText()
		.then((text) => {
			const from = view.state.selection.main.from;
			const to = view.state.selection.main.to;
			const newPos = from + text.length;

			view.dispatch({
				changes: { from, to, insert: text },
				selection: { anchor: newPos },
				scrollIntoView: true
			});
		})
		.catch((err: unknown) => {
			console.error('Failed to paste plain text:', err);
		});

	return true;
};

/**
 * Keymap for plain text paste.
 */
const pastePlainTextKeymap = keymap.of([
	{ key: 'Mod-Shift-v', run: pastePlainTextCommand }
]);

