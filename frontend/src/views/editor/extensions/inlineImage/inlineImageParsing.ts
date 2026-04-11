import {EditorSelection, type EditorState} from '@codemirror/state';
import type {EditorView} from '@codemirror/view';
import {codeBlockEvent, CONTENT_EDIT} from '../codeblock/annotation';
import type {InlineImageData, ParsedInlineImage} from './types';

export const INLINE_IMAGE_TAG_REGEX = /<∞img;([^∞>]*)∞>/g;
export const WIDGET_TAG_REGEX = /<∞.*?∞>/g;
export const WIDGET_TAG_REGEX_NON_GLOBAL = /<∞.*?∞>/;

const REQUIRED_PARAMS = ['id', 'file', 'w', 'h'] as const;

export function parseInlineImages(state: EditorState): ParsedInlineImage[] {
  return parseInlineImagesFromString(state.doc.sliceString(0, state.doc.length));
}

/**
 * 解析以下格式的图片标签：
 * <∞img;id=uuid;file=/media/2026/04/foo.png;w=1200;h=630;dw=324;dh=170∞>
 */
export function parseInlineImagesFromString(content: string): ParsedInlineImage[] {
  INLINE_IMAGE_TAG_REGEX.lastIndex = 0;

  let match: RegExpExecArray | null;
  const images: ParsedInlineImage[] = [];

  while ((match = INLINE_IMAGE_TAG_REGEX.exec(content)) !== null) {
    try {
      const params: Record<string, string | true> = {};

      for (const part of match[1].split(';')) {
        if (!part) {
          continue;
        }

        const eqIndex = part.indexOf('=');
        if (eqIndex === -1) {
          params[part] = true;
          continue;
        }

        params[part.slice(0, eqIndex)] = part.slice(eqIndex + 1);
      }

      if (!REQUIRED_PARAMS.every(param => Object.hasOwn(params, param))) {
        continue;
      }

      images.push({
        from: match.index,
        to: match.index + match[0].length,
        id: String(params.id),
        assetRef: params.asset ? String(params.asset) : undefined,
        file: String(params.file),
        width: Number(params.w),
        height: Number(params.h),
        displayWidth: params.dw ? Number(params.dw) : undefined,
        displayHeight: params.dh ? Number(params.dh) : undefined,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[inlineImage] Bad <∞img> tag at index ${match.index}: ${message}. Tag: ${match[0]}`);
    }
  }

  return images;
}

export function createInlineImageTag(image: InlineImageData): string {
  const params = [
    `id=${image.id}`,
    ...(image.assetRef ? [`asset=${image.assetRef}`] : []),
    `file=${image.file}`,
    `w=${image.width}`,
    `h=${image.height}`,
  ];

  if (image.displayWidth) {
    params.push(`dw=${image.displayWidth}`);
  }
  if (image.displayHeight) {
    params.push(`dh=${image.displayHeight}`);
  }

  return `<∞img;${params.join(';')}∞>`;
}

export function setInlineImageDisplayDimensions(
  view: EditorView,
  id: string,
  width: number,
  height: number,
): void {
  const images = Object.fromEntries(parseInlineImages(view.state).map(image => [image.id, image]));
  const image = images[id];

  if (!image) {
    return;
  }

  image.displayWidth = width;
  image.displayHeight = height;

  view.dispatch(view.state.update({
    changes: {
      from: image.from,
      to: image.to,
      insert: createInlineImageTag(image),
    },
    annotations: [codeBlockEvent.of(CONTENT_EDIT)],
  }));
}

export function setInlineImageFile(view: EditorView, id: string, file: string): void {
  const images = Object.fromEntries(parseInlineImages(view.state).map(image => [image.id, image]));
  const image = images[id];

  if (!image) {
    console.error(`[inlineImage] Image with id ${id} not found`);
    return;
  }

  image.file = file;
  const nextTag = createInlineImageTag(image);

  view.dispatch(view.state.update({
    changes: {
      from: image.from,
      to: image.to,
      insert: nextTag,
    },
    selection: EditorSelection.cursor(image.from + nextTag.length, -1),
  }, {scrollIntoView: true}));
}

export function updateInlineImageData(view: EditorView, id: string, patch: Partial<InlineImageData>): void {
  const images = Object.fromEntries(parseInlineImages(view.state).map(image => [image.id, image]));
  const image = images[id];

  if (!image) {
    console.error(`[inlineImage] Image with id ${id} not found`);
    return;
  }

  Object.assign(image, patch);
  const nextTag = createInlineImageTag(image);

  view.dispatch(view.state.update({
    changes: {
      from: image.from,
      to: image.to,
      insert: nextTag,
    },
    selection: EditorSelection.cursor(image.from + nextTag.length, -1),
  }, {scrollIntoView: true}));
}

export function removeInlineImage(view: EditorView, id: string): void {
  const images = Object.fromEntries(parseInlineImages(view.state).map(image => [image.id, image]));
  const image = images[id];

  if (!image) {
    console.error(`[inlineImage] Image with id ${id} not found`);
    return;
  }

  view.dispatch(view.state.update({
    changes: {
      from: image.from,
      to: image.to,
      insert: '',
    },
    annotations: [codeBlockEvent.of(CONTENT_EDIT)],
  }, {scrollIntoView: true}));
}
