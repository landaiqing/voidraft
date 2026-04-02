import * as MediaHTTPService from '@/../bindings/voidraft/internal/services/mediahttpservice';
import {writeImageToClipboard} from '@/views/editor/extensions/blockImage/clipboard';
import {getNoteBlockFromPos} from '@/views/editor/extensions/codeblock/state';
import {IMAGE_BLOCK_LANGUAGE} from './constants';
import {getImageBlockItems} from './syntax';
import type {ImageBlockItem} from './types';
import {removeImageItemFromBlock} from './document';
import type {EditorView} from '@codemirror/view';

function getClipboardMimeType(blob: Blob): string {
  return blob.type.startsWith('image/') ? blob.type : 'image/png';
}

async function fetchImageBlob(item: ImageBlockItem): Promise<Blob> {
  const response = await fetch(item.src);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
  }

  return response.blob();
}

export async function copyImageItemToClipboard(item: ImageBlockItem): Promise<void> {
  const blob = await fetchImageBlob(item);
  await writeImageToClipboard(blob, getClipboardMimeType(blob));
}

export async function deleteImageItem(view: EditorView, anchor: number, itemIndex: number): Promise<boolean> {
  const block = getNoteBlockFromPos(view.state, anchor);
  if (!block || block.language.name !== IMAGE_BLOCK_LANGUAGE) {
    return false;
  }

  const items = getImageBlockItems(view.state, block);
  const item = items[itemIndex];
  if (!item) {
    return false;
  }

  const result = await MediaHTTPService.DeleteImage(item.ref);
  if (!result?.deleted) {
    return false;
  }

  return removeImageItemFromBlock(view, block, itemIndex);
}
