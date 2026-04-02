import {EditorView, WidgetType} from '@codemirror/view';
import {CONTEXT_MENU_BLOCK_ANCHOR_DATASET} from '@/views/editor/extensions/contextMenu/constants';
import i18n from '@/i18n';
import {copyImageItemToClipboard, deleteImageItem} from './actions';
import {MAX_PREVIEW_WIDTH, TARGET_PREVIEW_HEIGHT} from './constants';
import {attachImageBlockDrag} from './drag';
import {setImageBlockSelection} from './selection';
import type {ImageBlockItem} from './types';

const ITEM_SIGNATURE_SEPARATOR = '\u001f';
const t = (key: string) => i18n.global.t(key);

function getPreviewWidth(width: number, height: number): number {
  return Math.min(
    MAX_PREVIEW_WIDTH,
    Math.max(48, Math.round((TARGET_PREVIEW_HEIGHT * width) / height)),
  );
}

function applyPreviewSize(element: HTMLElement, width?: number, height?: number) {
  if (!width || !height || width <= 0 || height <= 0) {
    return;
  }

  element.style.width = `${getPreviewWidth(width, height)}px`;
  element.style.aspectRatio = `${width} / ${height}`;
}

function getItemSignature(item: ImageBlockItem): string {
  return [
    item.ref,
    item.src,
    item.alt ?? '',
    item.title ?? '',
    item.width ?? '',
    item.height ?? '',
  ].join(ITEM_SIGNATURE_SEPARATOR);
}

function areItemsEqual(left: readonly ImageBlockItem[], right: readonly ImageBlockItem[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((item, index) => {
    const other = right[index];
    return item.ref === other?.ref
      && item.src === other?.src
      && item.alt === other?.alt
      && item.title === other?.title
      && item.width === other?.width
      && item.height === other?.height;
  });
}

function setSelectionState(frame: HTMLElement, selected: boolean) {
  frame.classList.toggle('is-selected', selected);
}

function getImageTitle(item: ImageBlockItem): string | undefined {
  return item.title ?? item.alt;
}

function applyLoadedState(frame: HTMLElement, image: HTMLImageElement) {
  if (image.naturalWidth > 0 && image.naturalHeight > 0) {
    applyPreviewSize(frame, image.naturalWidth, image.naturalHeight);
  }

  frame.classList.remove('is-loading');
  frame.classList.add('is-loaded');
}

function createImageFrame(
  view: EditorView,
  anchor: number,
  item: ImageBlockItem,
  index: number,
  selectedIndex: number | null,
): HTMLElement {
  const frame = document.createElement('div');
  frame.className = 'cm-image-block-item is-loading';
  frame.dataset.signature = getItemSignature(item);
  setSelectionState(frame, selectedIndex === index);
  applyPreviewSize(frame, item.width, item.height);

  frame.addEventListener('mousedown', event => {
    event.preventDefault();
    event.stopPropagation();

    view.focus();
    view.dispatch({
      effects: [setImageBlockSelection.of({
        anchor,
        itemIndex: index,
      })],
    });
  });

  const image = document.createElement('img');
  image.className = 'cm-image-block-thumb';
  image.alt = item.alt ?? item.title ?? '';
  image.draggable = false;
  image.decoding = 'async';
  image.loading = 'lazy';

  const title = getImageTitle(item);
  if (title) {
    image.title = title;
  }

  image.addEventListener('load', () => {
    applyLoadedState(frame, image);
  });

  image.addEventListener('error', () => {
    frame.classList.remove('is-loading');
    frame.classList.add('is-error');
  });

  image.src = item.src;
  if (image.complete && image.naturalWidth > 0) {
    applyLoadedState(frame, image);
  }

  frame.appendChild(image);

  const actions = document.createElement('div');
  actions.className = 'cm-image-block-actions';
  frame.appendChild(actions);

  const stopPropagation = (event: Event) => {
    event.stopPropagation();
  };

  const stopPointerEvent = (event: MouseEvent) => {
    event.preventDefault();
    stopPropagation(event);
  };

  const dragHandle = document.createElement('div');
  dragHandle.className = 'cm-image-block-drag-handle';
  dragHandle.title = t('extensions.imageBlock.dragSort');
  dragHandle.setAttribute('aria-label', t('extensions.imageBlock.dragSort'));
  dragHandle.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3h2v2H3zm4 0h2v2H7zm4 0h2v2h-2zM3 7h2v2H3zm4 0h2v2H7zm4 0h2v2h-2zM3 11h2v2H3zm4 0h2v2H7zm4 0h2v2h-2z"/></svg>';
  dragHandle.addEventListener('mousedown', stopPropagation);
  dragHandle.addEventListener('click', event => {
    event.preventDefault();
    stopPropagation(event);
  });
  actions.appendChild(dragHandle);

  const setBusy = (busy: boolean) => {
    frame.classList.toggle('is-busy', busy);
    Array.from(actions.querySelectorAll<HTMLButtonElement>('button')).forEach(button => {
      button.disabled = busy;
    });
  };

  const createActionButton = (
    className: string,
    title: string,
    iconMarkup: string,
    action: () => Promise<void>,
    options: {
      busy?: boolean;
    } = {},
  ) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `cm-image-block-action ${className}`;
    button.title = title;
    button.setAttribute('aria-label', title);
    button.innerHTML = iconMarkup;
    button.addEventListener('mousedown', stopPointerEvent);
    button.addEventListener('click', async event => {
      stopPointerEvent(event);
      if (options.busy) {
        setBusy(true);
      }
      try {
        await action();
      } catch (error) {
        console.error(`[imageblock] Failed to ${className}:`, error);
      } finally {
        if (options.busy) {
          setBusy(false);
        }
      }
    });
    actions.appendChild(button);
  };

  createActionButton(
    'is-copy',
    t('extensions.imageBlock.copyImage'),
    '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5A1.5 1.5 0 0 1 5.5 1h6A1.5 1.5 0 0 1 13 2.5v8a1.5 1.5 0 0 1-1.5 1.5h-6A1.5 1.5 0 0 1 4 10.5z"/><path d="M2.5 4A1.5 1.5 0 0 0 1 5.5v7A1.5 1.5 0 0 0 2.5 14h6A1.5 1.5 0 0 0 10 12.5V12H5.5A2.5 2.5 0 0 1 3 9.5V4z"/></svg>',
    () => copyImageItemToClipboard(item),
  );

  createActionButton(
    'is-delete',
    t('extensions.imageBlock.deleteImage'),
    '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6.5 1h3l.5 1H13v1H3V2h2.5z"/><path d="M4 4h8l-.6 9.1A1 1 0 0 1 10.4 14H5.6a1 1 0 0 1-1-.9z"/><path d="M6 6h1v6H6zm3 0h1v6H9z"/></svg>',
    async () => {
      const deleted = await deleteImageItem(view, anchor, index);
      if (!deleted) {
        throw new Error('Delete image request was not completed');
      }
    },
    {busy: true},
  );

  return frame;
}

export class ImageBlockWidget extends WidgetType {
  constructor(
    private readonly anchor: number,
    private readonly items: readonly ImageBlockItem[],
    private readonly selectedIndex: number | null,
  ) {
    super();
  }

  override eq(other: ImageBlockWidget): boolean {
    return this.anchor === other.anchor
      && this.selectedIndex === other.selectedIndex
      && areItemsEqual(this.items, other.items);
  }

  override toDOM(view: EditorView): HTMLElement {
    const root = document.createElement('div');
    root.className = 'cm-image-block-widget';
    root.dataset[CONTEXT_MENU_BLOCK_ANCHOR_DATASET] = String(this.anchor);

    const flow = document.createElement('div');
    flow.className = 'cm-image-block-flow';
    root.appendChild(flow);

    root.addEventListener('mousedown', event => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('.cm-image-block-item')) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      view.focus();
      view.dispatch({
        effects: [setImageBlockSelection.of({
          anchor: this.anchor,
          itemIndex: null,
        })],
      });
    });

    this.items.forEach((item, index) => {
      flow.appendChild(createImageFrame(view, this.anchor, item, index, this.selectedIndex));
    });

    attachImageBlockDrag(flow, view, this.anchor);

    return root;
  }

  override updateDOM(dom: HTMLElement): boolean {
    if (dom.dataset[CONTEXT_MENU_BLOCK_ANCHOR_DATASET] !== String(this.anchor)) {
      return false;
    }

    const flow = dom.querySelector<HTMLElement>('.cm-image-block-flow');
    if (!flow) {
      return false;
    }

    const frames = Array.from(flow.children);
    if (frames.length !== this.items.length) {
      return false;
    }

    const canReuse = this.items.every((item, index) => {
      const frame = frames[index];
      return frame instanceof HTMLElement && frame.dataset.signature === getItemSignature(item);
    });

    if (!canReuse) {
      return false;
    }

    frames.forEach((frame, index) => {
      if (frame instanceof HTMLElement) {
        setSelectionState(frame, this.selectedIndex === index);
      }
    });

    return true;
  }

  override ignoreEvent(): boolean {
    return true;
  }
}
