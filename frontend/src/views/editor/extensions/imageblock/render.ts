import {Extension, RangeSetBuilder, StateField} from '@codemirror/state';
import {
  Decoration,
  type DecorationSet,
  EditorView,
} from '@codemirror/view';
import {blockState} from '@/views/editor/extensions/codeblock/state';
import {IMAGE_BLOCK_LANGUAGE, TARGET_PREVIEW_HEIGHT} from './constants';
import {getSelectedImageBlock, imageBlockSelectionField} from './selection';
import {getImageBlockItemMap} from './syntax';
import type {ImageBlockItem, ImageBlockSelection} from './types';
import {ImageBlockWidget} from './widget';

const EMPTY_IMAGE_ITEM_MAP = new Map<number, readonly ImageBlockItem[]>();

function isSameImageSelection(
  previous: ImageBlockSelection | null | undefined,
  next: ImageBlockSelection | null | undefined,
): boolean {
  if (!previous || !next) {
    return previous === next;
  }

  return previous.anchor === next.anchor && previous.itemIndex === next.itemIndex;
}

function isSelectionInImageBlock(state: EditorView['state'], from: number, to: number): boolean {
  return state.selection.ranges.some(range => range.from <= to && from <= range.to);
}

function buildImageBlockDecorations(state: EditorView['state']): DecorationSet {
  const blocks = state.field(blockState, false) ?? [];
  const itemsByBlock = state.field(imageBlockItemsField, false) ?? EMPTY_IMAGE_ITEM_MAP;
  const selected = getSelectedImageBlock(state);
  const builder = new RangeSetBuilder<Decoration>();

  for (const block of blocks) {
    if (block.language.name !== IMAGE_BLOCK_LANGUAGE) {
      continue;
    }
    if (block.content.from >= block.content.to) {
      continue;
    }
    if (isSelectionInImageBlock(state, block.content.from, block.content.to)) {
      continue;
    }

    const items = itemsByBlock.get(block.content.from) ?? [];
    if (items.length === 0) {
      continue;
    }

    builder.add(
      block.content.from,
      block.content.to,
      Decoration.replace({
        block: true,
        inclusive: true,
        widget: new ImageBlockWidget(
          block.content.from,
          items,
          selected?.block.content.from === block.content.from ? selected.itemIndex : null,
        ),
      }),
    );
  }

  return builder.finish();
}

const imageBlockItemsField = StateField.define<ReadonlyMap<number, readonly ImageBlockItem[]>>({
  create: getImageBlockItemMap,
  update(items, transaction) {
    return transaction.docChanged ? getImageBlockItemMap(transaction.state) : items;
  },
});

const imageBlockDecorationField = StateField.define<DecorationSet>({
  create: buildImageBlockDecorations,
  update(decorations, transaction) {
    const previousSelection = transaction.startState.field(imageBlockSelectionField, false);
    const nextSelection = transaction.state.field(imageBlockSelectionField, false);

    if (
      transaction.docChanged
      || Boolean(transaction.selection)
      || !isSameImageSelection(previousSelection, nextSelection)
    ) {
      return buildImageBlockDecorations(transaction.state);
    }

    return decorations;
  },
  provide: field => EditorView.decorations.from(field),
});

const imageBlockTheme = EditorView.baseTheme({
  '.cm-image-block-widget': {
    padding: '8px 0 6px',
  },
  '.cm-image-block-flow': {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    gap: '12px',
  },
  '.cm-image-block-item': {
    position: 'relative',
    display: 'flex',
    alignItems: 'stretch',
    justifyContent: 'center',
    flex: '0 0 auto',
    maxWidth: '100%',
    minWidth: '48px',
    minHeight: '48px',
    overflow: 'visible',
    border: '1px solid rgba(127, 127, 127, 0.18)',
    background: `
      linear-gradient(45deg, rgba(127, 127, 127, 0.08) 25%, transparent 25%),
      linear-gradient(-45deg, rgba(127, 127, 127, 0.08) 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, rgba(127, 127, 127, 0.08) 75%),
      linear-gradient(-45deg, transparent 75%, rgba(127, 127, 127, 0.08) 75%)
    `,
    backgroundColor: 'rgba(127, 127, 127, 0.04)',
    backgroundSize: '12px 12px',
    backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0',
  },
  '.cm-image-block-item.is-selected': {
    outline: '1px solid var(--cm-selection-border, #4a9eff)',
    outlineOffset: '1px',
    zIndex: '2',
  },
  '.cm-image-block-item.is-busy': {
    cursor: 'progress',
  },
  '.cm-image-block-item.is-error': {
    borderStyle: 'dashed',
  },
  '.cm-image-block-item.is-dragging': {
    opacity: '0.48',
    zIndex: '3',
  },
  '.cm-image-block-item.is-dragging .cm-image-block-actions': {
    opacity: '0',
    pointerEvents: 'none',
  },
  '.cm-image-block-item.is-drop-before::before': {
    content: '""',
    position: 'absolute',
    top: '0',
    bottom: '0',
    left: '-7px',
    width: '2px',
    background: 'var(--cm-selection-border, #4a9eff)',
  },
  '.cm-image-block-item.is-drop-after::after': {
    content: '""',
    position: 'absolute',
    top: '0',
    bottom: '0',
    right: '-7px',
    width: '2px',
    background: 'var(--cm-selection-border, #4a9eff)',
  },
  '.cm-image-block-thumb': {
    display: 'block',
    width: 'auto',
    height: 'auto',
    maxHeight: `${TARGET_PREVIEW_HEIGHT}px`,
    maxWidth: 'min(320px, calc(100vw - 96px))',
    objectFit: 'contain',
    opacity: '0',
    transition: 'opacity 0.16s ease',
  },
  '.cm-image-block-item.is-loaded .cm-image-block-thumb': {
    opacity: '1',
  },
  '.cm-image-block-actions': {
    position: 'absolute',
    top: '0',
    right: '-36px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '6px',
    opacity: '0',
    pointerEvents: 'none',
    transition: 'opacity 0.12s ease',
    zIndex: '1',
  },
  '.cm-image-block-item.is-selected .cm-image-block-actions': {
    opacity: '1',
    pointerEvents: 'auto',
  },
  '.cm-image-block-drag-handle': {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    border: '1px solid var(--border-color, rgba(127, 127, 127, 0.24))',
    background: 'var(--bg-primary, #ffffff)',
    color: 'var(--text-secondary, #666666)',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.18)',
    cursor: 'grab',
    userSelect: 'none',
    outline: 'none',
    transition: 'background-color 0.12s ease, border-color 0.12s ease, color 0.12s ease, opacity 0.12s ease',
  },
  '.cm-image-block-drag-handle:hover': {
    background: 'var(--bg-hover, rgba(127, 127, 127, 0.08))',
    color: 'var(--text-primary, #111111)',
  },
  '.cm-image-block-drag-handle:focus-visible': {
    borderColor: 'var(--cm-selection-border, #4a9eff)',
  },
  '.cm-image-block-item.is-dragging .cm-image-block-drag-handle': {
    cursor: 'grabbing',
  },
  '.cm-image-block-item.is-busy .cm-image-block-drag-handle': {
    opacity: '0.55',
    pointerEvents: 'none',
  },
  '.cm-image-block-drag-handle svg': {
    width: '14px',
    height: '14px',
    fill: 'currentColor',
  },
  '.cm-image-block-action': {
    appearance: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    padding: '0',
    border: '1px solid var(--border-color, rgba(127, 127, 127, 0.24))',
    background: 'var(--bg-primary, #ffffff)',
    color: 'var(--text-primary, #111111)',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.18)',
    cursor: 'pointer',
    outline: 'none',
    transition: 'background-color 0.12s ease, border-color 0.12s ease, color 0.12s ease, opacity 0.12s ease',
  },
  '.cm-image-block-action:hover:not(:disabled)': {
    background: 'var(--bg-hover, rgba(127, 127, 127, 0.08))',
  },
  '.cm-image-block-action:disabled': {
    opacity: '0.55',
    cursor: 'default',
  },
  '.cm-image-block-action:focus-visible': {
    borderColor: 'var(--cm-selection-border, #4a9eff)',
  },
  '.cm-image-block-action svg': {
    width: '14px',
    height: '14px',
    fill: 'currentColor',
  },
  '.cm-image-block-action.is-delete': {
    color: 'var(--text-danger, #d14b4b)',
  },
});

export function getImageBlockRenderExtensions(): Extension[] {
  return [imageBlockItemsField, imageBlockDecorationField, imageBlockTheme];
}
