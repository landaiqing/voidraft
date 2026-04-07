import {EditorSelection, type Extension} from '@codemirror/state';
import {EditorView} from '@codemirror/view';
import {codeBlockEvent, CONTENT_EDIT, USER_EVENTS} from '../codeblock/annotation';
import {copyImage, createInlineImageTagFromAsset, IMAGE_MIME_TYPES, importImageBlob} from './clipboard';
import {inlineImageIsSelected, inlineImageState} from './inlineImage';

function isImageMimeType(type: string): boolean {
  return type.startsWith('image/') || IMAGE_MIME_TYPES.includes(type as (typeof IMAGE_MIME_TYPES)[number]);
}

function extractImageBlobsFromClipboardData(data: DataTransfer | null): Blob[] {
  if (!data) {
    return [];
  }

  const fromItems = Array.from(data.items || [])
    .filter(item => item.kind === 'file' && isImageMimeType(item.type))
    .map(item => item.getAsFile())
    .filter((file): file is File => Boolean(file));

  if (fromItems.length > 0) {
    return fromItems;
  }

  return Array.from(data.files || []).filter(file => isImageMimeType(file.type));
}

async function buildInlineImageTags(blobs: readonly Blob[], maxDisplayHeight: number): Promise<string[]> {
  const tags: string[] = [];

  for (const blob of blobs) {
    try {
      const asset = await importImageBlob(blob);
      tags.push(createInlineImageTagFromAsset(asset, maxDisplayHeight));
    } catch (error) {
      console.error('[inlineImage] Failed to import pasted image:', error);
    }
  }

  return tags;
}

function insertInlineImageTagsAtSelection(view: EditorView, tags: readonly string[], userEvent: string): boolean {
  if (tags.length === 0) {
    return false;
  }

  const insert = tags.join('');
  const selection = view.state.selection.main;

  view.dispatch(view.state.update({
    changes: {
      from: selection.from,
      to: selection.to,
      insert,
    },
    selection: EditorSelection.cursor(selection.from + insert.length),
    userEvent,
    annotations: [codeBlockEvent.of(CONTENT_EDIT)],
  }, {scrollIntoView: true}));

  return true;
}

function insertInlineImageTagsAtPosition(view: EditorView, pos: number, tags: readonly string[], userEvent: string): boolean {
  if (tags.length === 0) {
    return false;
  }

  const insert = tags.join('');
  view.dispatch(view.state.update({
    changes: {from: pos, to: pos, insert},
    selection: EditorSelection.cursor(pos + insert.length),
    userEvent,
    annotations: [codeBlockEvent.of(CONTENT_EDIT)],
  }, {scrollIntoView: true}));

  return true;
}

export async function copySelectedInlineImageIfNeeded(view: EditorView): Promise<boolean> {
  const images = view.state.field(inlineImageState, false);
  if (!images) {
    return false;
  }

  for (const image of images) {
    if (inlineImageIsSelected(image, view.state.selection.main)) {
      await copyImage(image.file);
      return true;
    }
  }

  return false;
}

export async function pasteInlineImagesFromClipboardEvent(
  view: EditorView,
  event: ClipboardEvent,
  maxDisplayHeight: number,
): Promise<boolean> {
  if (view.state.readOnly) {
    return false;
  }

  const blobs = extractImageBlobsFromClipboardData(event.clipboardData);
  if (blobs.length === 0) {
    return false;
  }

  const tags = await buildInlineImageTags(blobs, maxDisplayHeight);
  return insertInlineImageTagsAtSelection(view, tags, USER_EVENTS.INPUT_PASTE);
}

export async function pasteInlineImagesFromSystemClipboard(
  view: EditorView,
  maxDisplayHeight: number,
): Promise<boolean> {
  if (view.state.readOnly || !navigator.clipboard?.read) {
    return false;
  }

  try {
    const items = await navigator.clipboard.read();
    const blobs: Blob[] = [];

    for (const item of items) {
      for (const type of item.types) {
        if (!isImageMimeType(type)) {
          continue;
        }
        blobs.push(await item.getType(type));
        break;
      }
    }

    if (blobs.length === 0) {
      return false;
    }

    const tags = await buildInlineImageTags(blobs, maxDisplayHeight);
    return insertInlineImageTagsAtSelection(view, tags, USER_EVENTS.INPUT_PASTE);
  } catch (error) {
    console.error('[inlineImage] Failed to read clipboard images:', error);
    return false;
  }
}

export function createInlineImageDropExtension(maxDisplayHeight: number): Extension {
  return EditorView.domEventHandlers({
    dragover(event) {
      const files = Array.from(event.dataTransfer?.files || []);
      const hasImage = files.some(file => isImageMimeType(file.type));
      if (!hasImage) {
        return false;
      }

      event.preventDefault();
      return true;
    },
    drop(event, view) {
      const files = Array.from(event.dataTransfer?.files || []).filter(file => isImageMimeType(file.type));
      if (files.length === 0 || view.state.readOnly) {
        return false;
      }

      event.preventDefault();
      event.stopPropagation();
      view.focus();

      const pos = view.posAtCoords({x: event.clientX, y: event.clientY}) ?? view.state.selection.main.head;
      void (async () => {
        const tags = await buildInlineImageTags(files, maxDisplayHeight);
        insertInlineImageTagsAtPosition(view, pos, tags, 'input.drop');
      })();

      return true;
    },
  });
}
