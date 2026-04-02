export interface ImageBlockItem {
  ref: string;
  src: string;
  alt?: string;
  title?: string;
  width?: number;
  height?: number;
}

export interface ImageBlockSelection {
  anchor: number;
  itemIndex: number | null;
}
