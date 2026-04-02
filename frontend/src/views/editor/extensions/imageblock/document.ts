import type {ImageAsset} from '@/../bindings/voidraft/internal/services/models';
import type {EditorView} from '@codemirror/view';
import {CONTENT_EDIT, USER_EVENTS, codeBlockEvent} from '@/views/editor/extensions/codeblock/annotation';
import {createDelimiter} from '@/views/editor/extensions/codeblock/parser';
import {getActiveNoteBlock} from '@/views/editor/extensions/codeblock/state';
import type {Block} from '@/views/editor/extensions/codeblock/types';
import {clearImageBlockSelection, setImageBlockSelection} from './selection';
import {getImageBlockItems} from './syntax';
import type {ImageBlockItem} from './types';

function quoteAttribute(value: string): string {
  return JSON.stringify(value);
}

function pushOptionalString(attrs: string[], key: string, value?: string) {
  if (!value) {
    return;
  }
  attrs.push(`${key}=${quoteAttribute(value)}`);
}

function pushOptionalNumber(attrs: string[], key: string, value?: number) {
  if (!value || value <= 0) {
    return;
  }
  attrs.push(`${key}=${value}`);
}

export function createImageBlockItemFromAsset(asset: ImageAsset): ImageBlockItem {
  return {
    ref: asset.id,
    src: asset.url,
    width: asset.width > 0 ? asset.width : undefined,
    height: asset.height > 0 ? asset.height : undefined,
  };
}

export function serializeImageBlockItem(item: ImageBlockItem): string {
  const attrs = [
    `ref=${quoteAttribute(item.ref)}`,
    `src=${quoteAttribute(item.src)}`,
  ];

  pushOptionalNumber(attrs, 'width', item.width);
  pushOptionalNumber(attrs, 'height', item.height);
  pushOptionalString(attrs, 'alt', item.alt);
  pushOptionalString(attrs, 'title', item.title);

  return `img(${attrs.join(', ')})`;
}

export function serializeImageBlockContent(items: readonly ImageBlockItem[]): string {
  return items.map(serializeImageBlockItem).join('\n');
}

export function insertImageItemsIntoBlock(
  view: EditorView,
  block: Block,
  itemsToInsert: readonly ImageBlockItem[],
  afterItemIndex: number | null,
): boolean {
  if (itemsToInsert.length === 0 || view.state.readOnly) {
    return false;
  }

  const currentItems = getImageBlockItems(view.state, block);
  const insertAt = afterItemIndex === null
    ? currentItems.length
    : Math.min(currentItems.length, afterItemIndex + 1);
  const nextItems = [
    ...currentItems.slice(0, insertAt),
    ...itemsToInsert,
    ...currentItems.slice(insertAt),
  ];

  view.dispatch({
    changes: {
      from: block.content.from,
      to: block.content.to,
      insert: serializeImageBlockContent(nextItems),
    },
    effects: [
      setImageBlockSelection.of({
        anchor: block.content.from,
        itemIndex: insertAt + itemsToInsert.length - 1,
      }),
    ],
    scrollIntoView: true,
    userEvent: USER_EVENTS.INPUT_PASTE,
    annotations: [codeBlockEvent.of(CONTENT_EDIT)],
  });

  return true;
}

export function removeImageItemFromBlock(
  view: EditorView,
  block: Block,
  itemIndex: number,
): boolean {
  if (view.state.readOnly) {
    return false;
  }

  const currentItems = getImageBlockItems(view.state, block);
  if (itemIndex < 0 || itemIndex >= currentItems.length) {
    return false;
  }

  const nextItems = currentItems.filter((_, index) => index !== itemIndex);
  if (nextItems.length === 0) {
    view.dispatch({
      changes: {
        from: block.range.from,
        to: block.range.to,
        insert: '',
      },
      effects: [clearImageBlockSelection.of()],
      scrollIntoView: true,
      userEvent: USER_EVENTS.DELETE,
      annotations: [codeBlockEvent.of(CONTENT_EDIT)],
    });
    return true;
  }

  const nextSelectedIndex = Math.min(itemIndex, nextItems.length - 1);
  view.dispatch({
    changes: {
      from: block.content.from,
      to: block.content.to,
      insert: serializeImageBlockContent(nextItems),
    },
    effects: [
      setImageBlockSelection.of({
        anchor: block.content.from,
        itemIndex: nextSelectedIndex,
      }),
    ],
    scrollIntoView: true,
    userEvent: USER_EVENTS.DELETE,
    annotations: [codeBlockEvent.of(CONTENT_EDIT)],
  });

  return true;
}

export function moveImageItemInBlock(
  view: EditorView,
  block: Block,
  fromIndex: number,
  toIndex: number,
): boolean {
  if (view.state.readOnly) {
    return false;
  }

  const currentItems = getImageBlockItems(view.state, block);
  if (
    fromIndex < 0
    || fromIndex >= currentItems.length
    || toIndex < 0
    || toIndex > currentItems.length
  ) {
    return false;
  }

  const nextIndex = toIndex > fromIndex ? toIndex - 1 : toIndex;
  if (nextIndex === fromIndex) {
    return false;
  }

  const nextItems = [...currentItems];
  const [movedItem] = nextItems.splice(fromIndex, 1);
  if (!movedItem) {
    return false;
  }
  nextItems.splice(nextIndex, 0, movedItem);

  view.dispatch({
    changes: {
      from: block.content.from,
      to: block.content.to,
      insert: serializeImageBlockContent(nextItems),
    },
    effects: [
      setImageBlockSelection.of({
        anchor: block.content.from,
        itemIndex: nextIndex,
      }),
    ],
    scrollIntoView: true,
    userEvent: USER_EVENTS.MOVE,
    annotations: [codeBlockEvent.of(CONTENT_EDIT)],
  });

  return true;
}

export function insertImageBlockAfterBlock(
  view: EditorView,
  block: Block,
  items: readonly ImageBlockItem[],
): boolean {
  if (items.length === 0 || view.state.readOnly) {
    return false;
  }

  const delimiter = createDelimiter('image', false, 'write');
  const content = serializeImageBlockContent(items);

  view.dispatch({
    changes: {
      from: block.content.to,
      insert: `${delimiter}${content}`,
    },
    effects: [clearImageBlockSelection.of()],
    scrollIntoView: true,
    userEvent: USER_EVENTS.INPUT_PASTE,
    annotations: [codeBlockEvent.of(CONTENT_EDIT)],
  });

  return true;
}

export function insertImageBlockFromClipboard(view: EditorView, items: readonly ImageBlockItem[]): boolean {
  if (items.length === 0 || view.state.readOnly) {
    return false;
  }

  const activeBlock = getActiveNoteBlock(view.state);
  if (!activeBlock) {
    return false;
  }

  return insertImageBlockAfterBlock(view, activeBlock, items);
}
