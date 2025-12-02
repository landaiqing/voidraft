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
import { CharCode, createPairedDelimiterParser } from '../util';

/**
 * Highlight extension for Lezer Markdown.
 * Defines:
 * - Highlight: The container node for highlighted content
 * - HighlightMark: The == delimiter marks
 */
export const Highlight: MarkdownConfig = {
	defineNodes: [
		{ name: 'Highlight' },
		{ name: 'HighlightMark' }
	],
	parseInline: [
		createPairedDelimiterParser({
			name: 'Highlight',
			nodeName: 'Highlight',
			markName: 'HighlightMark',
			delimChar: CharCode.Equal,
			isDouble: true,
			after: 'Emphasis'
		})
	]
};

export default Highlight;
