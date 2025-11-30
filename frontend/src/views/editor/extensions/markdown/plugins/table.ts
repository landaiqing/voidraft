import { Extension, Range } from '@codemirror/state';
import {
	ViewPlugin,
	DecorationSet,
	Decoration,
	EditorView,
	ViewUpdate
} from '@codemirror/view';
import { isCursorInRange } from '../util';
import { extractTablesFromState } from '../state/table';

/**
 * Table styling extension for Markdown.
 * 
 * - Adds background styling and hides syntax when cursor is OUTSIDE table
 * - Shows raw markdown with NO styling when cursor is INSIDE table (edit mode)
 */
export const table = (): Extension => [tablePlugin, baseTheme];

/** Line decorations - only applied when NOT editing */
const headerLine = Decoration.line({ attributes: { class: 'cm-table-header' } });
const delimiterLine = Decoration.line({ attributes: { class: 'cm-table-delimiter' } });
const dataLine = Decoration.line({ attributes: { class: 'cm-table-data' } });

/** Mark to hide pipe characters */
const pipeHidden = Decoration.mark({ attributes: { class: 'cm-table-pipe-hidden' } });

/** Mark to hide delimiter row content */
const delimiterHidden = Decoration.mark({ attributes: { class: 'cm-table-delimiter-hidden' } });

/** Delimiter row regex */
const DELIMITER_REGEX = /^\s*\|?\s*[-:]+/;

/**
 * Build decorations for tables.
 * Only adds decorations when cursor is OUTSIDE the table.
 */
function buildDecorations(view: EditorView): DecorationSet {
	const decorations: Range<Decoration>[] = [];
	const tables = extractTablesFromState(view.state);
	
	for (const table of tables) {
		// Skip all decorations if cursor is inside table (edit mode)
		if (isCursorInRange(view.state, [table.from, table.to])) {
			continue;
		}
		
		const startLine = view.state.doc.lineAt(table.from);
		const endLine = view.state.doc.lineAt(table.to);
		const lines = table.rawText.split('\n');
		
		for (let i = 0; i < lines.length; i++) {
			const lineNum = startLine.number + i;
			if (lineNum > endLine.number) break;
			
			const line = view.state.doc.line(lineNum);
			const text = lines[i];
			const isDelimiter = i === 1 && DELIMITER_REGEX.test(text);
			
			// Add line decoration
			if (i === 0) {
				decorations.push(headerLine.range(line.from));
			} else if (isDelimiter) {
				decorations.push(delimiterLine.range(line.from));
			} else {
				decorations.push(dataLine.range(line.from));
			}
			
			// Hide syntax elements
			if (isDelimiter) {
				// Hide entire delimiter content
				decorations.push(delimiterHidden.range(line.from, line.to));
			} else {
				// Hide pipe characters
				for (let j = 0; j < text.length; j++) {
					if (text[j] === '|') {
						decorations.push(pipeHidden.range(line.from + j, line.from + j + 1));
					}
				}
			}
		}
	}
	
	return Decoration.set(decorations, true);
}

/**
 * Table ViewPlugin.
 */
const tablePlugin = ViewPlugin.fromClass(
	class {
		decorations: DecorationSet;
		
		constructor(view: EditorView) {
			this.decorations = buildDecorations(view);
		}
		
		update(update: ViewUpdate) {
			if (update.docChanged || update.selectionSet || update.viewportChanged) {
				this.decorations = buildDecorations(update.view);
			}
		}
	},
	{ decorations: v => v.decorations }
);

/**
 * Base theme for table styling.
 */
const baseTheme = EditorView.baseTheme({
	// Header row
	'.cm-table-header': {
		backgroundColor: 'var(--cm-table-header-bg, rgba(128, 128, 128, 0.12))',
		borderTopLeftRadius: '4px',
		borderTopRightRadius: '4px'
	},
	
	// Delimiter row
	'.cm-table-delimiter': {
		backgroundColor: 'var(--cm-table-bg, rgba(128, 128, 128, 0.06))',
		lineHeight: '0.5'
	},
	
	// Data rows
	'.cm-table-data': {
		backgroundColor: 'var(--cm-table-bg, rgba(128, 128, 128, 0.06))'
	},
	
	'.cm-table-data:last-of-type': {
		borderBottomLeftRadius: '4px',
		borderBottomRightRadius: '4px'
	},
	
	// Hidden pipe characters
	'.cm-table-pipe-hidden': {
		fontSize: '0',
		color: 'transparent'
	},
	
	// Hidden delimiter content
	'.cm-table-delimiter-hidden': {
		fontSize: '0',
		color: 'transparent'
	}
});
