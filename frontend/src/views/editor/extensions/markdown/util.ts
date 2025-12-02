import { Decoration } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import type { InlineContext, InlineParser } from '@lezer/markdown';

/**
 * ASCII character codes for common delimiters.
 */
export const enum CharCode {
	Space = 32,
	Tab = 9,
	Newline = 10,
	Backslash = 92,
	Dollar = 36,       // $
	Plus = 43,         // +
	Equal = 61,        // =
	OpenBracket = 91,  // [
	CloseBracket = 93, // ]
	Caret = 94,        // ^
	Colon = 58,        // :
	Hyphen = 45,       // -
	Underscore = 95,   // _
}

/**
 * Pre-computed lookup table for footnote ID characters.
 * Valid characters: 0-9, A-Z, a-z, _, -
 * Uses Uint8Array for memory efficiency and O(1) lookup.
 */
const FOOTNOTE_ID_CHARS = new Uint8Array(128);
// Initialize lookup table (0-9: 48-57, A-Z: 65-90, a-z: 97-122, _: 95, -: 45)
for (let i = 48; i <= 57; i++) FOOTNOTE_ID_CHARS[i] = 1;  // 0-9
for (let i = 65; i <= 90; i++) FOOTNOTE_ID_CHARS[i] = 1;  // A-Z
for (let i = 97; i <= 122; i++) FOOTNOTE_ID_CHARS[i] = 1; // a-z
FOOTNOTE_ID_CHARS[95] = 1; // _
FOOTNOTE_ID_CHARS[45] = 1; // -

/**
 * O(1) check if a character is valid for footnote ID.
 * @param code - ASCII character code
 * @returns True if valid footnote ID character
 */
export function isFootnoteIdChar(code: number): boolean {
	return code < 128 && FOOTNOTE_ID_CHARS[code] === 1;
}

/**
 * Configuration for paired delimiter parser factory.
 */
export interface PairedDelimiterConfig {
	/** Parser name */
	name: string;
	/** Node name for the container element */
	nodeName: string;
	/** Node name for the delimiter marks */
	markName: string;
	/** First delimiter character code */
	delimChar: number;
	/** Whether delimiter is doubled (e.g., == vs =) */
	isDouble: true;
	/** Whether to allow newlines in content */
	allowNewlines?: boolean;
	/** Parse order - after which parser */
	after?: string;
	/** Parse order - before which parser */
	before?: string;
}

/**
 * Factory function to create a paired delimiter inline parser.
 * Optimized with:
 * - Fast path early return
 * - Minimal function calls in loop
 * - Pre-computed delimiter length
 * 
 * @param config - Parser configuration
 * @returns InlineParser for MarkdownConfig
 */
export function createPairedDelimiterParser(config: PairedDelimiterConfig): InlineParser {
	const { name, nodeName, markName, delimChar, allowNewlines = false, after, before } = config;
	const delimLen = 2; // Always double delimiter for these parsers

	return {
		name,
		parse(cx: InlineContext, next: number, pos: number): number {
			// Fast path: check first character
			if (next !== delimChar) return -1;

			// Check second delimiter character
			if (cx.char(pos + 1) !== delimChar) return -1;

			// Don't match triple delimiter (e.g., ===, +++)
			if (cx.char(pos + 2) === delimChar) return -1;

			// Calculate search bounds
			const searchEnd = cx.end - 1;
			const contentStart = pos + delimLen;

			// Look for closing delimiter
			for (let i = contentStart; i < searchEnd; i++) {
				const char = cx.char(i);

				// Check for newline (unless allowed)
				if (!allowNewlines && char === CharCode.Newline) return -1;

				// Found potential closing delimiter
				if (char === delimChar && cx.char(i + 1) === delimChar) {
					// Don't match triple delimiter
					if (i + 2 < cx.end && cx.char(i + 2) === delimChar) continue;

					// Create element with marks
					return cx.addElement(cx.elt(nodeName, pos, i + delimLen, [
						cx.elt(markName, pos, contentStart),
						cx.elt(markName, i, i + delimLen)
					]));
				}
			}

			return -1;
		},
		...(after && { after }),
		...(before && { before })
	};
}


/**
 * Tuple representation of a range [from, to].
 */
export type RangeTuple = [number, number];

/**
 * Check if two ranges overlap (touch or intersect).
 * Based on the visual diagram on https://stackoverflow.com/a/25369187
 *
 * @param range1 - First range
 * @param range2 - Second range
 * @returns True if the ranges overlap
 */
export function checkRangeOverlap(
	range1: RangeTuple,
	range2: RangeTuple
): boolean {
	return range1[0] <= range2[1] && range2[0] <= range1[1];
}

/**
 * Check if any of the editor cursors is in the given range.
 *
 * @param state - Editor state
 * @param range - Range to check
 * @returns True if the cursor is in the range
 */
export function isCursorInRange(
	state: EditorState,
	range: RangeTuple
): boolean {
	return state.selection.ranges.some((selection) =>
		checkRangeOverlap(range, [selection.from, selection.to])
	);
}

/**
 * Decoration to simply hide anything (replace with nothing).
 */
export const invisibleDecoration = Decoration.replace({});


/**
 * Class for generating unique slugs from heading contents.
 */
export class Slugger {
	/** Occurrences for each slug. */
	private occurrences: Map<string, number> = new Map();

	/**
	 * Generate a slug from the given content.
	 *
	 * @param text - Content to generate the slug from
	 * @returns The generated slug
	 */
	public slug(text: string): string {
		let slug = text
			.toLowerCase()
			.replace(/\s+/g, '-')
			.replace(/[^\w-]+/g, '');

		const count = this.occurrences.get(slug) || 0;
		if (count > 0) {
			slug += '-' + count;
		}
		this.occurrences.set(slug, count + 1);

		return slug;
	}

	/**
	 * Reset the slugger state.
	 */
	public reset(): void {
		this.occurrences.clear();
	}
}
