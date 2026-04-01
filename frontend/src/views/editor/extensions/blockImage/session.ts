import {EditorState} from '@codemirror/state';
import {EditorView} from '@codemirror/view';
import {blockState} from '../codeblock/state';
import type {Block} from '../codeblock/types';
import {createBlockImageExportPreset} from './exportPreset';
import type {
  BlockImageExportDescriptor,
  BlockImageExtensionOptions,
} from './types';

const DEFAULT_EXPORT_WIDTH = 720;
const HIDDEN_MOUNT_STYLE = [
  'position:fixed',
  'left:-20000px',
  'top:0',
  'pointer-events:none',
  'z-index:-1',
  'contain:layout style paint',
].join(';');

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function nextAnimationFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

async function waitForAnimationFrames(count: number): Promise<void> {
  for (let index = 0; index < count; index++) {
    await nextAnimationFrame();
  }
}

function waitForEditorMeasure(view: EditorView): Promise<void> {
  return new Promise(resolve => {
    view.requestMeasure({
      read() {},
      write() {
        resolve();
      },
    });
  });
}

async function waitForFonts(): Promise<void> {
  await document.fonts?.ready;
}

async function waitForImages(root: ParentNode): Promise<void> {
  const images = Array.from(root.querySelectorAll('img'));
  if (images.length === 0) {
    return;
  }

  await Promise.allSettled(images.map(image => new Promise<void>(resolve => {
    try {
      image.loading = 'eager';
      image.decoding = 'sync';
    } catch {
      // ignore readonly browser fields
    }

    if (image.complete) {
      resolve();
      return;
    }

    const complete = () => resolve();
    image.addEventListener('load', complete, {once: true});
    image.addEventListener('error', complete, {once: true});
  })));
}

function resolveDescriptor(
  sourceView: EditorView,
  block: Block,
  options: BlockImageExtensionOptions,
): BlockImageExportDescriptor {
  const blocks = sourceView.state.field(blockState, false) ?? [];
  const sourceIndex = Math.max(0, blocks.indexOf(block));
  const contentWidth = sourceView.contentDOM.clientWidth || sourceView.dom.clientWidth || DEFAULT_EXPORT_WIDTH;

  return {
    source: block,
    sourceIndex,
    document: sourceView.state.doc.sliceString(block.range.from, block.range.to),
    width: clamp(contentWidth, options.minWidth, options.maxWidth),
  };
}


export class OffscreenBlockExportSession {
  readonly root: HTMLElement;
  readonly captureExcludeSelectors: readonly string[];

  readonly #mount: HTMLDivElement;
  readonly #view: EditorView;

  private constructor(mount: HTMLDivElement, root: HTMLElement, view: EditorView, captureExcludeSelectors: readonly string[]) {
    this.#mount = mount;
    this.root = root;
    this.#view = view;
    this.captureExcludeSelectors = captureExcludeSelectors;
  }

  static create(
    sourceView: EditorView,
    block: Block,
    options: BlockImageExtensionOptions,
  ): Promise<OffscreenBlockExportSession> {
    return OffscreenBlockExportSession.#create(sourceView, block, options);
  }

  static async #create(
    sourceView: EditorView,
    block: Block,
    options: BlockImageExtensionOptions,
  ): Promise<OffscreenBlockExportSession> {
    const descriptor = resolveDescriptor(sourceView, block, options);
    const preset = await createBlockImageExportPreset(block, descriptor.sourceIndex);

    const mount = document.createElement('div');
    mount.style.cssText = HIDDEN_MOUNT_STYLE;

    const root = document.createElement('div');
    root.className = 'block-export-capture-root';
    root.style.cssText = [
      `display:inline-block`,
      `position:relative`,
      `box-sizing:border-box`,
      `padding:18px 22px`,
      `color:${preset.appearance.foregroundColor}`,
      `font-family:${preset.appearance.fontFamily}`,
      `font-size:${preset.appearance.fontSize}px`,
      `line-height:${preset.appearance.lineHeight}`,
      `font-weight:${preset.appearance.fontWeight}`,
    ].join(';');

    const host = document.createElement('div');
    host.className = 'block-export-editor-host';
    host.style.cssText = [
      'position:relative',
      `width:${descriptor.width}px`,
      'max-width:100%',
    ].join(';');

    root.appendChild(host);
    mount.appendChild(root);
    document.body.appendChild(mount);

    const state = EditorState.create({
      doc: descriptor.document,
      extensions: preset.extensions,
      selection: {anchor: 0},
    });

    const view = new EditorView({
      state,
      parent: host,
    });

    return new OffscreenBlockExportSession(
      mount,
      root,
      view,
      [...preset.hiddenSelectors, ...options.captureExcludeSelectors],
    );
  }

  async settle(): Promise<void> {
    await waitForEditorMeasure(this.#view);
    await waitForAnimationFrames(2);
    await Promise.allSettled([
      waitForFonts(),
      waitForImages(this.root),
    ]);
    await waitForAnimationFrames(1);
  }

  destroy(): void {
    this.#view.destroy();
    this.#mount.remove();
  }
}
