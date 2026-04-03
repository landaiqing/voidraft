import {EditorState, Extension, RangeSetBuilder, StateField} from '@codemirror/state';
import {
  Decoration,
  type DecorationSet,
  EditorView,
  highlightTrailingWhitespace,
  highlightWhitespace,
  WidgetType,
} from '@codemirror/view';
import {ExtensionName} from '@/../bindings/voidraft/internal/models/models';
import {createFontExtension} from '@/views/editor/basic/fontExtension';
import {createThemeByColors} from '@/views/editor/theme';
import {useConfigStore} from '@/stores/configStore';
import {useExtensionStore} from '@/stores/extensionStore';
import {useThemeStore} from '@/stores/themeStore';
import {blockState} from '../codeblock/state';
import {colorTheme, colorView} from '../colorSelector';
import {getCodeBlockLanguageExtension} from '../codeblock/lang-parser';
import {getMathBlockExtensions} from '../codeblock/mathBlock';
import type {Block, BlockAccess} from '../codeblock/types';
import {hyperLink} from '../hyperlink';
import {headingSlugField} from '../markdown/state/heading-slug';
import {render} from '../markdown/plugins/render';
import {Theme as markdownTheme} from '../markdown/plugins/theme';
import rainbowBrackets from '../rainbowBracket';
import type {BlockImageExportAppearance, BlockImageExportPreset} from './types';

class BlockStartWidget extends WidgetType {
  constructor(private readonly isFirst: boolean) {
    super();
  }

  override eq(other: BlockStartWidget): boolean {
    return this.isFirst === other.isFirst;
  }

  override toDOM(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = `code-block-start${this.isFirst ? ' first' : ''}`;
    return wrap;
  }

  override ignoreEvent(): boolean {
    return true;
  }
}

const BASE_CAPTURE_HIDDEN_SELECTORS = [
  '.cm-cursorLayer',
  '.cm-selectionLayer',
  '.cm-tooltip',
  '.cm-panels',
] as const;

type ExportContribution = {
  extension: Extension;
  hiddenSelectors?: readonly string[];
};

type ExportContributionFactory = (config: Record<string, any>) => ExportContribution;

const EXPORT_CONTRIBUTIONS = {
  [ExtensionName.Markdown]: () => ({
    extension: [headingSlugField, render(), markdownTheme],
    hiddenSelectors: ['.cm-code-block-copy-btn', '.cm-image-indicator', '.cm-html-indicator'],
  }),
  [ExtensionName.RainbowBrackets]: () => ({
    extension: rainbowBrackets(),
  }),
  [ExtensionName.Hyperlink]: () => ({
    extension: hyperLink,
    hiddenSelectors: ['.cm-hyper-link-icon'],
  }),
  [ExtensionName.ColorSelector]: () => ({
    extension: [colorView(false), colorTheme],
    hiddenSelectors: ['span[data-color] input[type="color"]'],
  }),
  [ExtensionName.HighlightWhitespace]: () => ({
    extension: highlightWhitespace(),
  }),
  [ExtensionName.HighlightTrailingWhitespace]: () => ({
    extension: highlightTrailingWhitespace(),
  }),
} satisfies Partial<Record<ExtensionName, ExportContributionFactory>>;

function createDelimiterPresentationDecorations(state: EditorState): DecorationSet {
  const blocks = state.field(blockState, false) ?? [];
  const builder = new RangeSetBuilder<Decoration>();

  for (const block of blocks) {
    if (block.delimiter.to <= block.delimiter.from) {
      continue;
    }

    const from = block.delimiter.from === 0 ? block.delimiter.from : block.delimiter.from + 1;
    const to = Math.max(from, block.delimiter.to - 1);
    builder.add(from, to, Decoration.replace({
      widget: new BlockStartWidget(block.delimiter.from === 0),
      inclusive: true,
      block: true,
      side: 0,
    }));
  }

  return builder.finish();
}

const delimiterPresentationField = StateField.define<DecorationSet>({
  create: createDelimiterPresentationDecorations,
  update(decorations, transaction) {
    if (transaction.docChanged) {
      return createDelimiterPresentationDecorations(transaction.state);
    }
    return decorations;
  },
  provide: field => EditorView.decorations.from(field),
});

function createExportChromeTheme(): Extension {
  return EditorView.theme({
    '&': {
      backgroundColor: 'transparent',
    },
    '.cm-editor': {
      height: 'auto',
      width: '100%',
      backgroundColor: 'transparent',
    },
    '.cm-scroller': {
      overflow: 'visible',
      fontFamily: 'inherit',
    },
    '.cm-content': {
      minHeight: '0',
      padding: '0',
      caretColor: 'transparent',
    },
    '.cm-gutters': {
      display: 'none',
    },
    '.cm-activeLine, .cm-activeLineGutter': {
      backgroundColor: 'transparent',
    },
    '.cm-searchMatch, .cm-searchMatch-selected': {
      backgroundColor: 'transparent !important',
      outline: 'none',
    },
    '.cm-panels, .cm-tooltip': {
      display: 'none !important',
    },
    '.cm-code-block-copy-btn, .cm-image-indicator, .cm-html-indicator, .cm-hyper-link-icon': {
      display: 'none !important',
    },
    'span[data-color] input[type="color"]': {
      display: 'none !important',
    },
    '.cm-dropCursor': {
      display: 'none',
    },
  });
}

function getReadonlyBlockBackground(isDark: boolean, access: BlockAccess, isEvenBlock: boolean): string | null {
  if (access !== 'read') {
    return null;
  }

  if (isDark) {
    return isEvenBlock ? 'rgba(124, 124, 138, 0.16)' : 'rgba(110, 110, 124, 0.22)';
  }

  return isEvenBlock ? 'rgba(0, 0, 0, 0.06)' : 'rgba(0, 0, 0, 0.09)';
}

function resolveBlockBackground(block: Block, sourceIndex: number): string {
  const themeStore = useThemeStore();
  const colors = themeStore.getEffectiveColors();
  const isEvenBlock = sourceIndex % 2 === 0;

  return getReadonlyBlockBackground(colors.dark, block.access, isEvenBlock)
    ?? (isEvenBlock ? colors.background : colors.backgroundSecondary);
}

function createAppearance(block: Block, sourceIndex: number): BlockImageExportAppearance {
  const configStore = useConfigStore();
  const themeStore = useThemeStore();
  const colors = themeStore.getEffectiveColors();

  return {
    backgroundColor: resolveBlockBackground(block, sourceIndex),
    borderColor: colors.borderColor,
    shadow: colors.dark
      ? '0 14px 32px rgba(0, 0, 0, 0.34)'
      : '0 10px 28px rgba(15, 23, 42, 0.12)',
    foregroundColor: colors.foreground,
    fontFamily: configStore.config.editing.fontFamily,
    fontSize: configStore.config.editing.fontSize,
    lineHeight: configStore.config.editing.lineHeight,
    fontWeight: configStore.config.editing.fontWeight,
    languageLabel: block.language.name && block.language.name !== 'text'
      ? block.language.name
      : null,
  };
}

async function getOptionalRenderExtensions(): Promise<ExportContribution[]> {
  const extensionStore = useExtensionStore();
  if (extensionStore.extensions.length === 0) {
    await extensionStore.loadExtensions();
  }

  return extensionStore.extensions
    .filter(extension => extension.enabled)
    .map(extension => {
      const build = EXPORT_CONTRIBUTIONS[extension.name as ExtensionName];
      return build?.(extension.config ?? {});
    })
    .filter((contribution): contribution is ExportContribution => Boolean(contribution));
}

export async function createBlockImageExportPreset(block: Block, sourceIndex: number): Promise<BlockImageExportPreset> {
  const themeStore = useThemeStore();
  const configStore = useConfigStore();
  const colors = themeStore.getEffectiveColors();
  const optionalContributions = await getOptionalRenderExtensions();

  return {
    appearance: createAppearance(block, sourceIndex),
    extensions: [
      EditorState.readOnly.of(true),
      EditorView.editable.of(false),
      EditorView.lineWrapping,
      createThemeByColors(colors),
      createFontExtension({
        fontFamily: configStore.config.editing.fontFamily,
        fontSize: configStore.config.editing.fontSize,
        lineHeight: configStore.config.editing.lineHeight,
        fontWeight: configStore.config.editing.fontWeight,
      }),
      blockState,
      ...getCodeBlockLanguageExtension(),
      delimiterPresentationField,
      ...getMathBlockExtensions(),
      createExportChromeTheme(),
      ...optionalContributions.map(({extension}) => extension),
    ],
    hiddenSelectors: [
      ...BASE_CAPTURE_HIDDEN_SELECTORS,
      ...optionalContributions.flatMap(({hiddenSelectors = []}) => hiddenSelectors),
    ],
  };
}
