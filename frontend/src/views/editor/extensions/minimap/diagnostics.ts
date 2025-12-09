import { EditorView, ViewUpdate } from "@codemirror/view";
import {
  Diagnostic,
  diagnosticCount,
  forEachDiagnostic,
  setDiagnosticsEffect,
} from "@codemirror/lint";

import { LineBasedState } from "./linebasedstate";
import { DrawContext } from "./types";
import { Lines, LinesState, foldsChanged } from "./linesState";
import { Config, Scale } from "./config";
import { lineLength, lineNumberAt, offsetWithinLine } from "./lineGeometry";

type Severity = Diagnostic["severity"];
type DiagnosticRange = { from: number; to: number };
type LineDiagnostics = {
  severity: Severity;
  ranges: Array<DiagnosticRange>;
};
const MIN_PIXEL_WIDTH = 1 / Scale.PixelMultiplier;
const snapToDevice = (value: number) =>
  Math.round(value * Scale.PixelMultiplier) / Scale.PixelMultiplier;

export class DiagnosticState extends LineBasedState<LineDiagnostics> {
  private count: number | undefined = undefined;

  public constructor(view: EditorView) {
    super(view);
  }

  private shouldUpdate(update: ViewUpdate) {
    // If the minimap is disabled
    if (!update.state.facet(Config).enabled) {
      return false;
    }

    // If the doc changed
    if (update.docChanged) {
      return true;
    }

    // If the diagnostics changed
    for (const tr of update.transactions) {
      for (const ef of tr.effects) {
        if (ef.is(setDiagnosticsEffect)) {
          return true;
        }
      }
    }

    // If the folds changed
    if (foldsChanged(update.transactions)) {
      return true;
    }

    // If the minimap was previously hidden
    if (this.count === undefined) {
      return true;
    }

    return false;
  }

  public update(update: ViewUpdate) {
    if (!this.shouldUpdate(update)) {
      return;
    }

    this.map.clear();
    const lines = update.state.field(LinesState);
    this.count = diagnosticCount(update.state);

    forEachDiagnostic(update.state, (diagnostic, from, to) => {
      const lineStart = lineNumberAt(lines, from);
      const lineEnd = lineNumberAt(lines, to);
      if (lineStart <= 0 || lineEnd <= 0) {
        return;
      }

      for (let lineNumber = lineStart; lineNumber <= lineEnd; lineNumber++) {
        const spans = lines[lineNumber - 1];
        if (!spans || spans.length === 0) {
          continue;
        }

        const length = lineLength(spans);

        const startOffset =
          lineNumber === lineStart
            ? offsetWithinLine(from, spans)
            : 0;
        const endOffset =
          lineNumber === lineEnd ? offsetWithinLine(to, spans) : length;

        const fromOffset = Math.max(0, Math.min(length, startOffset));
        let toOffset = Math.max(fromOffset, Math.min(length, endOffset));
        if (toOffset === fromOffset) {
          toOffset = Math.min(length, fromOffset + 1);
        }

        this.pushRange(lineNumber, diagnostic.severity, {
          from: fromOffset,
          to: toOffset,
        });
      }
    });

    this.mergeRanges();
  }

  public drawLine(ctx: DrawContext, lineNumber: number) {
    const diagnostics = this.get(lineNumber);
    if (!diagnostics) {
      return;
    }

    const { context, lineHeight, charWidth, offsetX, offsetY } = ctx;
    const color = this.color(diagnostics.severity);
    const snappedY = snapToDevice(offsetY);
    const snappedHeight =
      Math.max(MIN_PIXEL_WIDTH, snapToDevice(offsetY + lineHeight) - snappedY) ||
      MIN_PIXEL_WIDTH;

    context.fillStyle = color;
    for (const range of diagnostics.ranges) {
      const startX = offsetX + range.from * charWidth;
      const width = Math.max(
        MIN_PIXEL_WIDTH,
        (range.to - range.from) * charWidth
      );
      const snappedX = snapToDevice(startX);
      const snappedWidth =
        Math.max(MIN_PIXEL_WIDTH, snapToDevice(startX + width) - snappedX) ||
        MIN_PIXEL_WIDTH;

      context.globalAlpha = 0.65;
      context.beginPath();
      context.rect(snappedX, snappedY, snappedWidth, snappedHeight);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  /**
   * Colors from @codemirror/lint
   * https://github.com/codemirror/lint/blob/e0671b43c02e72766ad1afe1579b7032fdcdb6c1/src/lint.ts#L597
   */
  private color(severity: Severity) {
    return severity === "error"
      ? "#d11"
      : severity === "warning"
      ? "orange"
      : "#999";
  }

  private score(s: Severity) {
    switch (s) {
      case "error": {
        return 3;
      }
      case "warning": {
        return 2;
      }
      default: {
        return 1;
      }
    }
  }

  private pushRange(
    lineNumber: number,
    severity: Severity,
    range: DiagnosticRange
  ) {
    let entry = this.get(lineNumber);
    if (!entry) {
      entry = { severity, ranges: [range] };
      this.set(lineNumber, entry);
      return;
    }

    if (this.score(severity) > this.score(entry.severity)) {
      entry.severity = severity;
    }

    entry.ranges.push(range);
  }

  private mergeRanges() {
    for (const entry of this.map.values()) {
      if (entry.ranges.length <= 1) {
        continue;
      }

      entry.ranges.sort((a, b) => a.from - b.from);
      const merged: Array<DiagnosticRange> = [];

      for (const range of entry.ranges) {
        const last = merged[merged.length - 1];
        if (last && range.from <= last.to) {
          last.to = Math.max(last.to, range.to);
        } else {
          merged.push({ ...range });
        }
      }

      entry.ranges = merged;
    }
  }
}

export function diagnostics(view: EditorView): DiagnosticState {
  return new DiagnosticState(view);
}
