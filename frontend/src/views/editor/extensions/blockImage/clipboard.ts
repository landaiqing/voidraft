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

export async function writeImageToClipboard(blob: Blob, mimeType = blob.type || 'image/png'): Promise<void> {
  const ClipboardItemCtor = globalThis.ClipboardItem;
  if (!ClipboardItemCtor || !navigator.clipboard?.write) {
    throw new Error('Clipboard image write is not supported in this environment');
  }

  const resolvedType = mimeType.startsWith('image/') ? mimeType : 'image/png';
  await navigator.clipboard.write([
    new ClipboardItemCtor({[resolvedType]: blob}),
  ]);
}
