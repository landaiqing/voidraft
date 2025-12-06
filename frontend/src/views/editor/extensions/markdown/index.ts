import { Extension } from '@codemirror/state';
import { image } from './plugins/image';
import { headingSlugField } from './state/heading-slug';
import {html} from './plugins/html';
import { render } from './plugins/render';
import { Theme } from './plugins/theme';

/**
 * Markdown extensions.
 */
export const markdownExtensions: Extension = [
	headingSlugField,
	render(),
    Theme,
	image(),
    html()
];

export default markdownExtensions;
