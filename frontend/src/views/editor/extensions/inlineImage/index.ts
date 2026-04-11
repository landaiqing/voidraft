import {Facet, type Extension} from '@codemirror/state';
import {createInlineImageDropExtension} from './clipboardIntegration';
import {createInlineImageWidgetExtension} from './inlineImage';
import type {InlineImageOptions} from './types';

const DEFAULT_OPTIONS = {
  maxDisplayHeight: 200,
} as const satisfies InlineImageOptions;

function createDefaultOptions(): InlineImageOptions {
  return {
    ...DEFAULT_OPTIONS,
  };
}

function mergeOptions(
  base: InlineImageOptions,
  patch: Partial<InlineImageOptions>,
): InlineImageOptions {
  return {
    ...base,
    ...patch,
  };
}

export const inlineImageEnabledFacet = Facet.define<boolean, boolean>({
  combine: values => values.some(Boolean),
});

export const inlineImageOptionsFacet = Facet.define<Partial<InlineImageOptions>, InlineImageOptions>({
  combine: values =>
    values.reduce<InlineImageOptions>(
      (merged, value) => mergeOptions(merged, value),
      createDefaultOptions(),
    ),
});

export function createInlineImageExtension(options: Partial<InlineImageOptions> = {}): Extension {
  const resolvedOptions = mergeOptions(createDefaultOptions(), options);

  return [
    inlineImageEnabledFacet.of(true),
    inlineImageOptionsFacet.of(options),
    createInlineImageWidgetExtension(),
    createInlineImageDropExtension(resolvedOptions.maxDisplayHeight),
  ];
}

export default createInlineImageExtension;
