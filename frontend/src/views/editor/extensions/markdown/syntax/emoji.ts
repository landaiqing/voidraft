/**
 * Emoji extension for Lezer Markdown parser.
 *
 * Parses :emoji_name: syntax for emoji shortcodes.
 *
 * Syntax: :emoji_name: → renders as actual emoji character
 *
 * Examples:
 * - :smile: → 😄
 * - :heart: → ❤️
 * - :+1: → 👍
 */

import { MarkdownConfig, InlineContext } from '@lezer/markdown';
import { CharCode } from '../util';
import { emojies } from '@/common/constant/emojies';

/**
 * Pre-computed lookup table for emoji name characters.
 * Valid characters: a-z, 0-9, _, +, -
 * Uses Uint8Array for memory efficiency and O(1) lookup.
 */
const EMOJI_NAME_CHARS = new Uint8Array(128);
// Initialize lookup table
for (let i = 48; i <= 57; i++) EMOJI_NAME_CHARS[i] = 1;   // 0-9
for (let i = 97; i <= 122; i++) EMOJI_NAME_CHARS[i] = 1;  // a-z
EMOJI_NAME_CHARS[95] = 1;  // _
EMOJI_NAME_CHARS[43] = 1;  // +
EMOJI_NAME_CHARS[45] = 1;  // -

/**
 * O(1) check if a character is valid for emoji name.
 * @param code - ASCII character code
 * @returns True if valid emoji name character
 */
function isEmojiNameChar(code: number): boolean {
	return code < 128 && EMOJI_NAME_CHARS[code] === 1;
}

/**
 * Parse emoji :name: syntax.
 *
 * @param cx - Inline context
 * @param pos - Start position (at :)
 * @returns Position after element, or -1 if no match
 */
function parseEmoji(cx: InlineContext, pos: number): number {
	const end = cx.end;

	// Minimum: : + name + : = at least 3 chars, name must be non-empty
	if (end < pos + 2) return -1;

	// Track content for validation
	let hasContent = false;
	const contentStart = pos + 1;

	// Search for closing :
	for (let i = contentStart; i < end; i++) {
		const char = cx.char(i);

		// Found closing :
		if (char === CharCode.Colon) {
			// Must have content
			if (!hasContent) return -1;

			// Extract and validate emoji name
			const name = cx.slice(contentStart, i).toLowerCase();
			
			// Check if this is a valid emoji
			if (!emojies[name]) return -1;

			// Create element with marks and name
			return cx.addElement(cx.elt('Emoji', pos, i + 1, [
				cx.elt('EmojiMark', pos, contentStart),
				cx.elt('EmojiName', contentStart, i),
				cx.elt('EmojiMark', i, i + 1)
			]));
		}

		// Newline not allowed in emoji
		if (char === CharCode.Newline) return -1;

		// Space not allowed in emoji name
		if (char === CharCode.Space || char === CharCode.Tab) return -1;

		// Validate name character using O(1) lookup table
		// Also check for uppercase A-Z (65-90) and convert mentally
		const lowerChar = char >= 65 && char <= 90 ? char + 32 : char;
		if (isEmojiNameChar(lowerChar)) {
			hasContent = true;
		} else {
			return -1;
		}
	}

	return -1;
}

/**
 * Emoji extension for Lezer Markdown.
 *
 * Defines:
 * - Emoji: The container node for emoji shortcode
 * - EmojiMark: The : delimiter marks
 * - EmojiName: The emoji name part
 */
export const Emoji: MarkdownConfig = {
	defineNodes: [
		{ name: 'Emoji' },
		{ name: 'EmojiMark' },
		{ name: 'EmojiName' }
	],
	parseInline: [
		{
			name: 'Emoji',
			parse(cx, next, pos) {
				// Fast path: must start with :
				if (next !== CharCode.Colon) return -1;
				return parseEmoji(cx, pos);
			},
			// Parse after emphasis to avoid conflicts with other syntax
			after: 'Emphasis'
		}
	]
};

export default Emoji;
