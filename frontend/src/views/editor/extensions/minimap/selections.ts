import { LineBasedState } from "./linebasedstate";
import { EditorView, ViewUpdate } from "@codemirror/view";
import { Lines, LinesState, foldsChanged } from "./linesState";
import { DrawContext } from "./types";
import { Config } from "./config";
import { lineLength, lineNumberAt, offsetWithinLine } from "./lineGeometry";

type Selection = { from: number; to: number; extends: boolean };
type DrawInfo = { backgroundColor: string };

export class SelectionState extends LineBasedState<Array<Selection>> {
  private _drawInfo: DrawInfo | undefined;
  private _themeClasses: string;

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

    if (this._themeClasses !== this.view.dom.classList.value) {
      this._drawInfo = undefined;
      this._themeClasses = this.view.dom.classList.value;
    }

    const lines = update.state.field(LinesState);
    const nextSelections = new Map<number, Array<Selection>>();

    for (const range of update.state.selection.ranges) {
      if (range.empty) {
        continue;
      }

      const startLine = lineNumberAt(lines, range.from);
      const endLine = lineNumberAt(
        lines,
        Math.max(range.from, range.to - 1)
      );

      if (startLine <= 0 || endLine <= 0) {
        continue;
      }

      this.collectRangeSelections(
        nextSelections,
        lines,
        range.from,
        range.to,
        startLine,
        endLine
      );
    }

    this.applySelectionDiff(nextSelections);
  }

  public drawLine(ctx: DrawContext, lineNumber: number) {
    const {
      context,
      lineHeight,
      charWidth,
      offsetX: startOffsetX,
      offsetY,
    } = ctx;
    const selections = this.get(lineNumber);
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

  private collectRangeSelections(
    store: Map<number, Array<Selection>>,
    lines: Lines,
    rangeFrom: number,
    rangeTo: number,
    startLine: number,
    endLine: number
  ) {
    for (let lineNumber = startLine; lineNumber <= endLine; lineNumber++) {
      const spans = lines[lineNumber - 1];
      if (!spans || spans.length === 0) {
        continue;
      }

      const length = lineLength(spans);
      const fromOffset =
        lineNumber === startLine ? offsetWithinLine(rangeFrom, spans) : 0;

      let toOffset =
        lineNumber === endLine ? offsetWithinLine(rangeTo, spans) : length;
      if (toOffset === fromOffset) {
        toOffset = Math.min(length, fromOffset + 1);
      }

      const lastSpan = spans[spans.length - 1];
      const spanEnd = lastSpan ? lastSpan.to : rangeTo;
      const extendsLine =
        lineNumber < endLine || (lineNumber === endLine && rangeTo > spanEnd);

      const selections = this.ensureLineEntry(store, lineNumber);
      this.appendSelection(selections, {
        from: fromOffset,
        to: toOffset,
        extends: extendsLine,
      });
    }
  }

  private ensureLineEntry(
    store: Map<number, Array<Selection>>,
    lineNumber: number
  ) {
    let selections = store.get(lineNumber);
    if (!selections) {
      selections = [];
      store.set(lineNumber, selections);
    }
    return selections;
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

  private applySelectionDiff(nextMap: Map<number, Array<Selection>>) {
    if (nextMap.size === 0 && this.map.size === 0) {
      return;
    }

    for (const key of Array.from(this.map.keys())) {
      if (!nextMap.has(key)) {
        this.map.delete(key);
      }
    }

    for (const [lineNumber, selections] of nextMap) {
      const existing = this.map.get(lineNumber);
      if (!existing || !this.areSelectionsEqual(existing, selections)) {
        this.map.set(lineNumber, selections);
      }
    }
  }

  private areSelectionsEqual(a: Array<Selection>, b: Array<Selection>) {
    if (a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i++) {
      if (
        a[i].from !== b[i].from ||
        a[i].to !== b[i].to ||
        a[i].extends !== b[i].extends
      ) {
        return false;
      }
    }
    return true;
  }
}

export function selections(view: EditorView): SelectionState {
  return new SelectionState(view);
}
