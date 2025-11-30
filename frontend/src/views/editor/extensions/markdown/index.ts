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
import { emoji } from './plugins/emoji';
import { horizontalRule } from './plugins/horizontal-rule';
import { inlineCode } from './plugins/inline-code';
import { subscriptSuperscript } from './plugins/subscript-superscript';
import { highlight } from './plugins/highlight';
import { table } from './plugins/table';


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
	emoji(),
	horizontalRule(),
	inlineCode(),
	subscriptSuperscript(),
	highlight(),
	table(),
];

export default markdownExtensions;
