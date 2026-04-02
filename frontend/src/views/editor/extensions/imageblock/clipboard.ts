import * as MediaHTTPService from '@/../bindings/voidraft/internal/services/mediahttpservice';
import type {ImageAsset} from '@/../bindings/voidraft/internal/services/models';
import {EditorView} from '@codemirror/view';
import {getActiveNoteBlock} from '@/views/editor/extensions/codeblock/state';
import {createImageBlockItemFromAsset, insertImageBlockFromClipboard, insertImageItemsIntoBlock} from './document';
import {getSelectedImageBlock} from './selection';
import {IMAGE_BLOCK_LANGUAGE} from './constants';

type ClipboardImageInput = {
  blob: Blob;
  filename?: string;
  mimeType?: string;
};

function getClipboardImageFiles(event: ClipboardEvent): ClipboardImageInput[] {
  const files: ClipboardImageInput[] = [];
  const items = event.clipboardData?.items;
  if (!items) {
    return files;
  }

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (item.kind !== 'file' || !item.type.startsWith('image/')) {
      continue;
    }

    const file = item.getAsFile();
    if (file) {
      files.push({
        blob: file,
        filename: file.name || undefined,
        mimeType: file.type || undefined,
      });
    }
  }

  return files;
}

async function readSystemClipboardImageFiles(): Promise<ClipboardImageInput[]> {
  if (!navigator.clipboard?.read) {
    return [];
  }

  const clipboardItems = await navigator.clipboard.read();
  const files: ClipboardImageInput[] = [];

  for (const item of clipboardItems) {
    for (const type of item.types) {
      if (!type.startsWith('image/')) {
        continue;
      }

      const blob = await item.getType(type);
      files.push({
        blob,
        filename: blob instanceof File && blob.name ? blob.name : undefined,
        mimeType: type || blob.type || undefined,
      });
      break;
    }
  }

  return files;
}

function readBlobAsDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('Failed to read clipboard image'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(blob);
  });
}

function normalizeClipboardFilename(filename?: string): string | undefined {
  const normalized = filename?.trim();
  return normalized ? normalized : undefined;
}

async function importClipboardImages(files: readonly ClipboardImageInput[]): Promise<ImageAsset[]> {
  const assets: ImageAsset[] = [];

  for (const file of files) {
    const dataURL = await readBlobAsDataURL(file.blob);
    const asset = await MediaHTTPService.ImportImage({
      filename: normalizeClipboardFilename(file.filename),
      mime_type: file.mimeType || file.blob.type || undefined,
      data_base64: dataURL,
    });

    if (asset) {
      assets.push(asset);
    }
  }

  return assets;
}

async function pasteClipboardImages(view: EditorView, files: readonly ClipboardImageInput[]): Promise<boolean> {
  try {
    const assets = await importClipboardImages(files);
    if (assets.length === 0) {
      return false;
    }

    const items = assets.map(createImageBlockItemFromAsset);
    const selected = getSelectedImageBlock(view.state);
    if (selected) {
      insertImageItemsIntoBlock(view, selected.block, items, selected.itemIndex);
      return true;
    }

    const activeBlock = getActiveNoteBlock(view.state);
    if (activeBlock?.language.name === IMAGE_BLOCK_LANGUAGE) {
      insertImageItemsIntoBlock(view, activeBlock, items, null);
      return true;
    }

    insertImageBlockFromClipboard(view, items);
    return true;
  } catch (error) {
    console.error('[imageblock] Failed to import clipboard image:', error);
    return false;
  }
}

export function handleImagePasteEvent(view: EditorView, event: ClipboardEvent): boolean {
  if (view.state.readOnly) {
    return false;
  }

  const files = getClipboardImageFiles(event);
  if (files.length === 0) {
    return false;
  }

  event.preventDefault();
  void pasteClipboardImages(view, files);
  return true;
}

export async function pasteImagesFromClipboard(view: EditorView): Promise<boolean> {
  if (view.state.readOnly) {
    return false;
  }

  try {
    const files = await readSystemClipboardImageFiles();
    if (files.length === 0) {
      return false;
    }

    return pasteClipboardImages(view, files);
  } catch {
    return false;
  }
}
