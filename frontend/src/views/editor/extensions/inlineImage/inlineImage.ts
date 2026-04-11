import {Compartment, RangeSetBuilder, StateField, type Extension, type SelectionRange, type Transaction} from '@codemirror/state';
import {foldEffect, foldState, unfoldEffect} from '@codemirror/language';
import {Decoration, type DecorationSet, EditorView, ViewPlugin} from '@codemirror/view';
import copyDarkIconUrl from '@/assets/icons/copy-dark.svg';
import pencilWhiteIconUrl from '@/assets/icons/pencil-white.svg';
import resizeHandleDarkUrl from '@/assets/icons/resize-handle-se-dark.png';
import resizeHandleLightUrl from '@/assets/icons/resize-handle-se-light.png';
import trashWhiteIconUrl from '@/assets/icons/trash-white.svg';
import {parseInlineImages} from './inlineImageParsing';
import {InlineImageWidget} from './inlineImageWidget';
import type {ParsedInlineImage} from './types';

export const inlineImageState = StateField.define<readonly ParsedInlineImage[]>({
  create(state) {
    return parseInlineImages(state);
  },
  update(images, transaction) {
    if (transaction.docChanged) {
      return parseInlineImages(transaction.state);
    }
    return images;
  },
});

function createAtomicRanges(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();

  view.state.field(inlineImageState).forEach(image => {
    builder.add(image.from, image.to, Decoration.mark({}));
  });

  return builder.finish();
}

const atomicInlineImages = ViewPlugin.fromClass(class {
  atomicRanges: DecorationSet;

  constructor(view: EditorView) {
    this.atomicRanges = createAtomicRanges(view);
  }

  update(update: {docChanged: boolean; view: EditorView}) {
    if (update.docChanged) {
      this.atomicRanges = createAtomicRanges(update.view);
    }
  }
}, {
  provide: plugin => EditorView.atomicRanges.of(view => view.plugin(plugin)?.atomicRanges || Decoration.none),
});

function transactionHasFoldEffect(transaction: Transaction): boolean {
  return transaction.effects.some(effect => effect.is(foldEffect) || effect.is(unfoldEffect));
}

function createInlineImageTheme(): Extension {
  return EditorView.baseTheme({
    '&.cm-editor.resizing-image': {
      cursor: 'nwse-resize',
    },
    '.inline-image': {
      '--outline-color': '#2482ce',
      '--snapped-outline-color': '#39a363',
      '--handle-color': '#ccc',
      '--image-border-color': '#c9c9c9',
      padding: '6px 2px',
      display: 'inline-block',
      position: 'relative',
      verticalAlign: 'middle',
    },
    '&.cm-dark .inline-image': {
      '--outline-color': '#0060c7',
      '--snapped-outline-color': '#39a363',
      '--handle-color': '#192736',
      '--image-border-color': '#252525',
    },
    '.inline-image.folded': {
      padding: '0',
    },
    '.inline-image.folded.selected': {
      padding: '0',
    },
    '.inline-image.folded .resize-handle': {
      display: 'none',
    },
    '.inline-image .inner': {
      position: 'relative',
      border: '1px solid var(--image-border-color)',
    },
    '.inline-image.controls-visible .buttons-container': {
      opacity: '1',
    },
    '.inline-image.selected .buttons-container': {
      opacity: '1',
    },
    '.inline-image img': {
      display: 'block',
      maxWidth: '100%',
      minWidth: '16px',
      minHeight: '16px',
      objectFit: 'contain',
    },
    '.inline-image .highlight-border': {
      display: 'none',
      position: 'absolute',
      top: '-2px',
      right: '-2px',
      bottom: '-2px',
      left: '-2px',
      border: '3px solid var(--outline-color)',
      boxSizing: 'border-box',
      pointerEvents: 'none',
    },
    '.inline-image .buttons-container': {
      position: 'absolute',
      inset: '0',
      display: 'flex',
      padding: '7px',
      alignItems: 'flex-start',
      justifyContent: 'left',
      boxSizing: 'border-box',
      gap: '4px',
      opacity: '0',
      overflow: 'hidden',
      containerType: 'inline-size',
      pointerEvents: 'none',
    },
    '.inline-image .buttons-container button': {
      height: 'calc(24px * var(--button-scale, 1))',
      fontSize: 'calc(12px * var(--button-scale, 1))',
      backgroundColor: '#646e71',
      color: '#fff',
      opacity: '1',
      transition: 'background-color 200ms',
      backgroundImage: `url("${copyDarkIconUrl}")`,
      backgroundSize: 'calc(13px * var(--button-scale, 1))',
      backgroundPosition: 'calc(6px * var(--button-scale, 1)) center',
      backgroundRepeat: 'no-repeat',
      padding: 'calc(3px * var(--button-scale, 1)) calc(7px * var(--button-scale, 1)) calc(3px * var(--button-scale, 1)) calc(22px * var(--button-scale, 1))',
      border: 'none',
      borderRadius: 'calc(3px * var(--button-scale, 1))',
      cursor: 'pointer',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
      minWidth: '0',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      flex: '0 1 auto',
      maxWidth: '100%',
      pointerEvents: 'auto',
    },
    '.inline-image .buttons-container button span': {
      display: 'block',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
    '.inline-image .buttons-container button:hover': {
      backgroundColor: '#51595c',
      opacity: '1',
    },
    '.inline-image .buttons-container button.draw': {
      backgroundImage: `url("${pencilWhiteIconUrl}")`,
    },
    '.inline-image .buttons-container button.delete': {
      backgroundImage: `url("${trashWhiteIconUrl}")`,
      padding: 'calc(3px * var(--button-scale, 1)) calc(8px * var(--button-scale, 1)) calc(3px * var(--button-scale, 1)) calc(22px * var(--button-scale, 1))',
      backgroundColor: '#8f3d3d',
    },
    '.inline-image .buttons-container button.delete:hover': {
      backgroundColor: '#7c3131',
    },
    '.inline-image.selected': {
      '--handle-color': 'var(--outline-color)',
    },
    '.inline-image.selected .highlight-border': {
      display: 'block',
    },
    '.inline-image.selected .resize-handle': {
      opacity: '1',
    },
    '.inline-image.selected .resize-handle .icon': {
      backgroundImage: `url("${resizeHandleDarkUrl}")`,
    },
    '.inline-image:hover .resize-handle': {
      opacity: '0.5',
    },
    '.inline-image:hover .resize-handle:hover': {
      opacity: '1',
    },
    '.inline-image .resize-handle': {
      opacity: '0',
      transition: 'opacity 200ms',
      width: '0',
      height: '0',
      position: 'absolute',
      right: '2px',
      bottom: '6px',
      borderBottom: '10px solid var(--handle-color)',
      borderRight: '10px solid var(--handle-color)',
      borderLeft: '10px solid transparent',
      borderTop: '10px solid transparent',
      cursor: 'nwse-resize',
      zIndex: '10',
    },
    '.inline-image .resize-handle .icon': {
      position: 'absolute',
      top: '-4px',
      left: '-4px',
      backgroundImage: `url("${resizeHandleLightUrl}")`,
      backgroundSize: '100%',
      width: '12px',
      height: '12px',
    },
    '&.cm-dark .inline-image .resize-handle .icon': {
      backgroundImage: `url("${resizeHandleDarkUrl}")`,
    },
    '.inline-image.resizing .buttons-container': {
      display: 'none',
    },
    '.inline-image.resizing .resize-handle': {
      opacity: '1',
      transition: 'none',
    },
    '.inline-image.resizing.snapped': {
      '--outline-color': 'var(--snapped-outline-color)',
    },
  });
}

export interface InlineImageWidgetExtensionOptions {
  interactive?: boolean;
}

export function createInlineImageWidgetExtension(options: InlineImageWidgetExtensionOptions = {}): Extension {
  const interactive = options.interactive ?? true;
  const domEventCompartment = interactive ? new Compartment() : null;

  const decorate = (state: EditorView['state']): DecorationSet => {
    const builder = new RangeSetBuilder<Decoration>();
    const selection = state.selection.main;
    const foldStarts = new Set<number>();
    const foldRanges = state.field(foldState, false);

    if (foldRanges) {
      foldRanges.between(0, state.doc.length, from => {
        foldStarts.add(from);
      });
    }

    let foundSelectedInlineImage = false;

    state.field(inlineImageState).forEach(image => {
      const isFolded = foldStarts.has(image.to);
      const isSelected = !foundSelectedInlineImage && inlineImageIsSelected(image, selection);

      if (isSelected) {
        foundSelectedInlineImage = true;
      }

      builder.add(image.from, image.to, Decoration.replace({
        widget: new InlineImageWidget({
          id: image.id,
          assetRef: image.assetRef,
          path: image.file,
          width: image.width,
          height: image.height,
          displayWidth: image.displayWidth,
          displayHeight: image.displayHeight,
          selected: isSelected,
          isFolded,
          interactive,
          domEventCompartment: domEventCompartment ?? undefined,
        }),
        inclusive: false,
        block: false,
        side: 0,
      }));
    });

    return builder.finish();
  };

  const inlineImagesField = StateField.define<DecorationSet>({
    create(state) {
      return decorate(state);
    },
    update(widgets, transaction) {
      if (transaction.docChanged || transaction.selection || transactionHasFoldEffect(transaction)) {
        return decorate(transaction.state);
      }
      return widgets;
    },
    provide(field) {
      return EditorView.decorations.from(field);
    },
  });

  return [
    inlineImageState,
    inlineImagesField,
    atomicInlineImages,
    createInlineImageTheme(),
    ...(domEventCompartment ? [domEventCompartment.of([])] : []),
  ];
}

export function inlineImageIsSelected(image: ParsedInlineImage, selection: SelectionRange): boolean {
  if (selection.from !== selection.to) {
    return false;
  }

  if (selection.from === image.from) {
    return selection.assoc >= 0;
  }

  if (selection.from === image.to) {
    return selection.assoc < 0;
  }

  return false;
}
