/**
 * Highlight extension for Lezer Markdown parser.
 * 
 * Parses ==highlight== syntax similar to Obsidian/Mark style.
 * 
 * Syntax: ==text== → renders as highlighted text
 * 
 * Example:
 * - This is ==important== text → This is <mark>important</mark> text
 */

import { MarkdownConfig } from '@lezer/markdown';

/**
 * Highlight extension for Lezer Markdown.
 * 
 * Defines:
 * - Highlight: The container node for highlighted content
 * - HighlightMark: The == delimiter marks
 */
export const Highlight: MarkdownConfig = {
	defineNodes: [
		{ name: 'Highlight' },
		{ name: 'HighlightMark' }
	],
	parseInline: [{
		name: 'Highlight',
		parse(cx, next, pos) {
			// Check for == delimiter (= is ASCII 61)
			if (next !== 61 || cx.char(pos + 1) !== 61) {
				return -1;
			}

			// Don't match === or more (horizontal rule or other constructs)
			if (cx.char(pos + 2) === 61) {
				return -1;
			}

			// Look for closing == delimiter
			for (let i = pos + 2; i < cx.end - 1; i++) {
				const char = cx.char(i);
				
				// Don't allow newlines within highlight
				if (char === 10) { // newline
					return -1;
				}

				// Found potential closing ==
				if (char === 61 && cx.char(i + 1) === 61) {
					// Make sure it's not ===
					if (i + 2 < cx.end && cx.char(i + 2) === 61) {
						continue;
					}
					
					// Create the element with marks
					const element = cx.elt('Highlight', pos, i + 2, [
						cx.elt('HighlightMark', pos, pos + 2),
						cx.elt('HighlightMark', i, i + 2)
					]);
					return cx.addElement(element);
				}
			}

			return -1;
		},
		// Parse after emphasis to avoid conflicts with other inline parsers
		after: 'Emphasis'
	}]
};

export default Highlight;

