import * as MediaHTTPService from '@/../bindings/voidraft/internal/services/mediahttpservice';
import type {ImageAsset, ImageDeleteResult} from '@/../bindings/voidraft/internal/services/models';
import {createInlineImageTag} from './inlineImageParsing';
import type {InlineImageData} from './types';

export const IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/apng',
  'image/avif',
  'image/bmp',
  'image/tiff',
] as const;

export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) {
        resolve(blob);
        return;
      }
      reject(new Error('Canvas toBlob returned null'));
    }, 'image/png');
  });
}

async function readBlobAsDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('Failed to read image blob'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(blob);
  });
}

function fallbackVersion(value: string | undefined): string {
  return value && value.trim() ? value.trim() : String(Date.now());
}

function fallbackFilename(mimeType: string): string {
  switch (mimeType.toLowerCase()) {
    case 'image/jpeg':
      return 'clipboard-image.jpg';
    case 'image/webp':
      return 'clipboard-image.webp';
    case 'image/gif':
      return 'clipboard-image.gif';
    case 'image/svg+xml':
      return 'clipboard-image.svg';
    case 'image/avif':
      return 'clipboard-image.avif';
    case 'image/bmp':
      return 'clipboard-image.bmp';
    case 'image/tiff':
      return 'clipboard-image.tiff';
    case 'image/apng':
      return 'clipboard-image.apng';
    default:
      return 'clipboard-image.png';
  }
}

async function blobToPngBlob(blob: Blob): Promise<Blob> {
  const image = new Image();
  const blobUrl = URL.createObjectURL(blob);

  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Failed to decode image blob'));
      image.src = blobUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to create canvas context');
    }

    ctx.drawImage(image, 0, 0);
    return await canvasToPngBlob(canvas);
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

export async function writeImageToClipboard(blob: Blob, mimeType = blob.type || 'image/png'): Promise<void> {
  const ClipboardItemCtor = globalThis.ClipboardItem;
  if (!ClipboardItemCtor || !navigator.clipboard?.write) {
    throw new Error('Clipboard image write is not supported in this environment');
  }

  const resolvedType = mimeType.startsWith('image/') ? mimeType : 'image/png';
  if (typeof ClipboardItemCtor.supports === 'function' && ClipboardItemCtor.supports(resolvedType)) {
    await navigator.clipboard.write([
      new ClipboardItemCtor({[resolvedType]: blob}),
    ]);
    return;
  }

  const pngBlob = resolvedType === 'image/png' ? blob : await blobToPngBlob(blob);
  await navigator.clipboard.write([
    new ClipboardItemCtor({'image/png': pngBlob}),
  ]);
}

export async function copyImage(url: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Fetch failed: ${response.status}`);
  }

  const blob = await response.blob();
  if (!blob.type.startsWith('image/')) {
    throw new Error(`Not an image content type. Got: ${blob.type}`);
  }

  await writeImageToClipboard(blob, blob.type);
}

export async function importImageBlob(blob: Blob, filename?: string): Promise<ImageAsset> {
  const dataBase64 = await readBlobAsDataURL(blob);
  const asset = await MediaHTTPService.ImportImage({
    filename: filename || fallbackFilename(blob.type || 'image/png'),
    mime_type: blob.type || undefined,
    data_base64: dataBase64,
  });

  if (!asset) {
    throw new Error('ImportImage returned no asset');
  }

  return asset;
}

export async function deleteImageAsset(imageRef: string): Promise<ImageDeleteResult> {
  const result = await MediaHTTPService.DeleteImage(imageRef);

  if (!result) {
    throw new Error('DeleteImage returned no result');
  }

  return result;
}

export function buildVersionedInlineImageUrl(asset: ImageAsset): string {
  const separator = asset.url.includes('?') ? '&' : '?';
  return `${asset.url}${separator}v=${encodeURIComponent(fallbackVersion(asset.updated_at))}`;
}

export function createInlineImageDataFromAsset(asset: ImageAsset, maxDisplayHeight: number): InlineImageData {
  const image: InlineImageData = {
    id: crypto.randomUUID(),
    assetRef: asset.id,
    file: buildVersionedInlineImageUrl(asset),
    width: asset.width,
    height: asset.height,
  };

  const aspect = asset.height > 0 ? asset.width / asset.height : 1;
  if ((asset.height / window.devicePixelRatio) > maxDisplayHeight) {
    image.displayHeight = maxDisplayHeight;
    image.displayWidth = maxDisplayHeight * aspect;
  }

  return image;
}

export function createInlineImageTagFromAsset(asset: ImageAsset, maxDisplayHeight: number): string {
  return createInlineImageTag(createInlineImageDataFromAsset(asset, maxDisplayHeight));
}
