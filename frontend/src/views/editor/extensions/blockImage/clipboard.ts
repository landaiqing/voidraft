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

export async function writeImageToClipboard(blob: Blob): Promise<void> {
  const ClipboardItemCtor = globalThis.ClipboardItem;
  if (!ClipboardItemCtor || !navigator.clipboard?.write) {
    throw new Error('Clipboard image write is not supported in this environment');
  }

  await navigator.clipboard.write([
    new ClipboardItemCtor({'image/png': blob}),
  ]);
}
