import { Facet } from "@codemirror/state";
import { EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { Overlay } from "./overlay";
import { Config, Options, Scale } from "./config";
import { DiagnosticState, diagnostics } from "./diagnostics";
import { SelectionState, selections } from "./selections";
import { TextState, text } from "./text";
import { LinesState } from "./linesState";
import crelt from "crelt";
import { GUTTER_WIDTH, drawLineGutter } from "./gutters";

const Theme = EditorView.theme({
  "&": {
    height: "100%",
    overflowY: "auto",
  },
  "& .cm-minimap-gutter": {
    borderRight: 0,
    flexShrink: 0,
    left: "unset",
    position: "sticky",
    right: 0,
    top: 0,
  },
  '& .cm-minimap-autohide': {
    opacity: 0.0,
    transition: 'opacity 0.3s',
  },
  '& .cm-minimap-autohide:hover': {
    opacity: 1.0,
  },
  "& .cm-minimap-inner": {
    height: "100%",
    position: "absolute",
    right: 0,
    top: 0,
    overflowY: "hidden",
    "& canvas": {
      display: "block",
    },
  },
  "& .cm-minimap-box-shadow": {
    boxShadow: "12px 0px 20px 5px #6c6c6c",
  },
});

const WIDTH_RATIO = 6;

const minimapClass = ViewPlugin.fromClass(
  class {
    private dom: HTMLElement | undefined;
    private inner: HTMLElement | undefined;
    private canvas: HTMLCanvasElement | undefined;
    private renderHandle: number | ReturnType<typeof setTimeout> | null = null;
    private cancelRender: (() => void) | null = null;

    public text: TextState;
    public selection: SelectionState;
    public diagnostic: DiagnosticState;

    public constructor(private view: EditorView) {
      this.text = text(view);
      this.selection = selections(view);
      this.diagnostic = diagnostics(view);

      if (view.state.facet(showMinimapFacet)) {
        this.create(view);
      }
    }

    private create(view: EditorView) {
      const config = view.state.facet(showMinimapFacet);
      if (!config) {
        throw Error("Expected nonnull");
      }

      this.inner = crelt("div", { class: "cm-minimap-inner" });
      this.canvas = crelt("canvas") as HTMLCanvasElement;

      this.dom = config.create(view).dom;
      this.dom.classList.add("cm-gutters");
      this.dom.classList.add("cm-minimap-gutter");

      this.inner.appendChild(this.canvas);
      this.dom.appendChild(this.inner);

      // For now let's keep this same behavior. We might want to change
      // this in the future and have the extension figure out how to mount.
      // Or expose some more generic right gutter api and use that
      this.view.scrollDOM.insertBefore(
        this.dom,
        this.view.contentDOM.nextSibling
      );

      for (const key in this.view.state.facet(Config).eventHandlers) {
        const handler = this.view.state.facet(Config).eventHandlers[key];
        if (handler) {
          this.dom.addEventListener(key, (e) => handler(e, this.view));
        }
      }

      if (config.autohide) {
        this.dom.classList.add('cm-minimap-autohide');
      }

      this.requestRender();
    }

    private remove() {
      this.cancelRenderRequest();
      if (this.dom) {
        this.dom.remove();
      }
      this.dom = undefined;
      this.inner = undefined;
      this.canvas = undefined;
    }

    update(update: ViewUpdate) {
      const prev = update.startState.facet(showMinimapFacet);
      const now = update.state.facet(showMinimapFacet);

      if (prev && !now) {
        this.remove();
        return;
      }

      if (!prev && now) {
        this.create(update.view);
      }

      if (now) {
        if (prev && this.dom && prev.autohide !== now.autohide) {
          if (now.autohide) {
            this.dom.classList.add('cm-minimap-autohide');
          } else {
            this.dom.classList.remove('cm-minimap-autohide');
          }
        }

        this.text.update(update);
        this.selection.update(update);
        this.diagnostic.update(update);
        this.requestRender();
      }
    }

    getWidth(): number {
      const editorWidth = this.view.dom.clientWidth;
      if (editorWidth <= Scale.MaxWidth * WIDTH_RATIO) {
        const ratio = editorWidth / (Scale.MaxWidth * WIDTH_RATIO);
        return Scale.MaxWidth * ratio;
      }
      return Scale.MaxWidth;
    }

    render() {
      // If we don't have elements to draw to exit early
      if (!this.dom || !this.canvas || !this.inner) {
        return;
      }

      this.text.beforeDraw();

      this.updateBoxShadow();

      this.dom.style.width = this.getWidth() + "px";
      this.canvas.style.maxWidth = this.getWidth() + "px";
      this.canvas.width = this.getWidth() * Scale.PixelMultiplier;

      const domHeight = this.view.dom.getBoundingClientRect().height;
      this.inner.style.minHeight = domHeight + "px";
      this.canvas.height = domHeight * Scale.PixelMultiplier;
      this.canvas.style.height = domHeight + "px";

      const context = this.canvas.getContext("2d");
      if (!context) {
        return;
      }

      context.clearRect(0, 0, this.canvas.width, this.canvas.height);

      /* We need to get the correct font dimensions before this to measure characters */
      const { charWidth, lineHeight } = this.text.measure(context);

      let { startIndex, endIndex, offsetY } = this.canvasStartAndEndIndex(
        context,
        lineHeight
      );

      const gutters = this.view.state.facet(Config).gutters;

      const lines = this.view.state.field(LinesState);

      for (let i = startIndex; i < endIndex; i++) {
        if (i >= lines.length) break;

        const drawContext = {
          offsetX: 0,
          offsetY,
          context,
          lineHeight,
          charWidth,
        };

        if (gutters.length) {
          /* Small leading buffer */
          drawContext.offsetX += 2;

          for (const gutter of gutters) {
            drawLineGutter(gutter, drawContext, i + 1);
            drawContext.offsetX += GUTTER_WIDTH;
          }

          /* Small trailing buffer */
          drawContext.offsetX += 2;
        }

        this.text.drawLine(drawContext, i + 1);
        this.selection.drawLine(drawContext, i + 1);
        this.diagnostic.drawLine(drawContext, i + 1);

        offsetY += lineHeight;
      }
    }

    requestRender() {
      if (this.renderHandle !== null) {
        return;
      }

      if (typeof requestAnimationFrame === "function") {
        const handle = requestAnimationFrame(() => {
          this.renderHandle = null;
          this.cancelRender = null;
          this.render();
        });
        this.renderHandle = handle;
        this.cancelRender = () => cancelAnimationFrame(handle);
        return;
      }

      const handle = setTimeout(() => {
        this.renderHandle = null;
        this.cancelRender = null;
        this.render();
      }, 16);
      this.renderHandle = handle;
      this.cancelRender = () => clearTimeout(handle);
    }

    cancelRenderRequest() {
      if (!this.cancelRender) {
        return;
      }
      this.cancelRender();
      this.renderHandle = null;
      this.cancelRender = null;
    }

    private canvasStartAndEndIndex(
      context: CanvasRenderingContext2D,
      lineHeight: number
    ) {
      let { top: pTop, bottom: pBottom } = this.view.documentPadding;
      (pTop /= Scale.SizeRatio), (pBottom /= Scale.SizeRatio);

      const canvasHeight = context.canvas.height;
      const { clientHeight, scrollHeight, scrollTop } = this.view.scrollDOM;
      let scrollPercent = scrollTop / (scrollHeight - clientHeight);
      if (isNaN(scrollPercent)) {
        scrollPercent = 0;
      }

      const lineCount = this.view.state.field(LinesState).length;
      const totalHeight = pTop + pBottom + lineCount * lineHeight;

      const canvasTop = Math.max(
        0,
        scrollPercent * (totalHeight - canvasHeight)
      );
      const offsetY = Math.max(0, pTop - canvasTop);

      const startIndex = Math.round(Math.max(0, canvasTop - pTop) / lineHeight);
      const spaceForLines = Math.round((canvasHeight - offsetY) / lineHeight);

      return {
        startIndex,
        endIndex: startIndex + spaceForLines,
        offsetY,
      };
    }

    private updateBoxShadow() {
      if (!this.canvas) {
        return;
      }

      const { clientWidth, scrollWidth, scrollLeft } = this.view.scrollDOM;

      if (clientWidth + scrollLeft < scrollWidth) {
        this.canvas.classList.add("cm-minimap-box-shadow");
      } else {
        this.canvas.classList.remove("cm-minimap-box-shadow");
      }
    }

    destroy() {
      this.remove();
    }
  },
  {
    eventHandlers: {
      scroll() {
        this.requestRender();
      },
    },
    provide: (plugin) => {
      return EditorView.scrollMargins.of((view) => {
        const width = view.plugin(plugin)?.getWidth();
        if (!width) {
          return null;
        }

        return { right: width };
      });
    },
  }
);

// 使用type定义
export type MinimapConfig = Omit<Options, "enabled"> & {
  /**
   * A function that creates the element that contains the minimap
   */
  create: (view: EditorView) => { dom: HTMLElement };
};

/**
 * Facet used to show a minimap in the right gutter of the editor using the
 * provided configuration.
 *
 * If you return `null`, a minimap will not be shown.
 */
const showMinimapFacet = Facet.define<MinimapConfig | null, MinimapConfig | null>({
  combine: (c) => c.find((o) => o !== null) ?? null,
});

/**
 * 创建默认的minimap DOM元素
 */
const defaultCreateFn = (view: EditorView) => {
  const dom = document.createElement('div');
  return { dom };
};

/**
 * 添加minimap到编辑器
 * @param options Minimap配置项
 * @returns 
 */
export function minimap(options: Partial<Omit<MinimapConfig, 'create'>> = {}) {
  const config: MinimapConfig = {
    create: defaultCreateFn,
    ...options,
  };

  return [
    showMinimapFacet.of(config),
    Config.compute([showMinimapFacet], (s) => s.facet(showMinimapFacet)),
    Theme,
    LinesState,
    minimapClass,
    Overlay,
  ];
}
