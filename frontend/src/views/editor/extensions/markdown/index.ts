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
import { codeblockEnhanced } from './plugins/code-block-enhanced';
import { emoji } from './plugins/emoji';
import { horizontalRule } from './plugins/horizontal-rule';
import { inlineCode } from './plugins/inline-code';
import { subscriptSuperscript } from './plugins/subscript-superscript';
import { highlight } from './plugins/highlight';
import { mermaidPreview } from './plugins/mermaid';


/**
 * markdown extensions
 */
export const markdownExtensions: Extension = [
	headingSlugField,
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
	inlineCode(),
	subscriptSuperscript(),
	highlight(),
	mermaidPreview(),
];

export default markdownExtensions;
