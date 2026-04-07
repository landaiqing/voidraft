export interface InlineImageOptions {
  maxDisplayHeight: number;
}

export interface InlineImageData {
  id: string;
  assetRef?: string;
  file: string;
  width: number;
  height: number;
  displayWidth?: number;
  displayHeight?: number;
}

export interface ParsedInlineImage extends InlineImageData {
  from: number;
  to: number;
}
