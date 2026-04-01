import type {Extension} from '@codemirror/state';
import type {Block} from '../codeblock/types';

export interface BlockImageExtensionOptions {
  minWidth: number;
  maxWidth: number;
  scale: number;
  captureExcludeSelectors: readonly string[];
}

export interface BlockImageExportDescriptor {
  readonly source: Block;
  readonly sourceIndex: number;
  readonly document: string;
  readonly width: number;
}

export interface BlockImageExportAppearance {
  readonly backgroundColor: string;
  readonly borderColor: string;
  readonly shadow: string;
  readonly foregroundColor: string;
  readonly fontFamily: string;
  readonly fontSize: number;
  readonly lineHeight: number;
  readonly fontWeight: string;
  readonly languageLabel: string | null;
}

export interface BlockImageExportPreset {
  readonly appearance: BlockImageExportAppearance;
  readonly extensions: Extension[];
  readonly hiddenSelectors: readonly string[];
}
