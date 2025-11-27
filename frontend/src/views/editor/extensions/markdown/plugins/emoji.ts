import { Extension } from '@codemirror/state';
import {
	ViewPlugin,
	DecorationSet,
	Decoration,
	EditorView,
	ViewUpdate,
	WidgetType
} from '@codemirror/view';
import { isCursorInRange, iterateTreeInVisibleRanges } from '../util';

/**
 * Emoji plugin that converts :emoji_name: to actual emoji characters.
 *
 * This plugin:
 * - Detects emoji patterns like :smile:, :heart:, etc.
 * - Replaces them with actual emoji characters
 * - Shows the original text when cursor is nearby
 */
export const emoji = (): Extension => [emojiPlugin, baseTheme];

/**
 * Common emoji mappings.
 * Extended from common emoji shortcodes.
 */
const EMOJI_MAP: { [key: string]: string } = {
	// Smileys & Emotion
	smile: '😄',
	smiley: '😃',
	grin: '😁',
	laughing: '😆',
	satisfied: '😆',
	sweat_smile: '😅',
	rofl: '🤣',
	joy: '😂',
	slightly_smiling_face: '🙂',
	upside_down_face: '🙃',
	wink: '😉',
	blush: '😊',
	innocent: '😇',
	smiling_face_with_three_hearts: '🥰',
	heart_eyes: '😍',
	star_struck: '🤩',
	kissing_heart: '😘',
	kissing: '😗',
	relaxed: '☺️',
	kissing_closed_eyes: '😚',
	kissing_smiling_eyes: '😙',
	smiling_face_with_tear: '🥲',
	yum: '😋',
	stuck_out_tongue: '😛',
	stuck_out_tongue_winking_eye: '😜',
	zany_face: '🤪',
	stuck_out_tongue_closed_eyes: '😝',
	money_mouth_face: '🤑',
	hugs: '🤗',
	hand_over_mouth: '🤭',
	shushing_face: '🤫',
	thinking: '🤔',
	zipper_mouth_face: '🤐',
	raised_eyebrow: '🤨',
	neutral_face: '😐',
	expressionless: '😑',
	no_mouth: '😶',
	smirk: '😏',
	unamused: '😒',
	roll_eyes: '🙄',
	grimacing: '😬',
	lying_face: '🤥',
	relieved: '😌',
	pensive: '😔',
	sleepy: '😪',
	drooling_face: '🤤',
	sleeping: '😴',

	// Hearts
	heart: '❤️',
	orange_heart: '🧡',
	yellow_heart: '💛',
	green_heart: '💚',
	blue_heart: '💙',
	purple_heart: '💜',
	brown_heart: '🤎',
	black_heart: '🖤',
	white_heart: '🤍',

	// Gestures
	'+1': '👍',
	thumbsup: '👍',
	'-1': '👎',
	thumbsdown: '👎',
	fist: '✊',
	facepunch: '👊',
	punch: '👊',
	wave: '👋',
	clap: '👏',
	raised_hands: '🙌',
	pray: '🙏',
	handshake: '🤝',

	// Nature
	sun: '☀️',
	moon: '🌙',
	star: '⭐',
	fire: '🔥',
	zap: '⚡',
	sparkles: '✨',
	tada: '🎉',
	rocket: '🚀',
	trophy: '🏆',

	// Symbols
	check: '✔️',
	x: '❌',
	warning: '⚠️',
	bulb: '💡',
	question: '❓',
	exclamation: '❗',
	heavy_check_mark: '✔️',
	
	// Common
	eyes: '👀',
	eye: '👁️',
	brain: '🧠',
	muscle: '💪',
	ok_hand: '👌',
	point_right: '👉',
	point_left: '👈',
	point_up: '☝️',
	point_down: '👇',
};

/**
 * Widget to display emoji character.
 */
class EmojiWidget extends WidgetType {
	constructor(readonly emoji: string) {
		super();
	}

	eq(other: EmojiWidget) {
		return other.emoji === this.emoji;
	}

	toDOM(): HTMLElement {
		const span = document.createElement('span');
		span.className = 'cm-emoji';
		span.textContent = this.emoji;
		span.title = ':' + Object.keys(EMOJI_MAP).find(
			key => EMOJI_MAP[key] === this.emoji
		) + ':';
		return span;
	}
}

/**
 * Plugin to render emoji.
 */
class EmojiPlugin {
	decorations: DecorationSet;

	constructor(view: EditorView) {
		this.decorations = this.buildDecorations(view);
	}

	update(update: ViewUpdate) {
		if (update.docChanged || update.viewportChanged || update.selectionSet) {
			this.decorations = this.buildDecorations(update.view);
		}
	}

	private buildDecorations(view: EditorView): DecorationSet {
		const widgets: Array<ReturnType<Decoration['range']>> = [];
		const doc = view.state.doc;

		for (const { from, to } of view.visibleRanges) {
			// Use regex to find :emoji: patterns
			const text = doc.sliceString(from, to);
			const emojiRegex = /:([a-z0-9_+\-]+):/g;
			let match;

			while ((match = emojiRegex.exec(text)) !== null) {
				const matchStart = from + match.index;
				const matchEnd = matchStart + match[0].length;

				// Skip if cursor is in this range
				if (isCursorInRange(view.state, [matchStart, matchEnd])) {
					continue;
				}

				const emojiName = match[1];
				const emojiChar = EMOJI_MAP[emojiName];

				if (emojiChar) {
					// Replace the :emoji: with the actual emoji
					const widget = Decoration.replace({
						widget: new EmojiWidget(emojiChar)
					});
					widgets.push(widget.range(matchStart, matchEnd));
				}
			}
		}

		return Decoration.set(widgets, true);
	}
}

const emojiPlugin = ViewPlugin.fromClass(EmojiPlugin, {
	decorations: (v) => v.decorations
});

/**
 * Base theme for emoji.
 */
const baseTheme = EditorView.baseTheme({
	'.cm-emoji': {
		fontSize: '1.2em',
		lineHeight: '1',
		verticalAlign: 'middle',
		cursor: 'default'
	}
});

/**
 * Add custom emoji to the map.
 * @param name - Emoji name (without colons)
 * @param emoji - Emoji character
 */
export function addEmoji(name: string, emoji: string): void {
	EMOJI_MAP[name] = emoji;
}

/**
 * Get all available emoji names.
 */
export function getEmojiNames(): string[] {
	return Object.keys(EMOJI_MAP);
}

