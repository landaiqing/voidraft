import { DrawContext } from "../types";
import { Options, Scale } from "../config";
import { GlyphAtlas, GlyphCanvas, isCanvas2DContext } from "./glyphAtlas";
import { TagSpan, FontInfo } from "./textTypes";

type DisplayMode = Required<Options>["displayText"];

type LineBitmap = {
  version: number;
  charWidth: number;
  baseLineHeight: number;
  availableWidth: number;
  height: number;
  displayMode: DisplayMode;
  canvas: GlyphCanvas;
};

export class LineRenderer {
  private readonly _lineVersions = new Map<number, number>();
  private readonly _lineCache = new Map<number, LineBitmap>();
  private static readonly MAX_CACHE_LINES = 2000;

  public constructor(
    private readonly glyphAtlas: GlyphAtlas,
    private readonly resolveFontInfo: (tags: string) => FontInfo
  ) {}

  public markLineChanged(lineNumber: number) {
    const version = (this._lineVersions.get(lineNumber) ?? 0) + 1;
    this._lineVersions.set(lineNumber, version);
    this._lineCache.delete(lineNumber);
    this.trimCache();
  }

  public markAllChanged() {
    this._lineVersions.clear();
    this._lineCache.clear();
  }

  public pruneLines(totalLines: number) {
    for (const key of this._lineVersions.keys()) {
      if (key > totalLines) {
        this._lineVersions.delete(key);
        this._lineCache.delete(key);
      }
    }
    this.trimCache();
  }

  public drawLine(
    lineNumber: number,
    spans: Array<TagSpan>,
    displayText: DisplayMode,
    ctx: DrawContext
  ) {
    if (spans.length === 0) {
      return;
    }

    const availableWidth = Math.max(
      0,
      Math.floor(ctx.context.canvas.width - ctx.offsetX)
    );
    if (availableWidth <= 0) {
      return;
    }

    const version = this._lineVersions.get(lineNumber) ?? 0;
    const cached = this.ensureLineBitmap(
      lineNumber,
      spans,
      version,
      displayText,
      ctx,
      availableWidth
    );

    if (!cached) {
      this.paintLineDirectly(spans, displayText, ctx, availableWidth);
      return;
    }

    ctx.context.drawImage(
      cached.canvas,
      0,
      0,
      cached.availableWidth,
      cached.height,
      ctx.offsetX,
      ctx.offsetY,
      cached.availableWidth,
      cached.height
    );
  }

  private paintLineDirectly(
    spans: Array<TagSpan>,
    displayText: DisplayMode,
    ctx: DrawContext,
    availableWidth: number
  ) {
    this.paintSpans(
      ctx.context,
      spans,
      displayText,
      ctx.charWidth,
      ctx.lineHeight,
      ctx.offsetX,
      ctx.offsetY,
      availableWidth
    );
  }

  private ensureLineBitmap(
    lineNumber: number,
    spans: Array<TagSpan>,
    version: number,
    displayText: DisplayMode,
    ctx: DrawContext,
    availableWidth: number
  ): LineBitmap | undefined {
    const cached = this._lineCache.get(lineNumber);
    if (
      cached &&
      cached.version === version &&
      cached.charWidth === ctx.charWidth &&
      cached.baseLineHeight === ctx.lineHeight &&
      cached.availableWidth === availableWidth &&
      cached.displayMode === displayText
    ) {
      return cached;
    }

    const fontInfos = spans.map((span) => this.resolveFontInfo(span.tags));
    let maxLineHeight = ctx.lineHeight;
    for (const info of fontInfos) {
      maxLineHeight = Math.max(maxLineHeight, info.lineHeight);
    }

    const width = Math.max(1, availableWidth);
    const height = Math.max(1, Math.ceil(maxLineHeight));
    const canvas = this.createLineCanvas(width, height);
    if (!canvas) {
      return undefined;
    }

    const lineCtx = canvas.getContext("2d");
    if (!isCanvas2DContext(lineCtx)) {
      return undefined;
    }

    lineCtx.clearRect(0, 0, width, height);
    this.paintSpans(
      lineCtx,
      spans,
      displayText,
      ctx.charWidth,
      maxLineHeight,
      0,
      0,
      width,
      fontInfos
    );

    const entry: LineBitmap = {
      version,
      charWidth: ctx.charWidth,
      baseLineHeight: ctx.lineHeight,
      availableWidth: width,
      height,
      displayMode: displayText,
      canvas,
    };

    this._lineCache.set(lineNumber, entry);
    this.trimCache();
    return entry;
  }

  private trimCache() {
    while (this._lineCache.size > LineRenderer.MAX_CACHE_LINES) {
      const oldest = this._lineCache.keys().next();
      if (oldest.done) break;
      this._lineCache.delete(oldest.value);
      this._lineVersions.delete(oldest.value);
    }
  }

  private paintSpans(
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    spans: Array<TagSpan>,
    displayText: DisplayMode,
    charWidth: number,
    baseLineHeight: number,
    offsetX: number,
    offsetY: number,
    availableWidth: number,
    fontInfos?: Array<FontInfo>
  ) {
    let cursorX = offsetX;
    let prevInfo: FontInfo | undefined;
    context.textBaseline = "ideographic";

    for (let i = 0; i < spans.length; i++) {
      const span = spans[i];
      const info = fontInfos?.[i] ?? this.resolveFontInfo(span.tags);

      if (!prevInfo || prevInfo.color !== info.color) {
        context.fillStyle = info.color;
      }

      if (!prevInfo || prevInfo.font !== info.font) {
        context.font = info.font;
      }

      prevInfo = info;
      const spanLineHeight = Math.max(baseLineHeight, info.lineHeight);

      if (displayText === "characters") {
        cursorX = this.drawCharactersSpan(
          context,
          span.text,
          info,
          cursorX,
          offsetY,
          spanLineHeight,
          charWidth
        );
        continue;
      }

      const nonWhitespace = /\S+/g;
      let start: RegExpExecArray | null;
      while ((start = nonWhitespace.exec(span.text)) !== null) {
        const startX = cursorX + start.index * charWidth;
        let width = (nonWhitespace.lastIndex - start.index) * charWidth;
        const relativeStart = startX - offsetX;

        if (relativeStart > availableWidth) {
          break;
        }

        if (relativeStart + width > availableWidth) {
          width = availableWidth - relativeStart;
        }

        if (width <= 0) {
          continue;
        }

        const yBuffer = 2 / Scale.SizeRatio;
        const height = spanLineHeight - yBuffer;

        context.fillStyle = info.color;
        context.globalAlpha = 0.65;
        context.beginPath();
        context.rect(startX, offsetY, width, height);
        context.fill();
      }

      cursorX += span.text.length * charWidth;
      context.globalAlpha = 1;
    }
  }

  private drawCharactersSpan(
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    text: string,
    fontInfo: FontInfo,
    offsetX: number,
    offsetY: number,
    lineHeight: number,
    charWidth: number
  ) {
    if (!text) {
      return offsetX;
    }

    context.globalAlpha = 1;

    if (!this.glyphAtlas.isAvailable()) {
      context.fillText(text, offsetX, offsetY + lineHeight);
      return offsetX + text.length * charWidth;
    }

    for (const char of text) {
      const glyph = this.glyphAtlas.get(fontInfo, char, fontInfo.lineHeight);
      if (glyph) {
        const destY = offsetY + (lineHeight - glyph.sh);
        context.drawImage(
          glyph.source,
          0,
          0,
          glyph.sw,
          glyph.sh,
          offsetX,
          destY,
          charWidth,
          glyph.sh
        );
      } else {
        context.fillText(char, offsetX, offsetY + lineHeight);
      }
      offsetX += charWidth;
    }

    return offsetX;
  }

  private createLineCanvas(width: number, height: number): GlyphCanvas | undefined {
    if (typeof OffscreenCanvas !== "undefined") {
      return new OffscreenCanvas(width, height);
    }

    if (typeof document !== "undefined") {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      return canvas;
    }

    return undefined;
  }
}
