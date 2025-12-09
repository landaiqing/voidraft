import { FontInfo } from "./textTypes";

export type GlyphCanvas = OffscreenCanvas | HTMLCanvasElement;

type GlyphBitmap = {
  source: CanvasImageSource;
  sw: number;
  sh: number;
};

export class GlyphAtlas {
  private static measurementCanvas:
    | OffscreenCanvas
    | HTMLCanvasElement
    | undefined;
  private static measurementContext:
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null
    | undefined;

  private readonly atlases = new Map<string, Map<string, GlyphBitmap>>();
  private readonly enabled: boolean;

  public constructor() {
    this.enabled =
      typeof OffscreenCanvas !== "undefined" || typeof document !== "undefined";
  }

  public isAvailable() {
    return this.enabled;
  }

  public get(
    info: FontInfo,
    char: string,
    intrinsicLineHeight: number
  ): GlyphBitmap | undefined {
    if (!this.enabled) {
      return undefined;
    }

    const key = `${info.font}|${info.color}|${intrinsicLineHeight.toFixed(2)}`;
    let atlas = this.atlases.get(key);
    if (!atlas) {
      atlas = new Map();
      this.atlases.set(key, atlas);
    }

    let glyph = atlas.get(char);
    if (!glyph) {
      glyph = this.createGlyph(info, char, intrinsicLineHeight);
      if (glyph) {
        atlas.set(char, glyph);
      }
    }

    return glyph;
  }

  public bust() {
    this.atlases.clear();
  }

  private createGlyph(
    info: FontInfo,
    char: string,
    lineHeight: number
  ): GlyphBitmap | undefined {
    const measurement = GlyphAtlas.ensureMeasurementContext();
    if (!measurement) {
      return undefined;
    }

    measurement.font = info.font;
    const metrics = measurement.measureText(char);
    const width = Math.max(
      Math.ceil(
        metrics.actualBoundingBoxRight !== undefined &&
          metrics.actualBoundingBoxLeft !== undefined
          ? metrics.actualBoundingBoxRight - metrics.actualBoundingBoxLeft
          : metrics.width
      ),
      1
    );
    const height = Math.max(1, Math.ceil(lineHeight));

    const canvas = this.createCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!isCanvas2DContext(ctx)) {
      return undefined;
    }

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = info.color;
    ctx.font = info.font;
    ctx.textBaseline = "ideographic";
    ctx.fillText(char, 0, height);

    return { source: canvas, sw: width, sh: height };
  }

  private createCanvas(width: number, height: number): GlyphCanvas {
    if (typeof OffscreenCanvas !== "undefined") {
      return new OffscreenCanvas(width, height);
    }

    if (typeof document === "undefined") {
      throw new Error("Unable to create canvas without DOM");
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  private static ensureMeasurementContext():
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | undefined {
    if (!GlyphAtlas.measurementCanvas) {
      if (typeof OffscreenCanvas !== "undefined") {
        GlyphAtlas.measurementCanvas = new OffscreenCanvas(1, 1);
      } else if (typeof document !== "undefined") {
        GlyphAtlas.measurementCanvas = document.createElement("canvas");
      }
    }

    if (GlyphAtlas.measurementCanvas && !GlyphAtlas.measurementContext) {
      const context = GlyphAtlas.measurementCanvas.getContext("2d");
      GlyphAtlas.measurementContext = isCanvas2DContext(context)
        ? context
        : undefined;
    }

    return GlyphAtlas.measurementContext ?? undefined;
  }
}

export function isCanvas2DContext(
  ctx: unknown
): ctx is CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D {
  return !!ctx && typeof (ctx as CanvasRenderingContext2D).fillText === "function";
}
