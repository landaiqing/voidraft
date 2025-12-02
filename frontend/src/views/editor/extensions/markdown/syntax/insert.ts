/**
 * Insert extension for Lezer Markdown parser.
 * 
 * Parses ++insert++ syntax for inserted/underlined text.
 * 
 * Syntax: ++text++ → renders as inserted text (underline)
 * 
 * Example:
 * - This is ++inserted++ text → This is <ins>inserted</ins> text
 */

import { MarkdownConfig } from '@lezer/markdown';
import { CharCode, createPairedDelimiterParser } from '../util';

/**
 * Insert extension for Lezer Markdown.
 * 
 * Uses optimized factory function for O(n) single-pass parsing.
 * 
 * Defines:
 * - Insert: The container node for inserted content
 * - InsertMark: The ++ delimiter marks
 */
export const Insert: MarkdownConfig = {
	defineNodes: [
		{ name: 'Insert' },
		{ name: 'InsertMark' }
	],
	parseInline: [
		createPairedDelimiterParser({
			name: 'Insert',
			nodeName: 'Insert',
			markName: 'InsertMark',
			delimChar: CharCode.Plus,
			isDouble: true,
			after: 'Emphasis'
		})
	]
};

export default Insert;
