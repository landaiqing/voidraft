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

import { MarkdownConfig, Line, BlockContext } from '@lezer/markdown';

/**
 * ASCII character codes for parsing.
 */
const enum Ch {
	OpenBracket = 91,    // [
	CloseBracket = 93,   // ]
	Caret = 94,          // ^
	Colon = 58,          // :
	Space = 32,
	Tab = 9,
	Newline = 10,
}

/**
 * Check if a character is valid for footnote ID.
 * Allows: letters, numbers, underscore, hyphen
 */
function isFootnoteIdChar(code: number): boolean {
	return (
		(code >= 48 && code <= 57) ||   // 0-9
		(code >= 65 && code <= 90) ||   // A-Z
		(code >= 97 && code <= 122) ||  // a-z
		code === 95 ||                   // _
		code === 45                      // -
	);
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
		// Inline footnote must be parsed before Superscript to handle ^[ pattern
		{
			name: 'InlineFootnote',
			parse(cx, next, pos) {
				// Check for ^[ pattern
				if (next !== Ch.Caret || cx.char(pos + 1) !== Ch.OpenBracket) {
					return -1;
				}

				// Find the closing ]
				// Content can contain any characters except unbalanced brackets and newlines
				let end = pos + 2;
				let bracketDepth = 1; // We're inside one [
				let hasContent = false;

				while (end < cx.end) {
					const char = cx.char(end);

					// Don't allow newlines in inline footnotes
					if (char === Ch.Newline) {
						return -1;
					}

					// Track bracket depth for nested brackets
					if (char === Ch.OpenBracket) {
						bracketDepth++;
					} else if (char === Ch.CloseBracket) {
						bracketDepth--;
						if (bracketDepth === 0) {
							// Found the closing bracket
							if (!hasContent) {
								return -1; // Empty inline footnote
							}

							// Create the element with marks and content
							const children = [
								// Opening mark ^[
								cx.elt('InlineFootnoteMark', pos, pos + 2),
								// Content
								cx.elt('InlineFootnoteContent', pos + 2, end),
								// Closing mark ]
								cx.elt('InlineFootnoteMark', end, end + 1),
							];

							const element = cx.elt('InlineFootnote', pos, end + 1, children);
							return cx.addElement(element);
						}
					} else {
						hasContent = true;
					}

					end++;
				}

				return -1;
			},
			// Parse before Superscript to avoid ^[ being misinterpreted
			before: 'Superscript',
		},
		{
			name: 'FootnoteReference',
			parse(cx, next, pos) {
				// Check for [^ pattern
				if (next !== Ch.OpenBracket || cx.char(pos + 1) !== Ch.Caret) {
					return -1;
				}

				// Find the closing ]
				let end = pos + 2;
				let hasValidId = false;

				while (end < cx.end) {
					const char = cx.char(end);

					// Found closing bracket
					if (char === Ch.CloseBracket) {
						if (!hasValidId) {
							return -1; // Empty footnote reference
						}

						// Create the element with marks and label
						const children = [
							// Opening mark [^
							cx.elt('FootnoteReferenceMark', pos, pos + 2),
							// Label (the id)
							cx.elt('FootnoteReferenceLabel', pos + 2, end),
							// Closing mark ]
							cx.elt('FootnoteReferenceMark', end, end + 1),
						];

						const element = cx.elt('FootnoteReference', pos, end + 1, children);
						return cx.addElement(element);
					}

					// Don't allow newlines
					if (char === Ch.Newline) {
						return -1;
					}

					// Validate id characters
					if (isFootnoteIdChar(char)) {
						hasValidId = true;
					} else {
						// Invalid character in footnote id
						return -1;
					}

					end++;
				}

				return -1;
			},
			// Parse before links to avoid conflicts
			before: 'Link',
		},
	],

	parseBlock: [
		{
			name: 'FootnoteDefinition',
			parse(cx: BlockContext, line: Line): boolean {
				// Must start at the beginning of a line
				// Check for [^ pattern
				const text = line.text;
				if (text.charCodeAt(0) !== Ch.OpenBracket ||
					text.charCodeAt(1) !== Ch.Caret) {
					return false;
				}

				// Find ]: pattern
				let labelEnd = 2;
				while (labelEnd < text.length) {
					const char = text.charCodeAt(labelEnd);

					if (char === Ch.CloseBracket) {
						// Check for : after ]
						if (labelEnd + 1 < text.length &&
							text.charCodeAt(labelEnd + 1) === Ch.Colon) {
							break;
						}
						return false;
					}

					if (!isFootnoteIdChar(char)) {
						return false;
					}

					labelEnd++;
				}

				// Must have found ]:
				if (labelEnd >= text.length ||
					text.charCodeAt(labelEnd) !== Ch.CloseBracket ||
					text.charCodeAt(labelEnd + 1) !== Ch.Colon) {
					return false;
				}

				// Calculate positions
				const start = cx.lineStart;
				const openMarkEnd = start + 2; // [^
				const labelStart = openMarkEnd;
				const labelEndPos = start + labelEnd;
				const closeMarkStart = labelEndPos;
				const closeMarkEnd = start + labelEnd + 2; // ]:
				const contentStart = closeMarkEnd;

				// Skip optional space after :
				let contentOffset = labelEnd + 2;
				if (contentOffset < text.length &&
					(text.charCodeAt(contentOffset) === Ch.Space ||
						text.charCodeAt(contentOffset) === Ch.Tab)) {
					contentOffset++;
				}

				// Build the element
				const children = [
					// Opening mark [^
					cx.elt('FootnoteDefinitionMark', start, openMarkEnd),
					// Label
					cx.elt('FootnoteDefinitionLabel', labelStart, labelEndPos),
					// Closing mark ]:
					cx.elt('FootnoteDefinitionMark', closeMarkStart, closeMarkEnd),
				];

				// Add content if present
				const contentText = text.slice(contentOffset);
				if (contentText.length > 0) {
					children.push(
						cx.elt('FootnoteDefinitionContent', start + contentOffset, start + text.length)
					);
				}

				// Create the block element
				const element = cx.elt('FootnoteDefinition', start, start + text.length, children);
				cx.addElement(element);

				// Move to next line
				cx.nextLine();
				return true;
			},
			// Parse before other block elements
			before: 'LinkReference',
		},
	],
};

export default Footnote;

