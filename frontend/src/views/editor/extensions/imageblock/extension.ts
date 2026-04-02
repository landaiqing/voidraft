import type {Extension} from '@codemirror/state';
import {getImageBlockRenderExtensions} from './render';
import {imageBlockSelectionField} from './selection';

export function getImageBlockExtensions(): Extension[] {
  return [
    imageBlockSelectionField,
    ...getImageBlockRenderExtensions(),
  ];
}
