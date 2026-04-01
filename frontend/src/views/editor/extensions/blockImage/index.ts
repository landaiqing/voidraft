import {snapdom} from '@zumer/snapdom';
import {Facet, type Extension} from '@codemirror/state';
import {type Command, EditorView} from '@codemirror/view';
import {getActiveNoteBlock} from '../codeblock/state';
import {canvasToPngBlob, writeImageToClipboard} from './clipboard';
import {OffscreenBlockExportSession} from './session';
import type {BlockImageExtensionOptions} from './types';

const DEFAULT_BLOCK_IMAGE_OPTIONS = {
  minWidth: 360,
  maxWidth: 1200,
  scale: 2,
  captureExcludeSelectors: [],
} as const satisfies BlockImageExtensionOptions;

function createDefaultBlockImageOptions(): BlockImageExtensionOptions {
  return {
    ...DEFAULT_BLOCK_IMAGE_OPTIONS,
    captureExcludeSelectors: [...DEFAULT_BLOCK_IMAGE_OPTIONS.captureExcludeSelectors],
  };
}

function mergeBlockImageOptions(
  base: BlockImageExtensionOptions,
  patch: Partial<BlockImageExtensionOptions>,
): BlockImageExtensionOptions {
  return {
    ...base,
    ...patch,
    captureExcludeSelectors: [
      ...base.captureExcludeSelectors,
      ...(patch.captureExcludeSelectors ?? []),
    ],
  };
}

async function copyActiveBlockAsImage(view: EditorView): Promise<boolean> {
  const activeBlock = getActiveNoteBlock(view.state);
  if (!activeBlock) {
    console.warn('[blockImage] No active block found');
    return false;
  }

  const options = view.state.facet(blockImageOptionsFacet);
  const targetDom = view.scrollDOM || document.body;
  const prevCursor = (targetDom as HTMLElement).style.cursor;
  (targetDom as HTMLElement).style.cursor = 'progress';

  let session: OffscreenBlockExportSession | null = null;

  try {
    session = await OffscreenBlockExportSession.create(view, activeBlock, options);
    await session.settle();

    const canvas = await snapdom.toCanvas(session.root, {
      scale: options.scale,
      dpr: 1,
      cache: 'auto',
      embedFonts: true,
      backgroundColor: getComputedStyle(session.root).backgroundColor,
      outerShadows: true,
      exclude: [...session.captureExcludeSelectors],
    });

    const blob = await canvasToPngBlob(canvas);
    await writeImageToClipboard(blob);
    return true;
  } catch (error) {
    console.error('[blockImage] Failed to copy block image:', error);
    return false;
  } finally {
    session?.destroy();
    (targetDom as HTMLElement).style.cursor = prevCursor;
  }
}

export const copyBlockImageCommand: Command = view => {
  void copyActiveBlockAsImage(view);
  return true;
};

export const blockImageEnabledFacet = Facet.define<boolean, boolean>({
  combine: values => values.some(Boolean),
});

export const blockImageOptionsFacet = Facet.define<Partial<BlockImageExtensionOptions>, BlockImageExtensionOptions>({
  combine: values =>
    values.reduce<BlockImageExtensionOptions>(
      (merged, value) => mergeBlockImageOptions(merged, value),
      createDefaultBlockImageOptions(),
    ),
});

export function createBlockImageExtension(options: Partial<BlockImageExtensionOptions> = {}): Extension {
  return [
    blockImageEnabledFacet.of(true),
    blockImageOptionsFacet.of(options),
  ];
}

export default createBlockImageExtension;
