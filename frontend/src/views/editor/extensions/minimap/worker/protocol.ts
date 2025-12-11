/**
 * Worker Communication Protocol
 */

export interface TagSpan {
  text: string;
  tags: string;
}

export interface Highlight {
  from: number;
  to: number;
  tags: string;
}

export interface LineSpan {
  from: number;
  to: number;
  folded: boolean;
}

export interface FontInfo {
  color: string;
  font: string;
  lineHeight: number;
}

export interface BlockRequest {
  type: 'renderBlock';
  blockId: number;
  blockIndex: number;
  startLine: number;
  endLine: number;
  width: number;
  height: number;
  highlights: Highlight[];
  lines: LineSpan[][];
  textSlice: string;
  textOffset: number;
  fontInfoMap: Record<string, FontInfo>;
  defaultFont: FontInfo;
  displayText: 'blocks' | 'characters';
  charWidth: number;
  lineHeight: number;
  gutterOffset: number;
}

export interface InitRequest {
  type: 'init';
}

export interface DestroyRequest {
  type: 'destroy';
}

export type ToWorkerMessage = BlockRequest | InitRequest | DestroyRequest;

export interface BlockComplete {
  type: 'blockComplete';
  blockId: number;
  blockIndex: number;
  bitmap: ImageBitmap;
}

export interface WorkerReady {
  type: 'ready';
}

export interface WorkerError {
  type: 'error';
  message: string;
}

export type ToMainMessage = BlockComplete | WorkerReady | WorkerError;
