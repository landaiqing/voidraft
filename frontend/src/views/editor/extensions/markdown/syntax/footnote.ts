/**
 * Footnote extension for Lezer Markdown parser.
 *
 * Parses footnote syntax compatible with MultiMarkdown/PHP Markdown Extra.
 *
 * Syntax:
 * - Footnote reference: [^id] or [^1]
 * - Footnote definition: [^id]: content (at line start)
 * - Inline footnote: ^[content] (content is inline, no separate definition needed)
 *
 * Examples:
 * - This is text[^1] with a footnote.
 * - [^1]: This is the footnote content.
 * - This is text^[inline footnote content] with inline footnote.
 */

import { MarkdownConfig, Line, BlockContext, InlineContext } from '@lezer/markdown';
import { CharCode, isFootnoteIdChar } from '../util';

/**
 * Parse inline footnote ^[content].
 * 
 * @param cx - Inline context
 * @param pos - Start position (at ^)
 * @returns Position after element, or -1 if no match
 */
function parseInlineFootnote(cx: InlineContext, pos: number): number {
	const end = cx.end;

	// Minimum: ^[ + content + ] = at least 4 chars
	if (end < pos + 3) return -1;

	// Track bracket depth for nested brackets
	let bracketDepth = 1;
	let hasContent = false;
	const contentStart = pos + 2;

	for (let i = contentStart; i < end; i++) {
		const char = cx.char(i);

		// Don't allow newlines
		if (char === CharCode.Newline) return -1;

		// Track bracket depth
		if (char === CharCode.OpenBracket) {
			bracketDepth++;
		} else if (char === CharCode.CloseBracket) {
			bracketDepth--;
			if (bracketDepth === 0) {
				// Found closing bracket - must have content
				if (!hasContent) return -1;

				// Create element with marks and content
				return cx.addElement(cx.elt('InlineFootnote', pos, i + 1, [
					cx.elt('InlineFootnoteMark', pos, contentStart),
					cx.elt('InlineFootnoteContent', contentStart, i),
					cx.elt('InlineFootnoteMark', i, i + 1)
				]));
			}
		} else {
			hasContent = true;
		}
	}

	return -1;
}

/**
 * Parse footnote reference [^id].
 * 
 * @param cx - Inline context
 * @param pos - Start position (at [)
 * @returns Position after element, or -1 if no match
 */
function parseFootnoteReference(cx: InlineContext, pos: number): number {
	const end = cx.end;

	// Minimum: [^ + id + ] = at least 4 chars
	if (end < pos + 3) return -1;

	let hasValidId = false;
	const labelStart = pos + 2;

	for (let i = labelStart; i < end; i++) {
		const char = cx.char(i);

		// Found closing bracket
		if (char === CharCode.CloseBracket) {
			if (!hasValidId) return -1;

			// Create element with marks and label
			return cx.addElement(cx.elt('FootnoteReference', pos, i + 1, [
				cx.elt('FootnoteReferenceMark', pos, labelStart),
				cx.elt('FootnoteReferenceLabel', labelStart, i),
				cx.elt('FootnoteReferenceMark', i, i + 1)
			]));
		}

		// Don't allow newlines
		if (char === CharCode.Newline) return -1;

		// Validate id character using O(1) lookup table
		if (isFootnoteIdChar(char)) {
			hasValidId = true;
		} else {
			return -1;
		}
	}

	return -1;
}

/**
 * Parse footnote definition [^id]: content.
 * 
 * @param cx - Block context
 * @param line - Current line
 * @returns True if parsed successfully
 */
function parseFootnoteDefinition(cx: BlockContext, line: Line): boolean {
	const text = line.text;
	const len = text.length;

	// Minimum: [^id]: = at least 5 chars
	if (len < 5) return false;

	// Find ]: pattern - use O(1) lookup for ID chars
	let labelEnd = 2;
	while (labelEnd < len) {
		const char = text.charCodeAt(labelEnd);

		if (char === CharCode.CloseBracket) {
			// Check for : after ]
			if (labelEnd + 1 < len && text.charCodeAt(labelEnd + 1) === CharCode.Colon) {
				break;
			}
			return false;
		}

		// Use O(1) lookup table
		if (!isFootnoteIdChar(char)) return false;

		labelEnd++;
	}

	// Validate ]: was found
	if (labelEnd >= len ||
		text.charCodeAt(labelEnd) !== CharCode.CloseBracket ||
		text.charCodeAt(labelEnd + 1) !== CharCode.Colon) {
		return false;
	}

	// Calculate positions (all at once to avoid repeated arithmetic)
	const start = cx.lineStart;
	const openMarkEnd = start + 2;
	const labelEndPos = start + labelEnd;
	const closeMarkEnd = start + labelEnd + 2;

	// Skip optional space after :
	let contentOffset = labelEnd + 2;
	if (contentOffset < len) {
		const spaceChar = text.charCodeAt(contentOffset);
		if (spaceChar === CharCode.Space || spaceChar === CharCode.Tab) {
			contentOffset++;
		}
	}

	// Build children array
	const children = [
		cx.elt('FootnoteDefinitionMark', start, openMarkEnd),
		cx.elt('FootnoteDefinitionLabel', openMarkEnd, labelEndPos),
		cx.elt('FootnoteDefinitionMark', labelEndPos, closeMarkEnd)
	];

	// Add content if present
	if (contentOffset < len) {
		children.push(cx.elt('FootnoteDefinitionContent', start + contentOffset, start + len));
	}

	// Create and add block element
	cx.addElement(cx.elt('FootnoteDefinition', start, start + len, children));
	cx.nextLine();
	return true;
}

/**
 * Footnote extension for Lezer Markdown.
 *
 * Defines nodes:
 * - FootnoteReference: Inline reference [^id]
 * - FootnoteReferenceMark: The [^ and ] delimiters
 * - FootnoteReferenceLabel: The id part
 * - FootnoteDefinition: Block definition [^id]: content
 * - FootnoteDefinitionMark: The [^, ]: delimiters
 * - FootnoteDefinitionLabel: The id part in definition
 * - FootnoteDefinitionContent: The content part
 * - InlineFootnote: Inline footnote ^[content]
 * - InlineFootnoteMark: The ^[ and ] delimiters
 * - InlineFootnoteContent: The content part
 */
export const Footnote: MarkdownConfig = {
	defineNodes: [
		// Inline reference nodes
		{ name: 'FootnoteReference' },
		{ name: 'FootnoteReferenceMark' },
		{ name: 'FootnoteReferenceLabel' },
		// Block definition nodes
		{ name: 'FootnoteDefinition', block: true },
		{ name: 'FootnoteDefinitionMark' },
		{ name: 'FootnoteDefinitionLabel' },
		{ name: 'FootnoteDefinitionContent' },
		// Inline footnote nodes
		{ name: 'InlineFootnote' },
		{ name: 'InlineFootnoteMark' },
		{ name: 'InlineFootnoteContent' },
	],

	parseInline: [
		{
			name: 'InlineFootnote',
			parse(cx, next, pos) {
				// Fast path: must start with ^[
				if (next !== CharCode.Caret || cx.char(pos + 1) !== CharCode.OpenBracket) {
					return -1;
				}
				return parseInlineFootnote(cx, pos);
			},
			before: 'Superscript',
		},
		{
			name: 'FootnoteReference',
			parse(cx, next, pos) {
				// Fast path: must start with [^
				if (next !== CharCode.OpenBracket || cx.char(pos + 1) !== CharCode.Caret) {
					return -1;
				}
				return parseFootnoteReference(cx, pos);
			},
			before: 'Link',
		},
	],

	parseBlock: [
		{
			name: 'FootnoteDefinition',
			parse(cx: BlockContext, line: Line): boolean {
				// Fast path: must start with [^
				if (line.text.charCodeAt(0) !== CharCode.OpenBracket ||
					line.text.charCodeAt(1) !== CharCode.Caret) {
					return false;
				}
				return parseFootnoteDefinition(cx, line);
			},
			before: 'LinkReference',
		},
	],
};

export default Footnote;
