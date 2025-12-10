import { LineBasedState } from "./linebasedstate";
import { EditorView, ViewUpdate } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { Lines, foldsChanged, getLinesSnapshot } from "./linesState";
import { DrawContext } from "./types";
import { Config } from "./config";
import { lineLength, lineNumberAt, offsetWithinLine } from "./lineGeometry";

type Selection = { from: number; to: number; extends: boolean };
type DrawInfo = { backgroundColor: string };
type RangeInfo = {
  from: number;
  to: number;
  lineFrom: number;
  lineTo: number;
};

const MAX_CACHED_LINES = 800;

export class SelectionState extends LineBasedState<Array<Selection>> {
  private _drawInfo: DrawInfo | undefined;
  private _themeClasses: string;
  private _rangeInfo: Array<RangeInfo> = [];
  private _linesSnapshot: Lines = [];

  public constructor(view: EditorView) {
    super(view);

    this.getDrawInfo();
    this._themeClasses = view.dom.classList.value;
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

    // If the selection changed
    if (update.selectionSet) {
      return true;
    }

    // If the theme changed
    if (this._themeClasses !== this.view.dom.classList.value) {
      return true;
    }

    // If the folds changed
    if (foldsChanged(update.transactions)) {
      return true;
    }

    return false;
  }

  public update(update: ViewUpdate) {
    if (!this.shouldUpdate(update)) {
      return;
    }

    this.rebuild(update.state);
  }

  public drawLine(ctx: DrawContext, lineNumber: number) {
    const {
      context,
      lineHeight,
      charWidth,
      offsetX: startOffsetX,
      offsetY,
    } = ctx;
    const selections = this.ensureSelections(lineNumber);
    if (!selections) {
      return;
    }

    for (const selection of selections) {
      const offsetX = startOffsetX + selection.from * charWidth;
      const textWidth = (selection.to - selection.from) * charWidth;
      const fullWidth = context.canvas.width - offsetX;

      if (selection.extends) {
        // Draw the full width rectangle in the background
        context.globalAlpha = 0.65;
        context.beginPath();
        context.rect(offsetX, offsetY, fullWidth, lineHeight);
        context.fillStyle = this.getDrawInfo().backgroundColor;
        context.fill();
      }

      // Draw text selection rectangle in the foreground
      context.globalAlpha = 1;
      context.beginPath();
      context.rect(offsetX, offsetY, textWidth, lineHeight);
      context.fillStyle = this.getDrawInfo().backgroundColor;
      context.fill();
    }
  }

  private getDrawInfo(): DrawInfo {
    if (this._drawInfo) {
      return this._drawInfo;
    }

    // Create a mock selection
    const mockToken = document.createElement("span");
    mockToken.setAttribute("class", "cm-selectionBackground");
    this.view.dom.appendChild(mockToken);

    // Get style information
    const style = window.getComputedStyle(mockToken);
    const result = { backgroundColor: style.backgroundColor };

    // Store the result for the next update
    this._drawInfo = result;
    this.view.dom.removeChild(mockToken);

    return result;
  }

  private appendSelection(target: Array<Selection>, entry: Selection) {
    const last = target[target.length - 1];
    if (last && entry.from <= last.to) {
      target[target.length - 1] = {
        from: Math.min(last.from, entry.from),
        to: Math.max(last.to, entry.to),
        extends: entry.extends || last.extends,
      };
      return;
    }
    target.push(entry);
  }
  private rebuild(state: EditorState) {
    if (this._themeClasses !== this.view.dom.classList.value) {
      this._drawInfo = undefined;
      this._themeClasses = this.view.dom.classList.value;
    }

    this._linesSnapshot = getLinesSnapshot(state);
    this._rangeInfo = this.buildRangeInfo(state, this._linesSnapshot);
    this.map.clear();
  }

  private buildRangeInfo(state: EditorState, lines: Lines) {
    const info: Array<RangeInfo> = [];
    for (const range of state.selection.ranges) {
      if (range.empty) {
        continue;
      }

      const startLine = lineNumberAt(lines, range.from);
      const endLine = lineNumberAt(lines, Math.max(range.from, range.to - 1));
      if (startLine <= 0 || endLine <= 0) {
        continue;
      }

      info.push({
        from: range.from,
        to: range.to,
        lineFrom: startLine,
        lineTo: endLine,
      });
    }
    return info;
  }

  private ensureSelections(lineNumber: number) {
    const cached = this.get(lineNumber);
    if (cached) {
      return cached;
    }

    const computed = this.buildSelectionsForLine(lineNumber);
    if (!computed || computed.length === 0) {
      return undefined;
    }

    if (this.map.has(lineNumber)) {
      this.map.delete(lineNumber);
    }
    this.map.set(lineNumber, computed);
    while (this.map.size > MAX_CACHED_LINES) {
      const oldest = this.map.keys().next();
      if (oldest.done) {
        break;
      }
      this.map.delete(oldest.value);
    }

    return computed;
  }

  private buildSelectionsForLine(lineNumber: number) {
    const spans = this._linesSnapshot[lineNumber - 1];
    if (!spans || spans.length === 0) {
      return undefined;
    }

    const relevant = this._rangeInfo.filter(
      (info) => lineNumber >= info.lineFrom && lineNumber <= info.lineTo
    );
    if (!relevant.length) {
      return undefined;
    }

    const selections: Array<Selection> = [];
    for (const range of relevant) {
      const length = lineLength(spans);
      const fromOffset =
        lineNumber === range.lineFrom
          ? offsetWithinLine(range.from, spans)
          : 0;

      let toOffset =
        lineNumber === range.lineTo
          ? offsetWithinLine(range.to, spans)
          : length;
      if (toOffset === fromOffset) {
        toOffset = Math.min(length, fromOffset + 1);
      }

      const lastSpan = spans[spans.length - 1];
      const spanEnd = lastSpan ? lastSpan.to : range.to;
      const extendsLine =
        lineNumber < range.lineTo ||
        (lineNumber === range.lineTo && range.to > spanEnd);

      this.appendSelection(selections, {
        from: fromOffset,
        to: toOffset,
        extends: extendsLine,
      });
    }

    return selections;
  }
}

export function selections(view: EditorView): SelectionState {
  return new SelectionState(view);
}
