import {EditorSelection, type Compartment} from '@codemirror/state';
import {EditorView, WidgetType} from '@codemirror/view';
import i18n from '@/i18n';
import {copyImage} from './clipboard';
import {inlineImageDrawManager} from './manager';
import {parseInlineImages, setInlineImageDisplayDimensions} from './inlineImageParsing';

const FOLDED_HEIGHT = 16;

function t(key: string): string {
  return i18n.global.t(key);
}

function withDialogCacheBust(url: string): string {
  const cleanUrl = url.trim();
  if (!cleanUrl) {
    return cleanUrl;
  }

  const separator = cleanUrl.includes('?') ? '&' : '?';
  return `${cleanUrl}${separator}dialog_ts=${Date.now()}`;
}

export interface InlineImageWidgetConfig {
  id: string;
  assetRef?: string;
  path: string;
  width: number;
  height: number;
  displayWidth?: number;
  displayHeight?: number;
  selected?: boolean;
  isFolded?: boolean;
  interactive?: boolean;
  domEventCompartment?: Compartment;
}

export class InlineImageWidget extends WidgetType {
  readonly id: string;
  readonly assetRef?: string;
  readonly path: string;
  readonly width: number;
  readonly height: number;
  readonly displayWidth?: number;
  readonly displayHeight?: number;
  readonly selected: boolean;
  readonly isFolded: boolean;
  readonly interactive: boolean;
  readonly domEventCompartment?: Compartment;
  readonly idealWidth: number;
  readonly idealHeight: number;

  constructor(config: InlineImageWidgetConfig) {
    super();
    this.id = config.id;
    this.assetRef = config.assetRef;
    this.path = config.path;
    this.width = config.width;
    this.height = config.height;
    this.displayWidth = config.displayWidth;
    this.displayHeight = config.displayHeight;
    this.selected = Boolean(config.selected);
    this.isFolded = Boolean(config.isFolded);
    this.interactive = config.interactive ?? true;
    this.domEventCompartment = config.domEventCompartment;
    this.idealWidth = this.width / window.devicePixelRatio;
    this.idealHeight = this.height / window.devicePixelRatio;
  }

  override eq(other: InlineImageWidget): boolean {
    return other.path === this.path
      && other.width === this.width
      && other.height === this.height
      && other.displayWidth === this.displayWidth
      && other.displayHeight === this.displayHeight
      && other.selected === this.selected
      && other.isFolded === this.isFolded
      && other.id === this.id
      && other.assetRef === this.assetRef
      && other.interactive === this.interactive;
  }

  override toDOM(view: EditorView): HTMLElement {
    const wrap = document.createElement('div');
    this.syncWrapClassName(wrap);
    wrap.dataset.id = this.id;
    wrap.dataset.idealWidth = String(this.idealWidth);
    wrap.dataset.idealHeight = String(this.idealHeight);
    this.attachSelectionBehavior(view, wrap);
    this.attachHoverBehavior(wrap);

    const inner = document.createElement('div');
    inner.className = 'inner';
    wrap.appendChild(inner);

    const highlightBorder = document.createElement('div');
    highlightBorder.className = 'highlight-border';
    inner.appendChild(highlightBorder);

    let copyButton: HTMLButtonElement | null = null;
    let drawButton: HTMLButtonElement | null = null;

    if (this.interactive && !this.isFolded) {
      const buttonsContainer = document.createElement('div');
      buttonsContainer.className = 'buttons-container';
      inner.appendChild(buttonsContainer);

      copyButton = document.createElement('button');
      copyButton.type = 'button';
      copyButton.title = t('inlineImage.copy');
      copyButton.innerHTML = `<span>${t('inlineImage.copy')}</span>`;
      buttonsContainer.appendChild(copyButton);

      drawButton = document.createElement('button');
      drawButton.type = 'button';
      drawButton.className = 'draw';
      drawButton.title = t('inlineImage.draw');
      drawButton.innerHTML = `<span>${t('inlineImage.draw')}</span>`;
      buttonsContainer.appendChild(drawButton);

      copyButton.addEventListener('mousedown', event => {
        event.preventDefault();
      });
      drawButton.addEventListener('mousedown', event => {
        event.preventDefault();
      });

      requestAnimationFrame(() => {
        this.syncControlScale(wrap, this.getNumericWidth(), buttonsContainer);
      });
    }

    const image = document.createElement('img');
    inner.appendChild(image);

    inner.appendChild(this.createMissingPlaceholder());
    this.syncImage(image, wrap);

    if (copyButton) {
      copyButton.addEventListener('click', async event => {
        event.preventDefault();
        try {
          await copyImage(image.src);
          copyButton!.innerText = t('inlineImage.copied');
          setTimeout(() => {
            copyButton!.innerHTML = `<span>${t('inlineImage.copy')}</span>`;
          }, 2000);
        } catch (error) {
          console.error('[inlineImage] Failed to copy image:', error);
        }
      });
    }

    if (drawButton) {
      drawButton.addEventListener('click', event => {
        event.preventDefault();
        const currentImage = parseInlineImages(view.state).find(image => image.id === this.id);
        const imageUrl = currentImage?.file || this.path;
        const assetRef = currentImage?.assetRef || this.assetRef || imageUrl;
        inlineImageDrawManager.show(view, this.id, assetRef, withDialogCacheBust(imageUrl));
      });
    }

    if (this.interactive && !this.isFolded && this.domEventCompartment) {
      const resizeHandle = document.createElement('div');
      resizeHandle.className = 'resize-handle';
      resizeHandle.innerHTML = '<div class="icon"></div>';
      wrap.appendChild(resizeHandle);
      this.attachResizeBehavior(view, wrap, image, resizeHandle);
    }

    return wrap;
  }

  override updateDOM(dom: HTMLElement): boolean {
    this.syncWrapClassName(dom);
    dom.dataset.id = this.id;
    dom.dataset.idealWidth = String(this.idealWidth);
    dom.dataset.idealHeight = String(this.idealHeight);
    const image = dom.querySelector('img');
    if (!(image instanceof HTMLImageElement)) {
      return false;
    }

    this.syncImage(image, dom);
    this.syncMissingPlaceholder(dom);
    this.syncControlScale(dom, this.getNumericWidth(), dom.querySelector('.buttons-container'));
    return true;
  }

  override ignoreEvent(): boolean {
    return false;
  }

  private getClassName(): string {
    return `inline-image${this.selected ? ' selected' : ''}${this.isFolded ? ' folded' : ''}`;
  }

  private syncWrapClassName(dom: HTMLElement): void {
    const isControlsVisible = dom.classList.contains('controls-visible');
    const isImageMissing = dom.classList.contains('image-missing');
    dom.className = this.getClassName();
    if (isControlsVisible) {
      dom.classList.add('controls-visible');
    }
    if (isImageMissing) {
      dom.classList.add('image-missing');
    }
  }

  private createMissingPlaceholder(): HTMLDivElement {
    const placeholder = document.createElement('div');
    placeholder.className = 'missing-placeholder';
    placeholder.title = t('inlineImage.missing');

    const content = document.createElement('div');
    content.className = 'missing-content';
    placeholder.appendChild(content);

    const icon = document.createElement('span');
    icon.className = 'missing-icon';
    icon.innerHTML = `
      <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <rect x="5" y="7" width="22" height="18" rx="2" stroke="currentColor" stroke-width="2" />
        <circle cx="12" cy="13" r="2" fill="currentColor" />
        <path d="M7 23L14 17L18 20L21 16L26 23" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    `;
    content.appendChild(icon);

    const text = document.createElement('span');
    text.className = 'missing-text';
    text.textContent = t('inlineImage.missing');
    content.appendChild(text);

    return placeholder;
  }

  private syncMissingPlaceholder(dom: HTMLElement): void {
    const placeholder = this.ensureMissingPlaceholder(dom);
    if (!placeholder) {
      return;
    }

    const message = t('inlineImage.missing');
    placeholder.title = message;
    const text = placeholder.querySelector('.missing-text');
    if (text instanceof HTMLElement) {
      text.textContent = message;
    }
  }

  private ensureMissingPlaceholder(dom: HTMLElement): HTMLElement | null {
    const placeholder = dom.querySelector('.missing-placeholder');
    if (placeholder instanceof HTMLElement) {
      return placeholder;
    }

    const inner = dom.querySelector('.inner');
    if (!(inner instanceof HTMLElement)) {
      return null;
    }

    const nextPlaceholder = this.createMissingPlaceholder();
    inner.appendChild(nextPlaceholder);
    return nextPlaceholder;
  }

  private syncImage(image: HTMLImageElement, wrap: HTMLElement): void {
    this.syncMissingPlaceholder(wrap);
    const source = this.path;
    image.alt = t('inlineImage.imageAlt');
    image.style.width = this.getWidth();
    image.style.height = this.getHeight();
    image.onload = () => {
      if (image.getAttribute('src') === source) {
        wrap.classList.remove('image-missing');
      }
    };
    image.onerror = () => {
      if (image.getAttribute('src') === source) {
        wrap.classList.add('image-missing');
      }
    };

    if (image.getAttribute('src') !== source) {
      wrap.classList.remove('image-missing');
    }

    image.src = source;
    if (image.complete && image.naturalWidth === 0 && image.getAttribute('src') === source) {
      wrap.classList.add('image-missing');
    }
  }

  private getWidth(): string {
    const width = this.getNumericWidth();

    return width ? `${width}px` : '';
  }

  private getNumericWidth(): number | undefined {
    let width: number | undefined;

    if (this.isFolded) {
      width = FOLDED_HEIGHT * (this.width / this.height);
    } else if (this.displayWidth) {
      width = this.displayWidth;
    } else {
      width = this.idealWidth;
    }

    return width;
  }

  private getHeight(): string {
    let height: number;

    if (this.isFolded) {
      height = FOLDED_HEIGHT;
    } else if (this.displayHeight) {
      height = this.displayHeight;
    } else {
      height = this.idealHeight;
    }

    return `${height}px`;
  }

  private attachHoverBehavior(wrap: HTMLDivElement): void {
    wrap.addEventListener('mouseenter', () => {
      wrap.classList.add('controls-visible');
    });

    wrap.addEventListener('mouseleave', () => {
      wrap.classList.remove('controls-visible');
    });
  }

  private attachSelectionBehavior(view: EditorView, wrap: HTMLDivElement): void {
    wrap.addEventListener('mousedown', event => {
      if (event.button !== 0) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      if (target.closest('button, .resize-handle')) {
        return;
      }

      const currentImage = parseInlineImages(view.state).find(image => image.id === this.id);
      if (!currentImage) {
        return;
      }

      event.preventDefault();
      view.focus();
      view.dispatch({
        selection: EditorSelection.cursor(currentImage.from, 1),
        scrollIntoView: true,
      });
    });
  }

  private attachResizeBehavior(
    view: EditorView,
    wrap: HTMLDivElement,
    image: HTMLImageElement,
    resizeHandle: HTMLDivElement,
  ): void {
    let initialWidth = 0;
    let initialHeight = 0;
    let initialX = 0;
    let initialY = 0;
    let shouldSnap = true;

    const onMouseMove = (event: MouseEvent) => {
      const idealWidth = Number(wrap.dataset.idealWidth);
      const idealHeight = Number(wrap.dataset.idealHeight);
      const aspect = idealWidth / idealHeight;

      let width = initialWidth + (event.pageX - initialX);
      let height = initialHeight + (event.pageY - initialY);

      const heightFromWidth = width / aspect;
      const widthFromHeight = height * aspect;

      if (heightFromWidth <= height) {
        height = heightFromWidth;
      } else {
        width = widthFromHeight;
      }

      const snapTolerance = 10;
      if (shouldSnap) {
        if (Math.abs(width - idealWidth) <= snapTolerance || Math.abs(height - idealHeight) <= snapTolerance) {
          width = idealWidth;
          wrap.classList.add('snapped');
        } else {
          wrap.classList.remove('snapped');
        }
      } else if (Math.abs(width - idealWidth) > snapTolerance && Math.abs(height - idealHeight) > snapTolerance) {
        shouldSnap = true;
      }

      width = Math.max(width, 16);
      height = width / aspect;
      if (height < 17) {
        height = 17;
        width = height * aspect;
      }

      image.style.width = `${width}px`;
      image.style.height = `${height}px`;
      this.syncControlScale(wrap, width, wrap.querySelector('.buttons-container'));
    };

    const endResize = () => {
      view.dispatch({
        effects: [this.domEventCompartment!.reconfigure([])],
      });
      setInlineImageDisplayDimensions(view, wrap.dataset.id || '', image.width, image.height);
      setTimeout(() => {
        wrap.classList.remove('resizing');
      }, 200);
    };

    resizeHandle.addEventListener('mousedown', event => {
      event.preventDefault();
      initialWidth = image.getBoundingClientRect().width;
      initialHeight = image.getBoundingClientRect().height;
      initialX = event.pageX;
      initialY = event.pageY;
      shouldSnap = initialWidth !== this.idealWidth;
      wrap.classList.add('resizing');

      view.dispatch({
        effects: [this.domEventCompartment!.reconfigure([
          EditorView.domEventObservers({
            mousemove: moveEvent => {
              onMouseMove(moveEvent as MouseEvent);
            },
            mouseup: () => {
              endResize();
            },
            mouseleave: () => {
              endResize();
            },
          }),
          EditorView.editorAttributes.of({class: 'resizing-image'}),
        ])],
      });
    });
  }

  private syncControlScale(dom: HTMLElement, width?: number, buttonsContainer?: Element | null): void {
    if (!width || this.isFolded || !(buttonsContainer instanceof HTMLElement)) {
      dom.style.removeProperty('--button-scale');
      return;
    }

    const buttonsWidth = this.measureButtonsIntrinsicWidth(buttonsContainer);
    if (!buttonsWidth) {
      dom.style.removeProperty('--button-scale');
      return;
    }

    const scale = Math.min(1, width / buttonsWidth);
    dom.style.setProperty('--button-scale', scale.toFixed(3));
  }

  private measureButtonsIntrinsicWidth(buttonsContainer: HTMLElement): number {
    const cached = Number(buttonsContainer.dataset.intrinsicWidth || '0');
    const previousWidth = buttonsContainer.style.width;
    const previousMaxWidth = buttonsContainer.style.maxWidth;

    buttonsContainer.style.width = 'max-content';
    buttonsContainer.style.maxWidth = 'none';

    const measured = buttonsContainer.scrollWidth;

    buttonsContainer.style.width = previousWidth;
    buttonsContainer.style.maxWidth = previousMaxWidth;

    if (measured > 0) {
      buttonsContainer.dataset.intrinsicWidth = String(measured);
      return measured;
    }

    return cached;
  }
}
