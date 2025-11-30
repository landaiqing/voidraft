import { syntaxTree } from '@codemirror/language';
import { EditorState } from '@codemirror/state';

/**
 * Basic table information extracted from syntax tree.
 */
export interface TableInfo {
	/** Starting position in document */
	from: number;
	/** End position in document */
	to: number;
	/** Raw markdown text */
	rawText: string;
}

/**
 * Extract all tables from the editor state.
 */
export function extractTablesFromState(state: EditorState): TableInfo[] {
	const tables: TableInfo[] = [];
	const seen = new Set<string>();
	
	syntaxTree(state).iterate({
		enter: ({ type, from, to }) => {
			if (type.name !== 'Table') return;
			
			// Deduplicate
			const key = `${from}:${to}`;
			if (seen.has(key)) return;
			seen.add(key);
			
			const rawText = state.doc.sliceString(from, to);
			
			// Need at least 2 lines (header + delimiter)
			if (rawText.split('\n').length < 2) return;
			
			tables.push({ from, to, rawText });
		}
	});
	
	return tables;
}
