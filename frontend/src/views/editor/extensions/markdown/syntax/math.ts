/**
 * Math extension for Lezer Markdown parser.
 * 
 * Parses LaTeX math syntax:
 * - Inline math: $E=mc^2$ → renders as inline formula
 * - Block math: $$...$$ → renders as block formula (can be multi-line)
 */

import { MarkdownConfig, InlineContext } from '@lezer/markdown';
import { CharCode } from '../util';

/**
 * Parse block math ($$...$$).
 * Allows multi-line content and handles escaped $.
 * 
 * @param cx - Inline context
 * @param pos - Start position (at first $)
 * @returns Position after element, or -1 if no match
 */
function parseBlockMath(cx: InlineContext, pos: number): number {
	const end = cx.end;
	
	// Don't match $$$ or more
	if (cx.char(pos + 2) === CharCode.Dollar) return -1;

	// Minimum: $$ + content + $$ = at least 5 chars
	const minEnd = pos + 4;
	if (end < minEnd) return -1;

	// Search for closing $$
	const searchEnd = end - 1;
	for (let i = pos + 2; i < searchEnd; i++) {
		const char = cx.char(i);

		// Skip escaped $ (backslash followed by any char)
		if (char === CharCode.Backslash) {
			i++; // Skip next char
			continue;
		}

		// Found potential closing $$
		if (char === CharCode.Dollar) {
			const nextChar = cx.char(i + 1);
			if (nextChar !== CharCode.Dollar) continue;
			
			// Don't match $$$
			if (i + 2 < end && cx.char(i + 2) === CharCode.Dollar) continue;

			// Ensure content exists
			if (i === pos + 2) return -1;

			// Create element with marks
			return cx.addElement(cx.elt('BlockMath', pos, i + 2, [
				cx.elt('BlockMathMark', pos, pos + 2),
				cx.elt('BlockMathMark', i, i + 2)
			]));
		}
	}

	return -1;
}

/**
 * Parse inline math ($...$).
 * Single line only, handles escaped $.
 * 
 * @param cx - Inline context
 * @param pos - Start position (at $)
 * @returns Position after element, or -1 if no match
 */
function parseInlineMath(cx: InlineContext, pos: number): number {
	const end = cx.end;

	// Don't match if preceded by backslash (escaped)
	if (pos > 0 && cx.char(pos - 1) === CharCode.Backslash) return -1;

	// Minimum: $ + content + $ = at least 3 chars
	if (end < pos + 2) return -1;

	// Search for closing $
	for (let i = pos + 1; i < end; i++) {
		const char = cx.char(i);

		// Newline not allowed in inline math
		if (char === CharCode.Newline) return -1;

		// Skip escaped $
		if (char === CharCode.Backslash && i + 1 < end && cx.char(i + 1) === CharCode.Dollar) {
			i++; // Skip next char
			continue;
		}

		// Found potential closing $
		if (char === CharCode.Dollar) {
			// Don't match $$
			if (i + 1 < end && cx.char(i + 1) === CharCode.Dollar) continue;

			// Ensure content exists
			if (i === pos + 1) return -1;

			// Create element with marks
			return cx.addElement(cx.elt('InlineMath', pos, i + 1, [
				cx.elt('InlineMathMark', pos, pos + 1),
				cx.elt('InlineMathMark', i, i + 1)
			]));
		}
	}

	return -1;
}

/**
 * Math extension for Lezer Markdown.
 * 
 * Defines:
 * - InlineMath: Inline math formula $...$
 * - InlineMathMark: The $ delimiter marks for inline
 * - BlockMath: Block math formula $$...$$
 * - BlockMathMark: The $$ delimiter marks for block
 */
export const Math: MarkdownConfig = {
	defineNodes: [
		{ name: 'InlineMath' },
		{ name: 'InlineMathMark' },
		{ name: 'BlockMath' },
		{ name: 'BlockMathMark' }
	],
	parseInline: [
		{
			name: 'Math',
			parse(cx, next, pos) {
				// Fast path: must start with $
				if (next !== CharCode.Dollar) return -1;

				// Check for $$ (block math) vs $ (inline math)
				const isBlock = cx.char(pos + 1) === CharCode.Dollar;
				
				return isBlock ? parseBlockMath(cx, pos) : parseInlineMath(cx, pos);
			},
			// Parse after emphasis to avoid conflicts
			after: 'Emphasis'
		}
	]
};

export default Math;
