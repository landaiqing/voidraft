import { Extension } from '@codemirror/state';
import { blockquote } from './plugins/blockquote';
import { codeblock } from './plugins/code-block';
import { headings } from './plugins/heading';
import { hideMarks } from './plugins/hide-mark';
import { htmlBlockExtension } from './plugins/html';
import { image } from './plugins/image';
import { links } from './plugins/link';
import { lists } from './plugins/list';
import { headingSlugField } from './state/heading-slug';
import { imagePreview } from './state/image';

// New enhanced features
import { codeblockEnhanced } from './plugins/code-block-enhanced';
import { emoji } from './plugins/emoji';
import { horizontalRule } from './plugins/horizontal-rule';
import { revealOnArrow } from './plugins/reveal-on-arrow';
import { pasteRichText } from './plugins/paste-rich-text';

// State fields
export { headingSlugField } from './state/heading-slug';
export { imagePreview } from './state/image';

// Core Extensions
export { blockquote } from './plugins/blockquote';
export { codeblock } from './plugins/code-block';
export { frontmatter } from './plugins/frontmatter';
export { headings } from './plugins/heading';
export { hideMarks } from './plugins/hide-mark';
export { image } from './plugins/image';
export { htmlBlock, htmlBlockExtension } from './plugins/html';
export { links } from './plugins/link';
export { lists } from './plugins/list';

// Enhanced Extensions
export { codeblockEnhanced } from './plugins/code-block-enhanced';
export { emoji, addEmoji, getEmojiNames } from './plugins/emoji';
export { horizontalRule } from './plugins/horizontal-rule';
export { revealOnArrow } from './plugins/reveal-on-arrow';
export { pasteRichText } from './plugins/paste-rich-text';

// Classes
export * as classes from './classes';


/**
 * markdown extensions (includes all ProseMark-inspired features).
 * NOTE: All decorations avoid using block: true to prevent interfering
 * with the codeblock system's boundary calculations.
 */
export const markdownExtensions: Extension = [
	headingSlugField,
	imagePreview,
	blockquote(),
	codeblock(),
	headings(),
	hideMarks(),
	lists(),
	links(),
	image(),
	htmlBlockExtension,
	// Enhanced features
	codeblockEnhanced(),
	emoji(),
	horizontalRule(),
	revealOnArrow(),
	pasteRichText()
];

export default markdownExtensions;
